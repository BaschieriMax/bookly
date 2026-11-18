using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Admin;

public sealed record CalendarCustomerDto(string FirstName, string LastName, string? Email, string? Phone);

/// <summary>An appointment as the business sees it. Instants carry the tenant's offset.</summary>
public sealed record AdminAppointmentDto(
    Guid Id,
    Guid StaffId,
    Guid ServiceId,
    string ServiceName,
    DateTimeOffset Start,
    DateTimeOffset End,
    DateTimeOffset BlockedUntil,
    string Status,
    string? CustomerNote,
    string? CancellationReason,
    int? PriceCents,
    bool PriceIsFrom,
    CalendarCustomerDto Customer,
    bool CanMove,
    bool CanCancel,
    bool CanMark);

public sealed record CalendarStaffDto(Guid Id, string DisplayName, bool IsActive, bool IsMe);

public sealed record CalendarHoursDto(Guid StaffId, int DayOfWeek, TimeOnly Start, TimeOnly End);

public sealed record CalendarTimeOffDto(Guid Id, Guid StaffId, DateTimeOffset Start, DateTimeOffset End, string? Reason);

/// <summary>Everything the calendar needs for a range of local days, in one request.</summary>
public sealed record CalendarDto(
    string TimeZone,
    DateOnly From,
    DateOnly To,
    IReadOnlyList<CalendarStaffDto> Staff,
    IReadOnlyList<CalendarHoursDto> WorkingHours,
    IReadOnlyList<CalendarTimeOffDto> TimeOff,
    IReadOnlyList<AdminAppointmentDto> Appointments);

/// <summary>New local date and time in the tenant's time zone; optionally another staff member.</summary>
public sealed record MoveAppointmentRequest(
    [Required] DateOnly Date,
    [Required] TimeOnly Time,
    Guid? StaffId);

public sealed record CancelAppointmentByBusinessRequest([MaxLength(200)] string? Reason);
