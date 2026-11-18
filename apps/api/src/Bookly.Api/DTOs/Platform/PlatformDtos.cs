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
    int ServiceCount);

public sealed record CreateTenantRequest(
    [Required, MaxLength(120)] string Name,
    [Required, MaxLength(40)] string Slug,
    [Required, MaxLength(64)] string TimeZone,
    [Required, EmailAddress, MaxLength(256)] string OwnerEmail,
    [Required, MaxLength(100)] string OwnerFirstName,
    [Required, MaxLength(100)] string OwnerLastName);

public sealed record SetTenantStatusRequest([Required, RegularExpression("^(Active|Suspended)$")] string Status);

public sealed record InviteOwnerRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName);
