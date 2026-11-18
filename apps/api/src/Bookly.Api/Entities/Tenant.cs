namespace Bookly.Api.Entities;

public class Tenant
{
    public Guid Id { get; set; }

    /// <summary>URL identifier, e.g. "barberia-demo" in /b/barberia-demo.</summary>
    public required string Slug { get; set; }

    public required string Name { get; set; }

    /// <summary>IANA time zone used to interpret working hours (e.g. "Europe/Rome").</summary>
    public string TimeZone { get; set; } = "Europe/Rome";

    public TenantStatus Status { get; set; } = TenantStatus.Active;

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public int CancellationWindowHours { get; set; } = 12;

    public int SlotIntervalMinutes { get; set; } = 15;

    /// <summary>Primary brand color as #RRGGBB; null means the Bookly default.</summary>
    public string? BrandPrimaryColor { get; set; }

    public TenantGround BrandGround { get; set; } = TenantGround.Light;

    public TenantHeadingFont BrandHeadingFont { get; set; } = TenantHeadingFont.Sans;

    public DateTimeOffset CreatedAt { get; set; }

    public TenantLogo? Logo { get; set; }
}
