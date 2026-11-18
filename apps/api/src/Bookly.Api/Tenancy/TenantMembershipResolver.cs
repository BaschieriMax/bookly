using System.Security.Claims;
using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Tenancy;

public sealed record ResolvedMembership(Guid TenantId, string TenantSlug, TenantRole Role);

/// <summary>
/// Resolves the tenant of an admin request from the authenticated user's memberships (DEC-006).
/// The client may choose among its memberships with the X-Bookly-Tenant header (tenant id);
/// the choice is always validated against the database, never trusted as is.
/// On success the tenant is set on <see cref="TenantContext"/> for the rest of the request.
/// </summary>
public sealed class TenantMembershipResolver(
    IHttpContextAccessor httpContextAccessor,
    AppDbContext db,
    TenantContext tenantContext)
{
    public const string TenantHeader = "X-Bookly-Tenant";

    private bool _resolved;
    private ResolvedMembership? _membership;

    /// <summary>The membership resolved earlier in this request (by the authorization policy), if any.</summary>
    public ResolvedMembership? Current => _membership;

    public async Task<ResolvedMembership?> ResolveAsync(CancellationToken cancellationToken = default)
    {
        if (_resolved)
        {
            return _membership;
        }

        _resolved = true;
        var httpContext = httpContextAccessor.HttpContext;
        var userIdValue = httpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (httpContext is null || !Guid.TryParse(userIdValue, out var userId))
        {
            return null;
        }

        var query = db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(m => m.UserId == userId && m.Tenant.Status == TenantStatus.Active);

        var requested = httpContext.Request.Headers[TenantHeader].ToString();
        if (Guid.TryParse(requested, out var requestedTenantId))
        {
            query = query.Where(m => m.TenantId == requestedTenantId);
        }
        else if (!string.IsNullOrEmpty(requested))
        {
            return null;
        }

        // Without a header the user must have exactly one membership (no implicit choice).
        var candidates = await query
            .OrderBy(m => m.TenantId)
            .Take(2)
            .Select(m => new ResolvedMembership(m.TenantId, m.Tenant.Slug, m.Role))
            .ToListAsync(cancellationToken);

        if (candidates.Count != 1)
        {
            return null;
        }

        _membership = candidates[0];
        tenantContext.SetTenant(_membership.TenantId);
        return _membership;
    }
}
