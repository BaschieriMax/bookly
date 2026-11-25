namespace Bookly.Api.Entities;

/// <summary>Tenant logo stored in the database (PNG/WebP only, max 200 KB — assumption A9).</summary>
public class TenantLogo
{
    public Guid TenantId { get; set; }

    public required string ContentType { get; set; }

    public required byte[] Data { get; set; }

    /// <summary>
    /// Home-screen icon made by the browser from the logo (DEC-043): a 256×256 PNG on a solid
    /// background. Null for logos uploaded before it existed or when the browser could not make it.
    /// </summary>
    public byte[]? IconData { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
