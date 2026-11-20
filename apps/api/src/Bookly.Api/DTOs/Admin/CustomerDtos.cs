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

/// <summary>An appointment of a customer at this business, newest first.</summary>
public sealed record CustomerAppointmentDto(Guid Id, DateTimeOffset Start, string ServiceName, string StaffName, string Status, string Origin);

/// <summary>A customer with their appointments here. CreatedAt: when they entered the address book.</summary>
public sealed record CustomerDetailDto(
    string Kind,
    Guid Id,
    string FirstName,
    string LastName,
    string? Phone,
    string? Email,
    DateTimeOffset? CreatedAt,
    IReadOnlyList<CustomerAppointmentDto> Appointments);

/// <summary>Correction of an address-book entry; same rules as a new customer.</summary>
public sealed record UpdateCustomerRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, MaxLength(30), RegularExpression(@"^(?=(?:\D*\d){6})\+?[0-9\s./()-]+$")] string Phone,
    [MaxLength(256), EmailAddress] string? Email);

/// <summary>How many future appointments the erasure cancelled.</summary>
public sealed record EraseCustomerResultDto(int CancelledAppointments);
