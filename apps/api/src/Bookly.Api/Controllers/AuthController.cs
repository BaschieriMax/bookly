using Bookly.Api.Auth;
using Bookly.Api.Data;
using Bookly.Api.DTOs.Auth;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController(
    AccountService accounts,
    SignInManager<AppUser> signInManager,
    UserManager<AppUser> userManager,
    AppDbContext db,
    IAntiforgery antiforgery,
    IOptions<AuthOptions> authOptions) : ControllerBase
{
    /// <summary>
    /// Current user (204 when anonymous). Always issues a fresh antiforgery token in the
    /// XSRF-TOKEN cookie: the SPA calls this on start-up and after login/logout.
    /// </summary>
    [HttpGet("me")]
    [AllowAnonymous]
    [ProducesResponseType<MeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        IssueXsrfToken();

        if (User.Identity?.IsAuthenticated != true)
        {
            return NoContent();
        }

        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            await signInManager.SignOutAsync();
            return NoContent();
        }

        // A user's own memberships span tenants: the tenant filter is bypassed explicitly, scoped by UserId.
        var memberships = await db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(m => m.UserId == user.Id && m.Tenant.Status == TenantStatus.Active)
            .OrderBy(m => m.Tenant.Name)
            .Select(m => new MembershipDto(m.TenantId, m.Tenant.Slug, m.Tenant.Name, m.Role.ToString()))
            .ToListAsync(cancellationToken);

        var roles = await userManager.GetRolesAsync(user);

        return Ok(new MeResponse(
            user.Id,
            user.Email!,
            user.FirstName,
            user.LastName,
            user.EmailConfirmed,
            [.. roles],
            memberships));
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await accounts.RegisterAsync(request, cancellationToken);
        return result.Succeeded ? Accepted() : IdentityValidationProblem(result, passwordField: "password");
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is not null)
        {
            var result = await signInManager.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
            if (result.Succeeded)
            {
                return Results.NoContent();
            }
        }

        // Same answer for unknown email, wrong password and locked account: no account enumeration.
        return ApiProblems.Create(StatusCodes.Status401Unauthorized, ErrorCodes.InvalidCredentials, "Invalid email or password.");
    }

    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [HttpPost("confirm-email")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> ConfirmEmail(ConfirmEmailRequest request) =>
        await accounts.ConfirmEmailAsync(request.UserId, request.Token)
            ? Results.NoContent()
            : ApiProblems.Create(StatusCodes.Status400BadRequest, ErrorCodes.InvalidToken, "The link is invalid or expired.");

    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> ResendConfirmation(EmailRequest request, CancellationToken cancellationToken)
    {
        await accounts.ResendConfirmationAsync(request.Email, cancellationToken);
        return Accepted();
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> ForgotPassword(EmailRequest request, CancellationToken cancellationToken)
    {
        await accounts.ForgotPasswordAsync(request.Email, cancellationToken);
        return Accepted();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.PasswordReset)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var result = await accounts.ResetPasswordAsync(request);
        if (result.Succeeded)
        {
            return NoContent();
        }

        var invalidToken = userManager.ErrorDescriber.InvalidToken().Code;
        if (result.Errors.Any(e => e.Code == invalidToken))
        {
            var problem = ApiProblems.Create(StatusCodes.Status400BadRequest, ErrorCodes.InvalidToken, "The link is invalid or expired.");
            return new ResultActionResult(problem);
        }

        return IdentityValidationProblem(result, passwordField: "newPassword");
    }

    /// <summary>Who an invitation link is for (to greet the invitee); 400 when invalid, expired or used.</summary>
    [HttpGet("invitation")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType<InvitationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> Invitation([FromQuery] Guid userId, [FromQuery] string token, CancellationToken cancellationToken)
    {
        var user = await accounts.FindInvitedUserAsync(userId, token);
        if (user is null)
        {
            return InvalidInvitation();
        }

        var tenants = await db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(m => m.UserId == user.Id && m.Tenant.Status == TenantStatus.Active)
            .OrderBy(m => m.Tenant.Name)
            .Select(m => m.Tenant.Name)
            .ToListAsync(cancellationToken);

        return Results.Ok(new InvitationDto(user.Email!, user.FirstName, user.LastName, tenants));
    }

    /// <summary>Sets the first password of an invited owner and signs them in.</summary>
    [HttpPost("accept-invitation")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AcceptInvitation(AcceptInvitationRequest request)
    {
        var (user, result) = await accounts.AcceptInvitationAsync(request);
        if (user is not null)
        {
            await signInManager.SignInAsync(user, isPersistent: false);
            return NoContent();
        }

        var invalidToken = userManager.ErrorDescriber.InvalidToken().Code;
        return result.Errors.Any(e => e.Code == invalidToken)
            ? new ResultActionResult(InvalidInvitation())
            : IdentityValidationProblem(result, passwordField: "password");
    }

    private static IResult InvalidInvitation() =>
        ApiProblems.Create(StatusCodes.Status400BadRequest, ErrorCodes.InvalidToken, "The invitation link is invalid, expired or already used.");

    private void IssueXsrfToken()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Cookies.Append(authOptions.Value.XsrfCookieName, tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            Secure = authOptions.Value.RequireSecureCookies || Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });
    }

    /// <summary>Identity errors as a validation problem; values are stable Identity codes the client translates.</summary>
    private ActionResult IdentityValidationProblem(IdentityResult result, string passwordField)
    {
        foreach (var error in result.Errors)
        {
            var field = error.Code switch
            {
                _ when error.Code.StartsWith("Password", StringComparison.Ordinal) => passwordField,
                _ when error.Code.Contains("Email", StringComparison.Ordinal) || error.Code.Contains("UserName", StringComparison.Ordinal) => "email",
                _ => string.Empty,
            };
            ModelState.AddModelError(field, error.Code);
        }

        return ValidationProblem(ModelState);
    }
}

/// <summary>Adapts an <see cref="IResult"/> to MVC's IActionResult for actions with mixed return paths.</summary>
internal sealed class ResultActionResult(IResult result) : IActionResult
{
    public Task ExecuteResultAsync(ActionContext context) => result.ExecuteAsync(context.HttpContext);
}
