using System.Globalization;
using Bookly.Api.Data;
using Bookly.Api.Data.Configurations;
using Bookly.Api.DTOs.Booking;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Availability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Bookly.Api.Services.Booking;

/// <summary>Customer side of an appointment: book, list, cancel (booking-domain skill).</summary>
public sealed class BookingService(
    AppDbContext db,
    AvailabilityService availability,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<BookingService> logger)
{
    /// <summary>
    /// Books a slot the availability rules currently offer. With no staff member chosen, the free
    /// one with the fewest confirmed appointments that day is assigned (ties: staff order).
    /// A concurrent booking of the same slot is stopped by the database constraint (DEC-009).
    /// </summary>
    public async Task<ServiceResult<MyAppointmentDto>> BookAsync(
        Tenant tenant, AppUser customer, CreateAppointmentRequest request, CancellationToken cancellationToken)
    {
        if (!customer.EmailConfirmed)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status403Forbidden, ErrorCodes.EmailNotConfirmed, "Confirm your email before booking.");
        }

        var service = await db.Services.AsNoTracking().SingleOrDefaultAsync(s => s.Id == request.ServiceId && s.IsActive, cancellationToken);
        if (service is null)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.ServiceNotFound, "Service not found.");
        }

        if (request.StaffId is { } chosen && (await availability.EligibleStaffAsync(service.Id, chosen, cancellationToken)).Count == 0)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.StaffNotFound, "Staff member not found for this service.");
        }

        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var startUtc = request.Start.ToUniversalTime();
        var localDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(startUtc, timeZone).DateTime);

        var slot = (await availability.GetSlotsAsync(tenant, service, request.StaffId, localDate, cancellationToken))
            .SingleOrDefault(s => s.StartUtc == startUtc);
        if (slot is null)
        {
            return SlotUnavailable();
        }

        var staffId = request.StaffId ?? await LeastBusyAsync(slot.StaffIds, localDate, timeZone, cancellationToken);
        var now = timeProvider.GetUtcNow();
        var end = startUtc.AddMinutes(service.DurationMinutes);
        var appointment = new Appointment
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenant.Id,
            StaffMemberId = staffId,
            ServiceId = service.Id,
            CustomerId = customer.Id,
            StartUtc = startUtc,
            EndUtc = end,
            BlockedUntilUtc = end.AddMinutes(service.BufferMinutes),
            Status = AppointmentStatus.Confirmed,
            CustomerNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Appointments.Add(appointment);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsOverlap(exception))
        {
            return SlotUnavailable();
        }

        var staff = await db.StaffMembers.Where(s => s.Id == staffId).Select(s => new { s.DisplayName, s.UserId }).SingleAsync(cancellationToken);
        var when = DateFormatting.LongItalian(startUtc, timeZone);
        await TrySendAsync(EmailTemplates.BookingConfirmed(
            customer.Email!,
            customer.FirstName,
            tenant.Name,
            service.Name,
            when,
            tenant.Address,
            $"{BaseUrl}/account/appuntamenti"), cancellationToken);

        // Only here, in the customer's own booking: appointments entered from the calendar
        // (CalendarService) never notify the business (DEC-040).
        if (tenant.NotifyOnOnlineBooking)
        {
            await NotifyBusinessOfBookingAsync(
                tenant, customer, service.Name, staff.DisplayName, staff.UserId, when, localDate, appointment.CustomerNote, cancellationToken);
        }

        return ServiceResult<MyAppointmentDto>.Ok(
            ToDto(appointment, tenant, service, staff.DisplayName, timeZone, now),
            StatusCodes.Status201Created);
    }

    /// <summary>The customer's appointments across all tenants (the tenant filter is bypassed, scoped by customer).</summary>
    public async Task<IReadOnlyList<MyAppointmentDto>> ListMineAsync(Guid customerId, bool upcoming, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var query = db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AsNoTracking()
            .Where(a => a.CustomerId == customerId);

        query = upcoming
            ? query.Where(a => a.EndUtc >= now).OrderBy(a => a.StartUtc)
            : query.Where(a => a.EndUtc < now).OrderByDescending(a => a.StartUtc);

        var rows = await query
            .Take(100)
            .Select(a => new
            {
                Appointment = a,
                Tenant = db.Tenants.Single(t => t.Id == a.TenantId),
                a.Service,
                StaffName = a.StaffMember.DisplayName,
            })
            .ToListAsync(cancellationToken);

        return [.. rows.Select(r => ToDto(r.Appointment, r.Tenant, r.Service, r.StaffName, AvailabilityService.TimeZoneOf(r.Tenant), now))];
    }

    /// <summary>Cancels an own confirmed appointment before the tenant's cancellation window closes.</summary>
    public async Task<ServiceResult<MyAppointmentDto>> CancelAsync(AppUser customer, Guid appointmentId, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Include(a => a.Service)
            .Include(a => a.StaffMember)
            .SingleOrDefaultAsync(a => a.Id == appointmentId && a.CustomerId == customer.Id, cancellationToken);

        // Someone else's appointment is "not found": its existence is not revealed.
        if (appointment is null)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.AppointmentNotFound, "Appointment not found.");
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == appointment.TenantId, cancellationToken);
        var now = timeProvider.GetUtcNow();

        if (appointment.Status != AppointmentStatus.Confirmed || appointment.StartUtc <= now)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.NotCancellable, "This appointment can no longer be cancelled.");
        }

        if (now > CancelDeadline(appointment, tenant))
        {
            return ServiceResult<MyAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity, ErrorCodes.CancellationWindowPassed, "The online cancellation window has passed: contact the business.");
        }

        appointment.Status = AppointmentStatus.CancelledByCustomer;
        appointment.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.ConcurrentUpdate, "The appointment was changed meanwhile: reload and retry.");
        }

        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        await TrySendAsync(EmailTemplates.BookingCancelledByCustomer(
            customer.Email!,
            customer.FirstName,
            tenant.Name,
            appointment.Service.Name,
            DateFormatting.LongItalian(appointment.StartUtc, timeZone),
            $"{BaseUrl}/b/{tenant.Slug}"), cancellationToken);

        if (tenant.NotifyOnCustomerCancellation)
        {
            await NotifyBusinessOfCancellationAsync(appointment, tenant, customer, timeZone, cancellationToken);
        }

        return ServiceResult<MyAppointmentDto>.Ok(ToDto(appointment, tenant, appointment.Service, appointment.StaffMember.DisplayName, timeZone, now));
    }

    /// <summary>Owners and the staff member's own login get an email (booking-domain: notifications).</summary>
    private async Task NotifyBusinessOfCancellationAsync(
        Appointment appointment, Tenant tenant, AppUser customer, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        var recipients = await BusinessRecipientsAsync(tenant.Id, appointment.StaffMember.UserId, cancellationToken);
        var when = DateFormatting.LongItalian(appointment.StartUtc, timeZone);
        foreach (var recipient in recipients)
        {
            await TrySendAsync(EmailTemplates.CustomerCancelledNotice(
                recipient.Email,
                recipient.FirstName,
                $"{customer.FirstName} {customer.LastName}",
                appointment.Service.Name,
                appointment.StaffMember.DisplayName,
                when,
                $"{BaseUrl}/admin"), cancellationToken);
        }
    }

    /// <summary>
    /// A customer booked online: the same recipients as a cancellation, with the customer's
    /// contacts and a link to the calendar on the appointment's day (DEC-040).
    /// </summary>
    private async Task NotifyBusinessOfBookingAsync(
        Tenant tenant,
        AppUser customer,
        string serviceName,
        string staffName,
        Guid? staffUserId,
        string when,
        DateOnly localDate,
        string? note,
        CancellationToken cancellationToken)
    {
        var recipients = await BusinessRecipientsAsync(tenant.Id, staffUserId, cancellationToken);
        var calendarLink = $"{BaseUrl}/admin?data={localDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}";
        var calendarDay = DateFormatting.DayItalian(localDate);
        foreach (var recipient in recipients)
        {
            await TrySendAsync(EmailTemplates.OnlineBookingNotice(
                recipient.Email,
                recipient.FirstName,
                tenant.Name,
                $"{customer.FirstName} {customer.LastName}",
                serviceName,
                when,
                staffName,
                customer.PhoneNumber,
                customer.Email,
                note,
                calendarDay,
                calendarLink), cancellationToken);
        }
    }

    /// <summary>
    /// The business side of a notification: every owner, plus the appointment's staff member when
    /// their login is still a member of the business. Deleted accounts never; one email per user.
    /// </summary>
    private async Task<List<BusinessRecipient>> BusinessRecipientsAsync(Guid tenantId, Guid? staffUserId, CancellationToken cancellationToken)
    {
        var memberIds = db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(m => m.TenantId == tenantId && (m.Role == TenantRole.Owner || m.UserId == staffUserId))
            .Select(m => m.UserId);
        return await db.Users
            .AsNoTracking()
            .Where(u => u.Email != null && u.DeletedAt == null && memberIds.Contains(u.Id))
            .Select(u => new BusinessRecipient(u.Email!, u.FirstName))
            .ToListAsync(cancellationToken);
    }

    private sealed record BusinessRecipient(string Email, string FirstName);

    private async Task<Guid> LeastBusyAsync(IReadOnlyList<Guid> candidates, DateOnly localDate, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        var day = AvailabilityCalculator.LocalDayInUtc(localDate, timeZone);
        var counts = await db.Appointments
            .Where(a => candidates.Contains(a.StaffMemberId)
                && a.Status == AppointmentStatus.Confirmed
                && a.StartUtc >= day.Start
                && a.StartUtc < day.End)
            .GroupBy(a => a.StaffMemberId)
            .Select(g => new { StaffId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StaffId, x => x.Count, cancellationToken);

        // candidates keep the staff sort order, so ties go to the first one.
        return candidates.MinBy(id => counts.GetValueOrDefault(id));
    }

    private static DateTimeOffset CancelDeadline(Appointment appointment, Tenant tenant) =>
        appointment.StartUtc.AddHours(-tenant.CancellationWindowHours);

    private static MyAppointmentDto ToDto(Appointment a, Tenant tenant, Service service, string staffName, TimeZoneInfo timeZone, DateTimeOffset now)
    {
        var deadline = CancelDeadline(a, tenant);
        return new MyAppointmentDto(
            a.Id,
            new AppointmentTenantDto(tenant.Slug, tenant.Name, tenant.Phone, tenant.Address, tenant.BrandPrimaryColor, tenant.TimeZone),
            service.Name,
            service.DurationMinutes,
            service.PriceCents,
            service.PriceIsFrom,
            staffName,
            TimeZoneInfo.ConvertTime(a.StartUtc, timeZone),
            TimeZoneInfo.ConvertTime(a.EndUtc, timeZone),
            a.Status.ToString(),
            a.CustomerNote,
            a.Status == AppointmentStatus.Confirmed && now <= deadline && a.StartUtc > now,
            TimeZoneInfo.ConvertTime(deadline, timeZone));
    }

    private static bool IsOverlap(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.ExclusionViolation } postgres
        && postgres.ConstraintName == AppointmentConfiguration.NoOverlapConstraint;

    private static ServiceResult<MyAppointmentDto> SlotUnavailable() =>
        ServiceResult<MyAppointmentDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.SlotUnavailable, "This time was just booked: choose another one.");

    private string BaseUrl => appOptions.Value.PublicBaseUrl.TrimEnd('/');

    private async Task TrySendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // The booking stands even if the email fails (booking-domain: notifications).
            logger.LogError(exception, "Sending email {EmailKind} failed", message.Kind);
        }
    }
}
