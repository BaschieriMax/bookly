namespace Bookly.Api.Entities;

/// <summary>Marks an entity that belongs to exactly one tenant and is isolated by the tenant query filter.</summary>
public interface ITenantOwned
{
    Guid TenantId { get; }
}
