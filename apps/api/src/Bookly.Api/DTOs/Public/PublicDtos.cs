namespace Bookly.Api.DTOs.Public;

public sealed record TenantBrandDto(string? PrimaryColor, string Ground, string HeadingFont, bool HasLogo, bool HasHomeIcon);

/// <summary>Web app manifest of a tenant page (DEC-043): name, scope and home-screen icons.</summary>
public sealed record WebAppManifestDto(
    string Name,
    [property: System.Text.Json.Serialization.JsonPropertyName("short_name")] string ShortName,
    string Lang,
    [property: System.Text.Json.Serialization.JsonPropertyName("start_url")] string StartUrl,
    string Scope,
    string Display,
    IReadOnlyList<WebAppManifestIconDto> Icons);

public sealed record WebAppManifestIconDto(
    string Src,
    string Sizes,
    string Type,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Purpose);

public sealed record PublicTenantDto(
    string Slug,
    string Name,
    string? Phone,
    string? Address,
    string TimeZone,
    int CancellationWindowHours,
    int BookingHorizonDays,
    TenantBrandDto Brand);

public sealed record PublicStaffDto(Guid Id, string DisplayName);

public sealed record PublicServiceDto(
    Guid Id,
    string Name,
    string? Description,
    int DurationMinutes,
    int? PriceCents,
    bool PriceIsFrom,
    IReadOnlyList<PublicStaffDto> Staff);

/// <summary>Slot start in the tenant's local offset, e.g. 2027-03-02T09:30:00+01:00.</summary>
public sealed record PublicSlotDto(DateTimeOffset Start);

public sealed record PublicAvailabilityDto(DateOnly Date, string TimeZone, IReadOnlyList<PublicSlotDto> Slots);

public sealed record PublicDayDto(DateOnly Date, bool Available);

public sealed record PublicDaysDto(string TimeZone, IReadOnlyList<PublicDayDto> Days);
