using Bookly.Api.Data;
using Bookly.Api.Data.Configurations;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Availability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// Business side of appointments (booking-domain: lifecycle). Owners see and manage every staff
/// member; a Staff member only their own appointments.
/// </summary>
public sealed class CalendarService(
    AppDbContext db,
    AdminContext admin,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<CalendarService> logger)
{
    public const int MaxDays = 42;

    public async Task<ServiceResult<CalendarDto>> GetAsync(
        DateOnly from, DateOnly to, Guid? staffId, bool includeCancelled, CancellationToken cancellationToken)
    {
        if (to < from || to.DayNumber - from.DayNumber >= MaxDays)
        {
            return ServiceResult<CalendarDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRange, $"Ask for 1 to {MaxDays} days.");
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var rangeStart = AvailabilityCalculator.LocalDayInUtc(from, timeZone).Start;
        var rangeEnd = AvailabilityCalculator.LocalDayInUtc(to, timeZone).End;

        var staffQuery = db.StaffMembers.AsNoTracking();
        if (!admin.IsOwner)
        {
            staffQuery = staffQuery.Where(s => s.UserId == admin.UserId);
        }

        if (staffId is { } only)
        {
            staffQuery = staffQuery.Where(s => s.Id == only);
        }

        var staff = await staffQuery
            .OrderBy(s => s.SortOrder).ThenBy(s => s.DisplayName).ThenBy(s => s.Id)
            .Select(s => new CalendarStaffDto(s.Id, s.DisplayName, s.IsActive, s.UserId == admin.UserId))
            .ToListAsync(cancellationToken);
        var staffIds = staff.Select(s => s.Id).ToList();

        var hours = await db.WorkingHours.AsNoTracking()
            .Where(w => staffIds.Contains(w.StaffMemberId))
            .OrderBy(w => w.DayOfWeek).ThenBy(w => w.StartLocal)
            .Select(w => new CalendarHoursDto(w.StaffMemberId, (int)w.DayOfWeek, w.StartLocal, w.EndLocal))
            .ToListAsync(cancellationToken);

        var timeOff = await db.TimeOffs.AsNoTracking()
            .Where(t => staffIds.Contains(t.StaffMemberId) && t.StartUtc < rangeEnd && t.EndUtc > rangeStart)
            .OrderBy(t => t.StartUtc)
            .ToListAsync(cancellationToken);

        var appointmentsQuery = db.Appointments.AsNoTracking()
            .Include(a => a.Service)
            .Include(a => a.Customer)
            .Include(a => a.TenantCustomer)
            .Where(a => staffIds.Contains(a.StaffMemberId) && a.StartUtc < rangeEnd && a.EndUtc > rangeStart);
        if (!includeCancelled)
        {
            appointmentsQuery = appointmentsQuery.Where(a =>
                a.Status != AppointmentStatus.CancelledByCustomer && a.Status != AppointmentStatus.CancelledByBusiness);
        }

        var appointments = await appointmentsQuery.OrderBy(a => a.StartUtc).ThenBy(a => a.Id).ToListAsync(cancellationToken);
        var now = timeProvider.GetUtcNow();

        return ServiceResult<CalendarDto>.Ok(new CalendarDto(
            tenant.TimeZone,
            from,
            to,
            staff,
            hours,
            [.. timeOff.Select(t => new CalendarTimeOffDto(
                t.Id, t.StaffMemberId, TimeZoneInfo.ConvertTime(t.StartUtc, timeZone), TimeZoneInfo.ConvertTime(t.EndUtc, timeZone), t.Reason))],
            [.. appointments.Select(a => ToDto(a, timeZone, now))]));
    }

    /// <summary>
    /// Moves a confirmed appointment (same id, same duration and buffer) to a new local date/time,
    /// optionally to another staff member. The new time goes through the availability rules:
    /// working hours, time off and, in the database, the overlap constraint (booking-domain).
    /// </summary>
    public async Task<ServiceResult<AdminAppointmentDto>> MoveAsync(Guid id, MoveAppointmentRequest request, CancellationToken cancellationToken)
    {
        var (appointment, failure) = await LoadAsync(id, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        if (appointment!.Status != AppointmentStatus.Confirmed)
        {
            return InvalidStatus();
        }

        var targetStaffId = request.StaffId ?? appointment.StaffMemberId;
        var target = await db.StaffMembers.AsNoTracking()
            .Where(s => s.Id == targetStaffId)
            .Select(s => new { s.Id, s.UserId, s.IsActive, s.DisplayName, Offers = s.Services.Any(x => x.ServiceId == appointment.ServiceId) })
            .SingleOrDefaultAsync(cancellationToken);
        if (target is null)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.NotFound, "Staff member not found.");
        }

        if (!admin.IsOwner && target.UserId != admin.UserId)
        {
            return StaffScope();
        }

        if (!target.IsActive || !target.Offers)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity, ErrorCodes.ServiceNotOffered, "This staff member does not offer the service.");
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var now = timeProvider.GetUtcNow();

        if (AvailabilityCalculator.ToUtc(request.Date, request.Time, timeZone, roundUpIfInvalid: false) is not { } newStart)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status400BadRequest, ErrorCodes.InvalidRange, "This local time does not exist (daylight saving change).");
        }

        if (newStart <= now)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status422UnprocessableEntity, ErrorCodes.InPast, "Choose a future time.");
        }

        var newEnd = newStart + (appointment.EndUtc - appointment.StartUtc);
        var newBlockedUntil = newStart + (appointment.BlockedUntilUtc - appointment.StartUtc);

        if (!await IsWithinWorkingHoursAsync(target.Id, request.Date, newStart, newBlockedUntil, timeZone, cancellationToken)
            || await db.TimeOffs.AnyAsync(t => t.StaffMemberId == target.Id && t.StartUtc < newBlockedUntil && t.EndUtc > newStart, cancellationToken))
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity, ErrorCodes.StaffUnavailable, "The staff member does not work at that time.");
        }

        var oldStart = appointment.StartUtc;
        appointment.StaffMemberId = target.Id;
        appointment.StartUtc = newStart;
        appointment.EndUtc = newEnd;
        appointment.BlockedUntilUtc = newBlockedUntil;
        appointment.ReminderSentAt = null; // the reminder refers to the old time
        appointment.UpdatedAt = now;

        var saved = await SaveAsync(cancellationToken);
        if (saved is not null)
        {
            return saved;
        }

        var contact = CustomerContact.Of(appointment);
        if (oldStart != newStart && contact.NotifyEmail(appointment) is { } to)
        {
            await TrySendAsync(EmailTemplates.AppointmentMovedByBusiness(
                to,
                contact.FirstName,
                tenant.Name,
                appointment.Service.Name,
                DateFormatting.LongItalian(oldStart, timeZone),
                DateFormatting.LongItalian(newStart, timeZone),
                CustomerLink(contact, tenant),
                contact.HasAccount,
                tenant.Phone), cancellationToken);
        }

        return ServiceResult<AdminAppointmentDto>.Ok(ToDto(appointment, timeZone, now));
    }

    /// <summary>
    /// The business enters an appointment from its calendar (phone, walk-in; DEC-037). Unlike an
    /// online booking it skips minimum notice and horizon; outside working hours or during time off
    /// it needs <see cref="CreateBusinessAppointmentRequest.AllowOutsideHours"/>. Overlaps are always
    /// stopped by the database constraint. Staff members only enter appointments for themselves.
    /// </summary>
    public async Task<ServiceResult<AdminAppointmentDto>> CreateAsync(CreateBusinessAppointmentRequest request, CancellationToken cancellationToken)
    {
        // Tracked: the new appointment's navigations are fixed up from these for the response.
        var service = await db.Services.SingleOrDefaultAsync(s => s.Id == request.ServiceId && s.IsActive, cancellationToken);
        if (service is null)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.ServiceNotFound, "Service not found.");
        }

        var staff = await db.StaffMembers.AsNoTracking()
            .Where(s => s.Id == request.StaffId)
            .Select(s => new { s.Id, s.UserId, s.IsActive, s.DisplayName, Offers = s.Services.Any(x => x.ServiceId == service.Id) })
            .SingleOrDefaultAsync(cancellationToken);
        if (staff is null)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.NotFound, "Staff member not found.");
        }

        if (!admin.IsOwner && staff.UserId != admin.UserId)
        {
            return StaffScope();
        }

        if (!staff.IsActive || !staff.Offers)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity, ErrorCodes.ServiceNotOffered, "This staff member does not offer the service.");
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var now = timeProvider.GetUtcNow();

        if (AvailabilityCalculator.ToUtc(request.Date, request.Time, timeZone, roundUpIfInvalid: false) is not { } start)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status400BadRequest, ErrorCodes.InvalidRange, "This local time does not exist (daylight saving change).");
        }

        if (start <= now)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status422UnprocessableEntity, ErrorCodes.InPast, "Choose a future time.");
        }

        var end = start.AddMinutes(service.DurationMinutes);
        var blockedUntil = end.AddMinutes(service.BufferMinutes);
        if (!request.AllowOutsideHours
            && (!await IsWithinWorkingHoursAsync(staff.Id, request.Date, start, blockedUntil, timeZone, cancellationToken)
                || await db.TimeOffs.AnyAsync(t => t.StaffMemberId == staff.Id && t.StartUtc < blockedUntil && t.EndUtc > start, cancellationToken)))
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity,
                ErrorCodes.OutsideWorkingHours,
                "Outside the staff member's working hours or during time off: confirm to enter it anyway.");
        }

        var appointment = new Appointment
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenant.Id,
            StaffMemberId = staff.Id,
            ServiceId = service.Id,
            StartUtc = start,
            EndUtc = end,
            BlockedUntilUtc = blockedUntil,
            Status = AppointmentStatus.Confirmed,
            Origin = AppointmentOrigin.Business,
            CreatedByUserId = admin.UserId,
            NotifyCustomer = request.NotifyCustomer,
            CustomerNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        var customerFailure = await AssignCustomerAsync(appointment, request, now, cancellationToken);
        if (customerFailure is not null)
        {
            return customerFailure;
        }

        db.Appointments.Add(appointment);
        var saved = await SaveAsync(cancellationToken);
        if (saved is not null)
        {
            return saved;
        }

        var contact = CustomerContact.Of(appointment);
        if (contact.NotifyEmail(appointment) is { } to)
        {
            await TrySendAsync(EmailTemplates.AppointmentBookedByBusiness(
                to,
                contact.FirstName,
                tenant.Name,
                service.Name,
                staff.DisplayName,
                DateFormatting.LongItalian(start, timeZone),
                tenant.Address,
                tenant.Phone,
                CustomerLink(contact, tenant),
                contact.HasAccount), cancellationToken);
        }

        return ServiceResult<AdminAppointmentDto>.Ok(ToDto(appointment, timeZone, now), StatusCodes.Status201Created);
    }

    /// <summary>
    /// Exactly one customer. An account must already have booked with this business (the tenant
    /// filter scopes the check), so the endpoint cannot be used to attach arbitrary accounts. A new
    /// customer reuses an address-book entry with the same name and phone instead of duplicating it.
    /// </summary>
    private async Task<ServiceResult<AdminAppointmentDto>?> AssignCustomerAsync(
        Appointment appointment, CreateBusinessAppointmentRequest request, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var chosen = (request.CustomerAccountId is null ? 0 : 1) + (request.TenantCustomerId is null ? 0 : 1) + (request.NewCustomer is null ? 0 : 1);
        if (chosen != 1)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status400BadRequest, ErrorCodes.CustomerRequired, "Choose one customer: an account, an address-book entry or a new one.");
        }

        if (request.CustomerAccountId is { } accountId)
        {
            appointment.Customer = await db.Users.SingleOrDefaultAsync(
                u => u.Id == accountId && u.DeletedAt == null && db.Appointments.Any(a => a.CustomerId == u.Id), cancellationToken);
            appointment.CustomerId = appointment.Customer?.Id;
        }
        else if (request.TenantCustomerId is { } entryId)
        {
            appointment.TenantCustomer = await db.TenantCustomers.SingleOrDefaultAsync(
                c => c.Id == entryId && c.AnonymizedAt == null, cancellationToken);
            appointment.TenantCustomerId = appointment.TenantCustomer?.Id;
        }
        else
        {
            var input = request.NewCustomer!;
            var firstName = input.FirstName.Trim();
            var lastName = input.LastName.Trim();
            var phone = input.Phone.Trim();
            var digits = TenantCustomer.Digits(phone);
            var email = string.IsNullOrWhiteSpace(input.Email) ? null : input.Email.Trim();

            var existing = await db.TenantCustomers.FirstOrDefaultAsync(
                c => c.AnonymizedAt == null
                    && c.PhoneDigits == digits
                    && c.FirstName.ToLower() == firstName.ToLower()
                    && c.LastName.ToLower() == lastName.ToLower(),
                cancellationToken);
            if (existing is not null)
            {
                if (email is not null && existing.Email != email)
                {
                    existing.Email = email;
                    existing.UpdatedAt = now;
                }

                appointment.TenantCustomer = existing;
            }
            else
            {
                appointment.TenantCustomer = new TenantCustomer
                {
                    Id = Guid.CreateVersion7(),
                    TenantId = appointment.TenantId,
                    FirstName = firstName,
                    LastName = lastName,
                    Phone = phone,
                    PhoneDigits = digits,
                    Email = email,
                    CreatedAt = now,
                    UpdatedAt = now,
                };
            }

            appointment.TenantCustomerId = appointment.TenantCustomer.Id;
        }

        return appointment.Customer is null && appointment.TenantCustomer is null
            ? ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.CustomerNotFound, "Customer not found.")
            : null;
    }

    /// <summary>The business can always cancel a confirmed appointment; the customer is notified.</summary>
    public async Task<ServiceResult<AdminAppointmentDto>> CancelAsync(Guid id, string? reason, CancellationToken cancellationToken)
    {
        var (appointment, failure) = await LoadAsync(id, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        if (appointment!.Status != AppointmentStatus.Confirmed)
        {
            return InvalidStatus();
        }

        var now = timeProvider.GetUtcNow();
        appointment.Status = AppointmentStatus.CancelledByBusiness;
        appointment.CancellationReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        appointment.UpdatedAt = now;

        var saved = await SaveAsync(cancellationToken);
        if (saved is not null)
        {
            return saved;
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var contact = CustomerContact.Of(appointment);
        if (appointment.StartUtc > now && contact.NotifyEmail(appointment) is { } to)
        {
            await TrySendAsync(EmailTemplates.AppointmentCancelledByBusiness(
                to,
                contact.FirstName,
                tenant.Name,
                appointment.Service.Name,
                DateFormatting.LongItalian(appointment.StartUtc, timeZone),
                appointment.CancellationReason,
                $"{BaseUrl}/b/{tenant.Slug}"), cancellationToken);
        }

        return ServiceResult<AdminAppointmentDto>.Ok(ToDto(appointment, timeZone, now));
    }

    /// <summary>Completed or NoShow, only once the appointment has started. Final states.</summary>
    public async Task<ServiceResult<AdminAppointmentDto>> MarkAsync(Guid id, AppointmentStatus status, CancellationToken cancellationToken)
    {
        if (status is not (AppointmentStatus.Completed or AppointmentStatus.NoShow))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        var (appointment, failure) = await LoadAsync(id, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        if (appointment!.Status != AppointmentStatus.Confirmed)
        {
            return InvalidStatus();
        }

        var now = timeProvider.GetUtcNow();
        if (appointment.StartUtc > now)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status422UnprocessableEntity, ErrorCodes.NotStarted, "The appointment has not started yet.");
        }

        appointment.Status = status;
        appointment.UpdatedAt = now;
        var saved = await SaveAsync(cancellationToken);
        if (saved is not null)
        {
            return saved;
        }

        var timeZoneId = await db.Tenants.Where(t => t.Id == admin.TenantId).Select(t => t.TimeZone).SingleAsync(cancellationToken);
        return ServiceResult<AdminAppointmentDto>.Ok(ToDto(appointment, TimeZoneInfo.FindSystemTimeZoneById(timeZoneId), now));
    }

    private async Task<(Appointment? Appointment, ServiceResult<AdminAppointmentDto>? Failure)> LoadAsync(Guid id, CancellationToken cancellationToken)
    {
        // The tenant filter makes another tenant's appointment simply "not found".
        var appointment = await db.Appointments
            .Include(a => a.Service)
            .Include(a => a.Customer)
            .Include(a => a.TenantCustomer)
            .Include(a => a.StaffMember)
            .SingleOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (appointment is null)
        {
            return (null, ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.AppointmentNotFound, "Appointment not found."));
        }

        return !admin.IsOwner && appointment.StaffMember.UserId != admin.UserId
            ? (null, StaffScope())
            : (appointment, null);
    }

    private async Task<bool> IsWithinWorkingHoursAsync(
        Guid staffId, DateOnly date, DateTimeOffset start, DateTimeOffset end, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        var hours = await db.WorkingHours.AsNoTracking()
            .Where(w => w.StaffMemberId == staffId && w.DayOfWeek == date.DayOfWeek)
            .ToListAsync(cancellationToken);

        return hours.Any(h =>
            AvailabilityCalculator.ToUtc(date, h.StartLocal, timeZone, roundUpIfInvalid: true) <= start
            && end <= AvailabilityCalculator.ToUtc(date, h.EndLocal, timeZone, roundUpIfInvalid: true));
    }

    private async Task<ServiceResult<AdminAppointmentDto>?> SaveAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status409Conflict, ErrorCodes.ConcurrentUpdate, "The appointment was changed meanwhile: reload and retry.");
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.ExclusionViolation, ConstraintName: AppointmentConfiguration.NoOverlapConstraint,
        })
        {
            return ServiceResult<AdminAppointmentDto>.Fail(
                StatusCodes.Status409Conflict, ErrorCodes.SlotUnavailable, "Another appointment is already booked at that time.");
        }
    }

    private static AdminAppointmentDto ToDto(Appointment a, TimeZoneInfo timeZone, DateTimeOffset now)
    {
        var confirmed = a.Status == AppointmentStatus.Confirmed;
        return new AdminAppointmentDto(
            a.Id,
            a.StaffMemberId,
            a.ServiceId,
            a.Service.Name,
            TimeZoneInfo.ConvertTime(a.StartUtc, timeZone),
            TimeZoneInfo.ConvertTime(a.EndUtc, timeZone),
            TimeZoneInfo.ConvertTime(a.BlockedUntilUtc, timeZone),
            a.Status.ToString(),
            a.Origin.ToString(),
            a.CustomerNote,
            a.CancellationReason,
            a.Service.PriceCents,
            a.Service.PriceIsFrom,
            ToCustomerDto(a, CustomerContact.Of(a)),
            CanMove: confirmed && a.StartUtc > now,
            CanCancel: confirmed,
            CanMark: confirmed && a.StartUtc <= now);
    }

    private static CalendarCustomerDto ToCustomerDto(Appointment a, CustomerContact c) =>
        new(c.FirstName, c.LastName, c.Email, c.Phone, c.HasAccount, RebookId(a));

    /// <summary>Who "Prenota di nuovo" books for (DEC-044): the same rules as the customer search.</summary>
    private static Guid? RebookId(Appointment a) =>
        a.Customer is { } user ? (user.DeletedAt is null ? user.Id : null)
        : a.TenantCustomer is { AnonymizedAt: null } entry ? entry.Id
        : null;

    /// <summary>Customers with an account manage their bookings; the others get the business's page.</summary>
    private string CustomerLink(CustomerContact contact, Tenant tenant) =>
        contact.HasAccount ? $"{BaseUrl}/account/appuntamenti" : $"{BaseUrl}/b/{tenant.Slug}";

    private static ServiceResult<AdminAppointmentDto> InvalidStatus() =>
        ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.InvalidStatus, "Only confirmed appointments can be changed.");

    private static ServiceResult<AdminAppointmentDto> StaffScope() =>
        ServiceResult<AdminAppointmentDto>.Fail(StatusCodes.Status403Forbidden, ErrorCodes.StaffScope, "Staff members can only manage their own appointments.");

    private string BaseUrl => appOptions.Value.PublicBaseUrl.TrimEnd('/');

    private async Task TrySendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // The change stands even if the email fails (booking-domain: notifications).
            logger.LogError(exception, "Sending email {EmailKind} failed", message.Kind);
        }
    }
}
