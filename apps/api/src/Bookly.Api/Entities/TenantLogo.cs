namespace Bookly.Api.Entities;

/// <summary>Tenant logo stored in the database (PNG/WebP only, max 200 KB — assumption A9).</summary>
public class TenantLogo
{
    public Guid TenantId { get; set; }

    public required string ContentType { get; set; }

    public required byte[] Data { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
