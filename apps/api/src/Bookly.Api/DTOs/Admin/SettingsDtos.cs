using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Admin;

public sealed record TenantSettingsDto(
    string Slug,
    string Name,
    string? Phone,
    string? Address,
    string TimeZone,
    int CancellationWindowHours,
    int SlotIntervalMinutes,
    int MinNoticeMinutes,
    int BookingHorizonDays);

public sealed record SaveTenantSettingsRequest(
    [Required, MaxLength(120)] string Name,
    [Phone, MaxLength(30)] string? Phone,
    [MaxLength(200)] string? Address,
    [Required, MaxLength(64)] string TimeZone,
    [Range(0, 168)] int CancellationWindowHours,
    [Range(5, 120)] int SlotIntervalMinutes,
    [Range(0, 10_080)] int MinNoticeMinutes,
    [Range(1, 365)] int BookingHorizonDays);

public sealed record TenantBrandSettingsDto(string? PrimaryColor, string Ground, string HeadingFont, bool HasLogo);

public sealed record SaveTenantBrandRequest(
    [RegularExpression("^#[0-9a-fA-F]{6}$")] string? PrimaryColor,
    [Required, RegularExpression("^(Light|Dark)$")] string Ground,
    [Required, RegularExpression("^(Script|Serif|Sans)$")] string HeadingFont);
