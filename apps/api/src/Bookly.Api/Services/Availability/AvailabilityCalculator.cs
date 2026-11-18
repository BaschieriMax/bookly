namespace Bookly.Api.Services.Availability;

/// <summary>
/// Pure slot calculation (booking-domain skill, DEC-009). No I/O and no clock: everything comes in
/// through <see cref="AvailabilityRequest"/>, so every rule is unit-testable.
///
/// A start time S is offered for a staff member when:
/// - S is aligned to the slot interval from the start of a working interval (local time);
/// - [S, S + duration + buffer) fits inside that working interval;
/// - it overlaps no busy range (time off, confirmed appointment incl. its buffer);
/// - NotBefore ≤ S ≤ NotAfter (minimum notice and booking horizon).
///
/// Daylight saving time: local times are converted per date. Times that do not exist (spring
/// forward gap) are skipped; ambiguous times (autumn fall back) use the standard offset, so a
/// local time is offered once and never twice.
/// </summary>
public static class AvailabilityCalculator
{
    public static IReadOnlyList<AvailableSlot> Compute(AvailabilityRequest request)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(request.SlotIntervalMinutes, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(request.DurationMinutes, 1);

        var block = TimeSpan.FromMinutes(request.DurationMinutes + request.BufferMinutes);
        var slots = new SortedDictionary<DateTimeOffset, List<Guid>>();

        foreach (var staff in request.Staff)
        {
            foreach (var hours in staff.Hours.OrderBy(h => h.Start))
            {
                var intervalEnd = ToUtc(request.Date, hours.End, request.TimeZone, roundUpIfInvalid: true)!.Value;
                var firstMinute = (int)hours.Start.ToTimeSpan().TotalMinutes;
                var lastMinute = (int)hours.End.ToTimeSpan().TotalMinutes;

                for (var minute = firstMinute; minute < lastMinute; minute += request.SlotIntervalMinutes)
                {
                    var local = TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(minute));
                    var start = ToUtc(request.Date, local, request.TimeZone, roundUpIfInvalid: false);
                    if (start is not { } startUtc)
                    {
                        continue; // does not exist on this date (DST gap)
                    }

                    var end = startUtc + block;
                    if (end > intervalEnd
                        || startUtc < request.NotBefore
                        || startUtc > request.NotAfter
                        || staff.Busy.Any(busy => busy.Overlaps(startUtc, end)))
                    {
                        continue;
                    }

                    if (!slots.TryGetValue(startUtc, out var staffIds))
                    {
                        staffIds = [];
                        slots[startUtc] = staffIds;
                    }

                    if (!staffIds.Contains(staff.StaffId))
                    {
                        staffIds.Add(staff.StaffId);
                    }
                }
            }
        }

        return [.. slots.Select(s => new AvailableSlot(s.Key, s.Value))];
    }

    /// <summary>UTC instant of a local wall-clock time on a date, or null if it does not exist.</summary>
    public static DateTimeOffset? ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo timeZone, bool roundUpIfInvalid)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);

        if (timeZone.IsInvalidTime(local))
        {
            if (!roundUpIfInvalid)
            {
                return null;
            }

            // An interval ending inside the gap ends at the first valid instant after it.
            do
            {
                local = local.AddMinutes(1);
            }
            while (timeZone.IsInvalidTime(local));
        }

        // For ambiguous times GetUtcOffset returns the standard offset (the second occurrence).
        var offset = timeZone.GetUtcOffset(local);
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    /// <summary>UTC range covering a whole local day [00:00, next day 00:00).</summary>
    public static TimeRange LocalDayInUtc(DateOnly date, TimeZoneInfo timeZone) =>
        new(ToUtc(date, TimeOnly.MinValue, timeZone, roundUpIfInvalid: true)!.Value,
            ToUtc(date.AddDays(1), TimeOnly.MinValue, timeZone, roundUpIfInvalid: true)!.Value);
}
