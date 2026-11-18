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

        if (oldStart != newStart)
        {
            await TrySendAsync(EmailTemplates.AppointmentMovedByBusiness(
                appointment.Customer.Email!,
                appointment.Customer.FirstName,
                tenant.Name,
                appointment.Service.Name,
                DateFormatting.LongItalian(oldStart, timeZone),
                DateFormatting.LongItalian(newStart, timeZone),
                $"{BaseUrl}/account/appuntamenti"), cancellationToken);
        }

        return ServiceResult<AdminAppointmentDto>.Ok(ToDto(appointment, timeZone, now));
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
        if (appointment.StartUtc > now)
        {
            await TrySendAsync(EmailTemplates.AppointmentCancelledByBusiness(
                appointment.Customer.Email!,
                appointment.Customer.FirstName,
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
            a.CustomerNote,
            a.CancellationReason,
            a.Service.PriceCents,
            a.Service.PriceIsFrom,
            a.Customer.DeletedAt is null
                ? new CalendarCustomerDto(a.Customer.FirstName, a.Customer.LastName, a.Customer.Email, a.Customer.PhoneNumber)
                : new CalendarCustomerDto(a.Customer.FirstName, a.Customer.LastName, null, null),
            CanMove: confirmed && a.StartUtc > now,
            CanCancel: confirmed,
            CanMark: confirmed && a.StartUtc <= now);
    }

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
            logger.LogError(exception, "Sending email '{Subject}' failed", message.Subject);
        }
    }
}
