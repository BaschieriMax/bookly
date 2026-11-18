using Bookly.Api.Services.Availability;

namespace Bookly.Api.UnitTests;

/// <summary>Cases from the booking-domain skill checklist.</summary>
public sealed class AvailabilityCalculatorTests
{
    private static readonly TimeZoneInfo Rome = TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome");
    private static readonly Guid StaffA = Guid.Parse("00000000-0000-0000-0000-00000000000a");
    private static readonly Guid StaffB = Guid.Parse("00000000-0000-0000-0000-00000000000b");

    // Tuesday 2 March 2027 (winter time, UTC+1).
    private static readonly DateOnly Day = new(2027, 3, 2);

    private static WorkingInterval Hours(int fromHour, int fromMinute, int toHour, int toMinute) =>
        new(new TimeOnly(fromHour, fromMinute), new TimeOnly(toHour, toMinute));

    private static DateTimeOffset Local(DateOnly date, int hour, int minute) =>
        AvailabilityCalculator.ToUtc(date, new TimeOnly(hour, minute), Rome, roundUpIfInvalid: false)!.Value;

    private static AvailabilityRequest Request(
        IReadOnlyList<StaffDay> staff,
        DateOnly? date = null,
        int interval = 15,
        int duration = 30,
        int buffer = 10,
        DateTimeOffset? notBefore = null,
        DateTimeOffset? notAfter = null) =>
        new(date ?? Day, Rome, interval, duration, buffer,
            notBefore ?? DateTimeOffset.MinValue, notAfter ?? DateTimeOffset.MaxValue, staff);

    private static StaffDay Staff(Guid id, IReadOnlyList<WorkingInterval> hours, params TimeRange[] busy) => new(id, hours, busy);

    private static string[] LocalTimes(IEnumerable<AvailableSlot> slots) =>
        [.. slots.Select(s => TimeZoneInfo.ConvertTime(s.StartUtc, Rome).ToString("HH:mm"))];

    [Fact]
    public void Slots_are_aligned_to_the_interval_and_the_whole_block_fits_in_the_working_hours()
    {
        var slots = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 10, 0)])]));

        // 30 min + 10 min buffer must end by 10:00: last start 09:15 (09:30 would end at 10:10).
        Assert.Equal(["09:00", "09:15"], LocalTimes(slots));
    }

    [Fact]
    public void Lunch_break_splits_the_day_and_no_slot_crosses_it()
    {
        var slots = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 13, 0), Hours(14, 30, 19, 0)])]));

        var times = LocalTimes(slots);
        Assert.Contains("12:15", times);
        Assert.DoesNotContain("12:30", times); // would end 13:10, inside the break
        Assert.DoesNotContain("14:00", times);
        Assert.Equal("14:30", times.First(t => string.CompareOrdinal(t, "13:00") > 0));
        Assert.Equal("18:15", times[^1]);
    }

    [Fact]
    public void Buffer_is_part_of_the_block_but_not_of_the_customer_duration()
    {
        var withBuffer = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 9, 40)])], buffer: 10));
        var tooLong = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 9, 35)])], buffer: 10));

        Assert.Equal(["09:00"], LocalTimes(withBuffer));
        Assert.Empty(tooLong);
    }

    [Fact]
    public void Partial_time_off_removes_only_overlapping_slots()
    {
        var timeOff = new TimeRange(Local(Day, 10, 0), Local(Day, 11, 0));

        var slots = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 12, 0)], timeOff)]));

        var times = LocalTimes(slots);
        Assert.Contains("09:15", times);    // 09:15–09:55
        Assert.DoesNotContain("09:30", times); // 09:30–10:10 overlaps
        Assert.DoesNotContain("10:45", times);
        Assert.Contains("11:00", times);
    }

    [Fact]
    public void A_slot_may_start_exactly_when_a_busy_range_ends()
    {
        var appointment = new TimeRange(Local(Day, 9, 0), Local(Day, 9, 40)); // 30 min + 10 buffer

        var slots = AvailabilityCalculator.Compute(Request([Staff(StaffA, [Hours(9, 0, 11, 0)], appointment)], interval: 5));

        Assert.Equal("09:40", LocalTimes(slots)[0]);
    }

    [Fact]
    public void Minimum_notice_and_horizon_are_respected()
    {
        var slots = AvailabilityCalculator.Compute(Request(
            [Staff(StaffA, [Hours(9, 0, 12, 0)])],
            notBefore: Local(Day, 10, 0),
            notAfter: Local(Day, 10, 30)));

        Assert.Equal(["10:00", "10:15", "10:30"], LocalTimes(slots));
    }

    [Fact]
    public void Any_staff_is_the_union_with_the_free_staff_for_each_start()
    {
        var slots = AvailabilityCalculator.Compute(Request(
            [Staff(StaffA, [Hours(9, 0, 10, 0)]), Staff(StaffB, [Hours(9, 30, 10, 30)])],
            interval: 30,
            buffer: 0));

        Assert.Equal(["09:00", "09:30", "10:00"], LocalTimes(slots));
        Assert.Equal([StaffA], slots[0].StaffIds);
        Assert.Equal([StaffA, StaffB], slots[1].StaffIds);
        Assert.Equal([StaffB], slots[2].StaffIds);
    }

    [Fact]
    public void Day_without_working_hours_has_no_slots()
    {
        Assert.Empty(AvailabilityCalculator.Compute(Request([Staff(StaffA, [])])));
    }

    [Fact]
    public void Spring_forward_skips_the_missing_hour_without_duplicates()
    {
        // Sunday 28 March 2027: 02:00 → 03:00 in Europe/Rome.
        var springDay = new DateOnly(2027, 3, 28);

        var slots = AvailabilityCalculator.Compute(Request(
            [Staff(StaffA, [Hours(0, 0, 5, 0)])], date: springDay, interval: 30, duration: 30, buffer: 0));

        var times = LocalTimes(slots);
        Assert.DoesNotContain("02:00", times);
        Assert.DoesNotContain("02:30", times);
        Assert.Equal(["00:00", "00:30", "01:00", "01:30", "03:00", "03:30", "04:00", "04:30"], times);
        Assert.Equal(slots.Count, slots.Select(s => s.StartUtc).Distinct().Count());
        // 01:30 (UTC+1) and 03:00 (UTC+2) are consecutive instants: 00:30Z and 01:00Z.
        Assert.Equal(TimeSpan.FromMinutes(30), slots[4].StartUtc - slots[3].StartUtc);
    }

    [Fact]
    public void Fall_back_offers_each_local_time_once()
    {
        // Sunday 31 October 2027: 03:00 → 02:00 in Europe/Rome, 02:xx happens twice.
        var autumnDay = new DateOnly(2027, 10, 31);

        var slots = AvailabilityCalculator.Compute(Request(
            [Staff(StaffA, [Hours(0, 0, 5, 0)])], date: autumnDay, interval: 30, duration: 30, buffer: 0));

        var times = LocalTimes(slots);
        Assert.Equal(times.Length, times.Distinct().Count());
        Assert.Equal(slots.Count, slots.Select(s => s.StartUtc).Distinct().Count());
        Assert.Contains("02:00", times);
        Assert.Equal(10, times.Length);
    }

    [Fact]
    public void Local_day_range_has_23_and_25_hours_on_dst_days()
    {
        var spring = AvailabilityCalculator.LocalDayInUtc(new DateOnly(2027, 3, 28), Rome);
        var autumn = AvailabilityCalculator.LocalDayInUtc(new DateOnly(2027, 10, 31), Rome);

        Assert.Equal(TimeSpan.FromHours(23), spring.End - spring.Start);
        Assert.Equal(TimeSpan.FromHours(25), autumn.End - autumn.Start);
    }
}
