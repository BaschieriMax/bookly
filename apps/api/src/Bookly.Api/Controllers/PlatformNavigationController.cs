using Bookly.Api.Auth.Policies;
using Bookly.Api.Data;
using Bookly.Api.DTOs.Navigation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Controllers;

/// <summary>Super-admin management of the sidebar: enable/disable and reorder (DEC-019).</summary>
[ApiController]
[Route("api/platform/navigation")]
[Authorize(Policy = Policies.PlatformAdmin)]
[Produces("application/json")]
public sealed class PlatformNavigationController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<NavigationAdminItemDto>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<NavigationAdminItemDto>> List(CancellationToken cancellationToken) =>
        await db.NavigationItems
            .AsNoTracking()
            .OrderBy(n => n.Area).ThenBy(n => n.SortOrder).ThenBy(n => n.Id)
            .Select(n => new NavigationAdminItemDto(
                n.Id, n.Key, n.LabelKey, n.Icon, n.Route, n.Area.ToString(), n.SortOrder, n.IsEnabled,
                n.Roles.OrderBy(r => r.Role).Select(r => r.Role).ToList()))
            .ToListAsync(cancellationToken);

    [HttpPatch("{id:int}")]
    [ProducesResponseType<NavigationAdminItemDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, UpdateNavigationItemRequest request, CancellationToken cancellationToken)
    {
        var item = await db.NavigationItems.Include(n => n.Roles).SingleOrDefaultAsync(n => n.Id == id, cancellationToken);
        if (item is null)
        {
            return NotFound();
        }

        if (request.IsEnabled is { } enabled)
        {
            item.IsEnabled = enabled;
        }

        if (request.SortOrder is { } order)
        {
            item.SortOrder = order;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new NavigationAdminItemDto(
            item.Id, item.Key, item.LabelKey, item.Icon, item.Route, item.Area.ToString(), item.SortOrder, item.IsEnabled,
            [.. item.Roles.Select(r => r.Role).Order()]));
    }
}
