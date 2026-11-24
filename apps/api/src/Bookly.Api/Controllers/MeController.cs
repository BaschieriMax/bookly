using System.Text.Json;
using Bookly.Api.Auth;
using Bookly.Api.DTOs.Account;
using Bookly.Api.Entities;
using Bookly.Api.Services.Account;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Bookly.Api.Controllers;

/// <summary>The signed-in user's own account and GDPR rights (access, rectification, erasure).</summary>
[ApiController]
[Route("api/me")]
[Authorize]
[Produces("application/json")]
public sealed class MeController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signInManager,
    PrivacyService privacy) : ControllerBase
{
    private static readonly JsonSerializerOptions ExportJson = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    [HttpGet("profile")]
    [ProducesResponseType<ProfileDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Profile()
    {
        var user = await users.GetUserAsync(User);
        Response.Headers.CacheControl = "no-store";
        return user is null ? Unauthorized() : Ok(PrivacyService.ToProfile(user));
    }

    [HttpPut("profile")]
    [ProducesResponseType<ProfileDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await users.GetUserAsync(User);
        return user is null ? Unauthorized() : Ok(await privacy.UpdateProfileAsync(user, request));
    }

    /// <summary>All personal data as a downloadable JSON file (GDPR art. 15 and 20).</summary>
    [HttpGet("export")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [Produces("application/json")]
    [ProducesResponseType<DataExportDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var export = await privacy.ExportAsync(user, cancellationToken);
        Response.Headers.CacheControl = "no-store";
        var bytes = JsonSerializer.SerializeToUtf8Bytes(export, ExportJson);
        return File(bytes, "application/json", $"turnora-dati-{export.ExportedAt:yyyy-MM-dd}.json");
    }

    /// <summary>Deletes (anonymises) the account after re-entering the password, then signs out.</summary>
    [HttpPost("delete")]
    [EnableRateLimiting(RateLimitPolicies.Auth)] // the password check must not become an oracle
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Delete(DeleteAccountRequest request, CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(User);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        var result = await privacy.DeleteAccountAsync(user, request.Password, cancellationToken);
        if (result.Succeeded)
        {
            await signInManager.SignOutAsync();
        }

        return result.ToResult();
    }
}
