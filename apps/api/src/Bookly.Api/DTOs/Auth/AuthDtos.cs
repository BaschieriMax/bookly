using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Auth;

public sealed record RegisterRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MinLength(10), MaxLength(128)] string Password,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Phone, MaxLength(30)] string? PhoneNumber,
    [Range(typeof(bool), "true", "true", ErrorMessage = "Privacy policy must be accepted.")] bool AcceptPrivacy);

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(128)] string Password,
    bool RememberMe);

public sealed record EmailRequest([Required, EmailAddress, MaxLength(256)] string Email);

public sealed record ConfirmEmailRequest(
    [Required] Guid UserId,
    [Required, MaxLength(2048)] string Token);

public sealed record ResetPasswordRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(2048)] string Token,
    [Required, MinLength(10), MaxLength(128)] string NewPassword);

public sealed record MembershipDto(Guid TenantId, string TenantSlug, string TenantName, string Role);

public sealed record MeResponse(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    bool EmailConfirmed,
    IReadOnlyList<string> PlatformRoles,
    IReadOnlyList<MembershipDto> Memberships);
