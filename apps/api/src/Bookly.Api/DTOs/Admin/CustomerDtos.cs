using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Admin;

/// <summary>
/// One row of the "Clienti" page (DEC-038). Kind: "Account" (booked online, read-only here) or
/// "AddressBook" (entered by the business). Dates in the tenant's time zone.
/// </summary>
public sealed record CustomerListItemDto(
    string Kind,
    Guid Id,
    string FirstName,
    string LastName,
    string? Phone,
    string? Email,
    int Appointments,
    DateTimeOffset? LastVisit,
    DateTimeOffset? NextAppointment);

public sealed record CustomerListDto(int Total, int Page, int PageSize, IReadOnlyList<CustomerListItemDto> Items);

/// <summary>An appointment of a customer at this business. Start in the tenant's time zone.</summary>
public sealed record CustomerAppointmentDto(Guid Id, DateTimeOffset Start, string ServiceName, string StaffName, string Status, string Origin);

/// <summary>
/// The numbers on top of the "Appuntamenti" tab. Upcoming / Past split by start time; LastVisit is
/// the latest past appointment that was not cancelled or missed, NextAppointment the next confirmed one.
/// </summary>
public sealed record CustomerStatsDto(
    int Total,
    int Upcoming,
    int Past,
    int Completed,
    int NoShow,
    int Cancelled,
    DateTimeOffset? LastVisit,
    DateTimeOffset? NextAppointment);

/// <summary>
/// A customer with the summary of their appointments here. CreatedAt: when they entered the
/// address book, in the tenant's time zone.
/// </summary>
public sealed record CustomerDetailDto(
    string Kind,
    Guid Id,
    string FirstName,
    string LastName,
    string? Phone,
    string? Email,
    DateTimeOffset? CreatedAt,
    CustomerStatsDto Stats);

/// <summary>A page of a customer's appointments: upcoming soonest first, past newest first.</summary>
public sealed record CustomerAppointmentPageDto(int Total, int Page, int PageSize, IReadOnlyList<CustomerAppointmentDto> Items);

/// <summary>Correction of an address-book entry; same rules as a new customer.</summary>
public sealed record UpdateCustomerRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, MaxLength(30), RegularExpression(@"^(?=(?:\D*\d){6})\+?[0-9\s./()-]+$")] string Phone,
    [MaxLength(256), EmailAddress] string? Email);

/// <summary>How many future appointments the erasure cancelled.</summary>
public sealed record EraseCustomerResultDto(int CancelledAppointments);
