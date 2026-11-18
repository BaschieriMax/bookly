using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>Business settings and brand of the current tenant (owner only).</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = Policies.TenantOwner)]
[Produces("application/json")]
public sealed class AdminSettingsController(TenantSettingsService settings) : ControllerBase
{
    [HttpGet("settings")]
    public Task<TenantSettingsDto> GetSettings(CancellationToken cancellationToken) => settings.GetSettingsAsync(cancellationToken);

    [HttpPut("settings")]
    [ProducesResponseType<TenantSettingsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> SaveSettings(SaveTenantSettingsRequest request, CancellationToken cancellationToken) =>
        (await settings.SaveSettingsAsync(request, cancellationToken)).ToResult();

    [HttpGet("brand")]
    public Task<TenantBrandSettingsDto> GetBrand(CancellationToken cancellationToken) => settings.GetBrandAsync(cancellationToken);

    [HttpPut("brand")]
    public Task<TenantBrandSettingsDto> SaveBrand(SaveTenantBrandRequest request, CancellationToken cancellationToken) =>
        settings.SaveBrandAsync(request, cancellationToken);

    [HttpPut("brand/logo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(TenantSettingsService.MaxLogoBytes + 16 * 1024)]
    [ProducesResponseType<TenantBrandSettingsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> SaveLogo(IFormFile logo, CancellationToken cancellationToken) =>
        (await settings.SaveLogoAsync(logo, cancellationToken)).ToResult();

    [HttpDelete("brand/logo")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteLogo(CancellationToken cancellationToken)
    {
        await settings.DeleteLogoAsync(cancellationToken);
        return NoContent();
    }
}
