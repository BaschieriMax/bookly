namespace Bookly.Api.Services.Availability;

/// <summary>Recurring working interval in the tenant's local time.</summary>
public sealed record WorkingInterval(TimeOnly Start, TimeOnly End);

/// <summary>Half-open absolute interval [Start, End).</summary>
public sealed record TimeRange(DateTimeOffset Start, DateTimeOffset End)
{
    public bool Overlaps(DateTimeOffset start, DateTimeOffset end) => Start < end && start < End;
}

/// <summary>One staff member on one day: working intervals plus busy ranges (time off, confirmed appointments).</summary>
public sealed record StaffDay(Guid StaffId, IReadOnlyList<WorkingInterval> Hours, IReadOnlyList<TimeRange> Busy);

public sealed record AvailabilityRequest(
    DateOnly Date,
    TimeZoneInfo TimeZone,
    int SlotIntervalMinutes,
    int DurationMinutes,
    int BufferMinutes,
    DateTimeOffset NotBefore,
    DateTimeOffset NotAfter,
    IReadOnlyList<StaffDay> Staff);

/// <summary>A bookable start time and the staff members free at that time.</summary>
public sealed record AvailableSlot(DateTimeOffset StartUtc, IReadOnlyList<Guid> StaffIds);
