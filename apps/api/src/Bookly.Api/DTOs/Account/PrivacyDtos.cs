using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Account;

public sealed record ProfileDto(string Email, string FirstName, string LastName, string? PhoneNumber, DateTimeOffset CreatedAt);

/// <summary>Rectification (GDPR art. 16). The email is the login: changing it is not self-service yet.</summary>
public sealed record UpdateProfileRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Phone, MaxLength(30)] string? PhoneNumber);

/// <summary>Deleting the account asks for the password again (re-authentication).</summary>
public sealed record DeleteAccountRequest([Required, MaxLength(128)] string Password);

public sealed record ExportAccountDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    string? PhoneNumber,
    bool EmailConfirmed,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PrivacyAcceptedAt);

public sealed record ExportMembershipDto(string Tenant, string Role);

public sealed record ExportAppointmentDto(
    string Tenant,
    string Service,
    string Staff,
    DateTimeOffset Start,
    DateTimeOffset End,
    string Status,
    string? Note,
    string? CancellationReason,
    DateTimeOffset CreatedAt);

/// <summary>Data portability (GDPR art. 20): everything Bookly stores about the user, as JSON.</summary>
public sealed record DataExportDto(
    DateTimeOffset ExportedAt,
    ExportAccountDto Account,
    IReadOnlyList<ExportMembershipDto> Memberships,
    IReadOnlyList<ExportAppointmentDto> Appointments);
