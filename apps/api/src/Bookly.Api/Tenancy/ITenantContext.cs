namespace Bookly.Api.Tenancy;

/// <summary>
/// Tenant of the current request. Set by the tenant resolution middleware (slug for public routes,
/// membership claim for admin routes). Null means "no tenant": tenant-owned queries return nothing.
/// </summary>
public interface ITenantContext
{
    Guid? TenantId { get; }
}

public sealed class TenantContext : ITenantContext
{
    public Guid? TenantId { get; private set; }

    public void SetTenant(Guid tenantId)
    {
        if (TenantId is not null && TenantId != tenantId)
        {
            throw new InvalidOperationException("The tenant of a request cannot change once set.");
        }

        TenantId = tenantId;
    }
}
