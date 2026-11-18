namespace Bookly.Api.Entities;

public class TenantMembership : ITenantOwned
{
    public Guid TenantId { get; set; }

    public Guid UserId { get; set; }

    public TenantRole Role { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public AppUser User { get; set; } = null!;
}
