using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Platform;

/// <summary>An owner of a tenant; Pending = invited, password not set yet.</summary>
public sealed record PlatformOwnerDto(Guid UserId, string Email, string FirstName, string LastName, bool Pending);

/// <summary>
/// A tenant as the platform sees it. Only aggregate counts: the super-admin manages tenants but does
/// not read their appointments or customers (booking-domain: data minimisation).
/// </summary>
public sealed record PlatformTenantDto(
    Guid Id,
    string Slug,
    string Name,
    string Status,
    string TimeZone,
    DateTimeOffset CreatedAt,
    IReadOnlyList<PlatformOwnerDto> Owners,
    int StaffCount,
    int ServiceCount,
    PlatformSuspensionNoticesDto? SuspensionNotices = null);

/// <summary>
/// Progress of the emails of the latest suspension that cancelled appointments (DEC-039); only
/// while the tenant is suspended. Counts only, never who.
/// </summary>
/// <param name="Customers">Customer emails to send (one per customer).</param>
/// <param name="Sent">Customer emails sent.</param>
/// <param name="NotSent">Customer emails given up on (address erased, too many failures).</param>
/// <param name="OwnerSummaries">Summary emails to the owners.</param>
/// <param name="OwnerSummariesSent">Summary emails sent.</param>
/// <param name="State">Sending, PausedDailyLimit (resumes the next day), Retrying (after an error) or Done.</param>
public sealed record PlatformSuspensionNoticesDto(
    int CancelledAppointments,
    int Customers,
    int Sent,
    int NotSent,
    int OwnerSummaries,
    int OwnerSummariesSent,
    string State);

/// <summary>Future confirmed appointments of a tenant: only the number (data minimisation).</summary>
public sealed record FutureAppointmentsDto(int Count);

public sealed record CreateTenantRequest(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(40)] string Slug,
    [Required, MaxLength(64)] string TimeZone,
    [Required, EmailAddress, MaxLength(256)] string OwnerEmail,
    [Required, MaxLength(100)] string OwnerFirstName,
    [Required, MaxLength(100)] string OwnerLastName);

/// <param name="CancelFutureAppointments">
/// Only with Suspended: also cancel the future confirmed appointments and email their customers
/// and the owners in the background (DEC-039).
/// </param>
public sealed record SetTenantStatusRequest(
    [Required, RegularExpression("^(Active|Suspended)$")] string Status,
    bool CancelFutureAppointments = false);

public sealed record InviteOwnerRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName);
