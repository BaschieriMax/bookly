using Bookly.Api.Auth.Policies;
using Bookly.Api.Data;
using Bookly.Api.Data.Configurations;
using Bookly.Api.DTOs.Navigation;
using Bookly.Api.Entities;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Controllers;

/// <summary>Server-driven sidebar (DEC-019). Visibility is UX only: every endpoint keeps its own authorization.</summary>
[ApiController]
[Route("api/navigation")]
[Produces("application/json")]
public sealed class NavigationController(AppDbContext db, TenantMembershipResolver memberships) : ControllerBase
{
    /// <summary>Admin sidebar for the user's role in the current tenant (X-Bookly-Tenant).</summary>
    [HttpGet("admin")]
    [Authorize(Policy = Policies.TenantMember)]
    [ProducesResponseType<IReadOnlyList<NavigationItemDto>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<NavigationItemDto>> Admin(CancellationToken cancellationToken)
    {
        var membership = await memberships.ResolveAsync(cancellationToken);
        return await ItemsAsync(NavigationArea.Admin, membership!.Role.ToString(), cancellationToken);
    }

    /// <summary>Platform sidebar for super-admins.</summary>
    [HttpGet("platform")]
    [Authorize(Policy = Policies.PlatformAdmin)]
    [ProducesResponseType<IReadOnlyList<NavigationItemDto>>(StatusCodes.Status200OK)]
    public Task<IReadOnlyList<NavigationItemDto>> Platform(CancellationToken cancellationToken) =>
        ItemsAsync(NavigationArea.Platform, AppRoleConfiguration.SuperAdmin, cancellationToken);

    private async Task<IReadOnlyList<NavigationItemDto>> ItemsAsync(NavigationArea area, string role, CancellationToken cancellationToken)
    {
        Response.Headers.CacheControl = "private, no-cache";

        return await db.NavigationItems
            .AsNoTracking()
            .Where(n => n.Area == area && n.IsEnabled && n.Roles.Any(r => r.Role == role))
            .OrderBy(n => n.SortOrder)
            .ThenBy(n => n.Id)
            .Select(n => new NavigationItemDto(n.Key, n.LabelKey, n.Icon, n.Route, n.Parent == null ? null : n.Parent.Key))
            .ToListAsync(cancellationToken);
    }
}
