using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Availability;

public sealed record AvailableDay(DateOnly Date, bool HasSlots);

/// <summary>Loads schedules from the database and delegates the rules to <see cref="AvailabilityCalculator"/>.</summary>
public sealed class AvailabilityService(AppDbContext db, TimeProvider timeProvider)
{
    /// <summary>Longest range accepted by <see cref="GetDaysAsync"/>.</summary>
    public const int MaxDaysPerRequest = 62;

    public static TimeZoneInfo TimeZoneOf(Tenant tenant) => TimeZoneInfo.FindSystemTimeZoneById(tenant.TimeZone);

    public DateOnly TodayFor(Tenant tenant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), TimeZoneOf(tenant)).DateTime);

    public async Task<IReadOnlyList<AvailableSlot>> GetSlotsAsync(
        Tenant tenant, Service service, Guid? staffId, DateOnly date, CancellationToken cancellationToken)
    {
        var days = await ComputeAsync(tenant, service, staffId, date, date, cancellationToken);
        return days[date];
    }

    public async Task<IReadOnlyList<AvailableDay>> GetDaysAsync(
        Tenant tenant, Service service, Guid? staffId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var days = await ComputeAsync(tenant, service, staffId, from, to, cancellationToken);
        return [.. days.Select(d => new AvailableDay(d.Key, d.Value.Count > 0))];
    }

    /// <summary>Staff members who can perform the service (optionally restricted to one).</summary>
    public Task<List<Guid>> EligibleStaffAsync(Guid serviceId, Guid? staffId, CancellationToken cancellationToken) =>
        db.StaffServices
            .Where(s => s.ServiceId == serviceId && s.StaffMember.IsActive && (staffId == null || s.StaffMemberId == staffId))
            .OrderBy(s => s.StaffMember.SortOrder).ThenBy(s => s.StaffMember.DisplayName).ThenBy(s => s.StaffMemberId)
            .Select(s => s.StaffMemberId)
            .ToListAsync(cancellationToken);

    private async Task<SortedDictionary<DateOnly, IReadOnlyList<AvailableSlot>>> ComputeAsync(
        Tenant tenant, Service service, Guid? staffId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var timeZone = TimeZoneOf(tenant);
        var now = timeProvider.GetUtcNow();
        var notBefore = now.AddMinutes(tenant.MinNoticeMinutes);
        var notAfter = now.AddDays(tenant.BookingHorizonDays);

        var staffIds = await EligibleStaffAsync(service.Id, staffId, cancellationToken);

        var rangeStart = AvailabilityCalculator.LocalDayInUtc(from, timeZone).Start;
        var rangeEnd = AvailabilityCalculator.LocalDayInUtc(to, timeZone).End;

        var hours = await db.WorkingHours
            .AsNoTracking()
            .Where(w => staffIds.Contains(w.StaffMemberId))
            .ToListAsync(cancellationToken);

        var timeOff = await db.TimeOffs
            .AsNoTracking()
            .Where(t => staffIds.Contains(t.StaffMemberId) && t.StartUtc < rangeEnd && t.EndUtc > rangeStart)
            .Select(t => new { t.StaffMemberId, t.StartUtc, t.EndUtc })
            .ToListAsync(cancellationToken);

        var appointments = await db.Appointments
            .AsNoTracking()
            .Where(a => staffIds.Contains(a.StaffMemberId)
                && a.Status == AppointmentStatus.Confirmed
                && a.StartUtc < rangeEnd
                && a.BlockedUntilUtc > rangeStart)
            .Select(a => new { a.StaffMemberId, a.StartUtc, a.BlockedUntilUtc })
            .ToListAsync(cancellationToken);

        var busyByStaff = timeOff.Select(t => (t.StaffMemberId, Range: new TimeRange(t.StartUtc, t.EndUtc)))
            .Concat(appointments.Select(a => (a.StaffMemberId, Range: new TimeRange(a.StartUtc, a.BlockedUntilUtc))))
            .ToLookup(x => x.StaffMemberId, x => x.Range);

        var result = new SortedDictionary<DateOnly, IReadOnlyList<AvailableSlot>>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var day = date;
            var staffDays = staffIds
                .Select(id => new StaffDay(
                    id,
                    [.. hours.Where(h => h.StaffMemberId == id && h.DayOfWeek == day.DayOfWeek)
                        .Select(h => new WorkingInterval(h.StartLocal, h.EndLocal))],
                    [.. busyByStaff[id]]))
                .ToList();

            result[date] = AvailabilityCalculator.Compute(new AvailabilityRequest(
                date, timeZone, tenant.SlotIntervalMinutes, service.DurationMinutes, service.BufferMinutes,
                notBefore, notAfter, staffDays));
        }

        return result;
    }
}
