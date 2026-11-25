using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Admin;

/// <summary>
/// HasAccount false: the customer is in the business's address book (DEC-037). Id is the account
/// or the address-book entry to book again with (DEC-044); null once the account is deleted or
/// the entry erased, because a new appointment can no longer be made for them.
/// </summary>
public sealed record CalendarCustomerDto(string FirstName, string LastName, string? Email, string? Phone, bool HasAccount, Guid? Id);

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
    /// <summary>Online (booked by the customer) or Business (entered from the calendar).</summary>
    string Origin,
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

/// <summary>A customer the business types in: saved in its address book (DEC-037).</summary>
public sealed record NewCustomerRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    // At least 6 digits; spaces, dots, dashes, brackets and a leading + allowed.
    [Required, MaxLength(30), RegularExpression(@"^(?=(?:\D*\d){6})\+?[0-9\s./()-]+$")] string Phone,
    [MaxLength(256), EmailAddress] string? Email);

/// <summary>
/// An appointment entered by the business (phone, walk-in). Exactly one customer: an account that
/// already booked with the business, an address-book entry or a new one. Local date and time in
/// the tenant's time zone. Outside working hours or during time off needs AllowOutsideHours.
/// </summary>
public sealed record CreateBusinessAppointmentRequest(
    [Required] Guid ServiceId,
    [Required] Guid StaffId,
    [Required] DateOnly Date,
    [Required] TimeOnly Time,
    Guid? CustomerAccountId,
    Guid? TenantCustomerId,
    NewCustomerRequest? NewCustomer,
    [MaxLength(500)] string? Note,
    bool NotifyCustomer,
    bool AllowOutsideHours);

/// <summary>Kind: "Account" (a customer who booked online) or "AddressBook" (DEC-037).</summary>
public sealed record CustomerSearchResultDto(string Kind, Guid Id, string FirstName, string LastName, string? Phone, string? Email);
