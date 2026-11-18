using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Booking;

public sealed record CreateAppointmentRequest(
    [Required] Guid ServiceId,
    Guid? StaffId,
    [Required] DateTimeOffset Start,
    [MaxLength(500)] string? Note);

public sealed record AppointmentTenantDto(string Slug, string Name, string? Phone, string? Address, string? PrimaryColor, string TimeZone);

/// <summary>Appointment as seen by its customer. Times are in the tenant's local offset.</summary>
public sealed record MyAppointmentDto(
    Guid Id,
    AppointmentTenantDto Tenant,
    string ServiceName,
    int DurationMinutes,
    int? PriceCents,
    bool PriceIsFrom,
    string StaffName,
    DateTimeOffset Start,
    DateTimeOffset End,
    string Status,
    string? Note,
    bool CanCancel,
    DateTimeOffset CancelDeadline);
