using Bookly.Api.Auth;
using Bookly.Api.Data;
using Bookly.Api.DTOs.Public;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Infrastructure.Seo;
using Bookly.Api.Services.Availability;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace Bookly.Api.Controllers;

/// <summary>Anonymous endpoints of the public tenant page (/b/{slug}). Unknown or suspended tenants are 404.</summary>
[ApiController]
[Route("api/public/tenants/{slug}")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.Public)]
[Produces("application/json")]
public sealed class PublicTenantsController(
    AppDbContext db,
    PublicTenantResolver tenants,
    AvailabilityService availability) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<PublicTenantDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string slug, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        if (tenant is null)
        {
            return TenantNotFound();
        }

        var logo = await db.TenantLogos.AsNoTracking()
            .Where(l => l.TenantId == tenant.Id)
            .Select(l => new { HasIcon = l.IconData != null })
            .SingleOrDefaultAsync(cancellationToken);
        return Ok(new PublicTenantDto(
            tenant.Slug,
            tenant.Name,
            tenant.Phone,
            tenant.Address,
            tenant.TimeZone,
            tenant.CancellationWindowHours,
            tenant.BookingHorizonDays,
            new TenantBrandDto(tenant.BrandPrimaryColor, tenant.BrandGround.ToString(), tenant.BrandHeadingFont.ToString(), logo is not null, logo?.HasIcon == true)));
    }

    [HttpGet("logo")]
    [Produces("image/png", "image/webp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Logo(string slug, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        var logo = tenant is null
            ? null
            : await db.TenantLogos.AsNoTracking().SingleOrDefaultAsync(l => l.TenantId == tenant.Id, cancellationToken);
        if (logo is null)
        {
            return NotFound();
        }

        var etag = new EntityTagHeaderValue($"\"{logo.UpdatedAt.UtcTicks:x}\"");
        // Revalidate every time (cheap 304 via ETag) so a new logo shows up immediately.
        Response.Headers.CacheControl = "public, no-cache";
        if (Request.Headers.IfNoneMatch.ToString() == etag.Tag.ToString())
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(logo.Data, logo.ContentType, lastModified: logo.UpdatedAt, entityTag: etag);
    }

    /// <summary>Home-screen icon made from the logo (DEC-043): 256×256 PNG, never transparent.</summary>
    [HttpGet("icon")]
    [Produces("image/png")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status304NotModified)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Icon(string slug, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        var icon = tenant is null
            ? null
            : await db.TenantLogos.AsNoTracking()
                .Where(l => l.TenantId == tenant.Id && l.IconData != null)
                .Select(l => new { l.IconData, l.UpdatedAt })
                .SingleOrDefaultAsync(cancellationToken);
        if (icon?.IconData is null)
        {
            return NotFound();
        }

        var etag = new EntityTagHeaderValue($"\"{icon.UpdatedAt.UtcTicks:x}\"");
        Response.Headers.CacheControl = "public, no-cache";
        if (Request.Headers.IfNoneMatch.ToString() == etag.Tag.ToString())
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        return File(icon.IconData, "image/png", lastModified: icon.UpdatedAt, entityTag: etag);
    }

    /// <summary>
    /// Web app manifest of the tenant page (DEC-043): adding /b/{slug} to the home screen shows the
    /// business name and its icon (Turnora's when it has none) and opens the page in the browser.
    /// </summary>
    [HttpGet("manifest.webmanifest")]
    [ProducesResponseType<WebAppManifestDto>(StatusCodes.Status200OK, "application/manifest+json")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Manifest(string slug, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        if (tenant is null)
        {
            return TenantNotFound();
        }

        var hasIcon = await db.TenantLogos.AnyAsync(l => l.TenantId == tenant.Id && l.IconData != null, cancellationToken);
        var path = ShellTags.TenantPath(tenant.Slug);
        IReadOnlyList<WebAppManifestIconDto> icons = hasIcon
            ? [new WebAppManifestIconDto(ShellTags.TenantIconUrl(tenant.Slug), "256x256", "image/png", null)]
            : ShellTags.DefaultIcons;

        Response.Headers.CacheControl = "no-cache";
        return new JsonResult(new WebAppManifestDto(tenant.Name, tenant.Name, "it", path, path, "browser", icons))
        {
            ContentType = "application/manifest+json",
        };
    }

    [HttpGet("services")]
    [ProducesResponseType<IReadOnlyList<PublicServiceDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Services(string slug, CancellationToken cancellationToken)
    {
        if (await tenants.ResolveAsync(slug, cancellationToken) is null)
        {
            return TenantNotFound();
        }

        var services = await db.Services
            .AsNoTracking()
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new PublicServiceDto(
                s.Id,
                s.Name,
                s.Description,
                s.DurationMinutes,
                s.PriceCents,
                s.PriceIsFrom,
                s.Staff
                    .Where(ss => ss.StaffMember.IsActive)
                    .OrderBy(ss => ss.StaffMember.SortOrder).ThenBy(ss => ss.StaffMember.DisplayName)
                    .Select(ss => new PublicStaffDto(ss.StaffMemberId, ss.StaffMember.DisplayName))
                    .ToList()))
            .ToListAsync(cancellationToken);

        return Ok(services);
    }

    /// <summary>Free start times of a service on a day, in the tenant's local offset.</summary>
    [HttpGet("availability")]
    [ProducesResponseType<PublicAvailabilityDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Availability(
        string slug, [FromQuery] Guid serviceId, [FromQuery] DateOnly date, [FromQuery] Guid? staffId, CancellationToken cancellationToken)
    {
        var (tenant, service, error) = await ResolveServiceAsync(slug, serviceId, staffId, cancellationToken);
        if (error is not null)
        {
            return error;
        }

        Response.Headers.CacheControl = "no-store";
        var timeZone = AvailabilityService.TimeZoneOf(tenant!);
        var slots = await availability.GetSlotsAsync(tenant!, service!, staffId, date, cancellationToken);

        return Ok(new PublicAvailabilityDto(
            date,
            tenant!.TimeZone,
            [.. slots.Select(s => new PublicSlotDto(TimeZoneInfo.ConvertTime(s.StartUtc, timeZone)))]));
    }

    /// <summary>Which days in [from, to] have at least one free slot (for the date picker).</summary>
    [HttpGet("availability/days")]
    [ProducesResponseType<PublicDaysDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Days(
        string slug,
        [FromQuery] Guid serviceId,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromQuery] Guid? staffId,
        CancellationToken cancellationToken)
    {
        if (to < from || to.DayNumber - from.DayNumber + 1 > AvailabilityService.MaxDaysPerRequest)
        {
            return Problem(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRange, $"The range must be 1 to {AvailabilityService.MaxDaysPerRequest} days.");
        }

        var (tenant, service, error) = await ResolveServiceAsync(slug, serviceId, staffId, cancellationToken);
        if (error is not null)
        {
            return error;
        }

        Response.Headers.CacheControl = "no-store";
        var days = await availability.GetDaysAsync(tenant!, service!, staffId, from, to, cancellationToken);
        return Ok(new PublicDaysDto(tenant!.TimeZone, [.. days.Select(d => new PublicDayDto(d.Date, d.HasSlots))]));
    }

    private async Task<(Tenant? Tenant, Service? Service, IActionResult? Error)> ResolveServiceAsync(
        string slug, Guid serviceId, Guid? staffId, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        if (tenant is null)
        {
            return (null, null, TenantNotFound());
        }

        // The tenant filter guarantees a service of another tenant is "not found".
        var service = await db.Services.AsNoTracking().SingleOrDefaultAsync(s => s.Id == serviceId && s.IsActive, cancellationToken);
        if (service is null)
        {
            return (tenant, null, Problem(StatusCodes.Status404NotFound, ErrorCodes.ServiceNotFound, "Service not found."));
        }

        if (staffId is not null && (await availability.EligibleStaffAsync(serviceId, staffId, cancellationToken)).Count == 0)
        {
            return (tenant, service, Problem(StatusCodes.Status404NotFound, ErrorCodes.StaffNotFound, "Staff member not found for this service."));
        }

        return (tenant, service, null);
    }

    private ResultActionResult TenantNotFound() =>
        Problem(StatusCodes.Status404NotFound, ErrorCodes.TenantNotFound, "Business not found.");

    private static ResultActionResult Problem(int status, string code, string title) =>
        new(ApiProblems.Create(status, code, title));
}
