using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Tenancy;

/// <summary>
/// Resolves the tenant of a public route from its slug. Unknown or suspended tenants are null
/// (the API answers 404). On success the tenant is set on <see cref="TenantContext"/>.
/// </summary>
public sealed class PublicTenantResolver(AppDbContext db, TenantContext tenantContext)
{
    public async Task<Tenant?> ResolveAsync(string slug, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants
            .AsNoTracking()
            .SingleOrDefaultAsync(t => t.Slug == slug && t.Status == TenantStatus.Active, cancellationToken);

        if (tenant is not null)
        {
            tenantContext.SetTenant(tenant.Id);
        }

        return tenant;
    }
}
