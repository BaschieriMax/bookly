using System.Security.Cryptography;
using System.Text;
using Bookly.Api.Auth;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Jobs;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Controllers;

/// <summary>
/// Endpoints called by the scheduler (GitHub Actions cron, DEC-012). They authenticate with a
/// shared secret instead of a user session, so antiforgery does not apply.
/// </summary>
[ApiController]
[Route("api/jobs")]
[AllowAnonymous]
[RequireAntiforgeryToken(false)]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Produces("application/json")]
public sealed class JobsController(ReminderService reminders, IOptions<JobsOptions> options) : ControllerBase
{
    public const string SecretHeader = "X-Job-Secret";

    [HttpPost("send-reminders")]
    [ProducesResponseType<ReminderRunResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> SendReminders(CancellationToken cancellationToken)
    {
        var configured = options.Value.Secret;
        if (string.IsNullOrEmpty(configured))
        {
            return Results.NotFound(); // jobs disabled: do not advertise the endpoint
        }

        var provided = Request.Headers[SecretHeader].ToString();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(configured)))
        {
            return ApiProblems.Create(StatusCodes.Status401Unauthorized, ErrorCodes.InvalidToken, "Invalid job secret.");
        }

        return Results.Ok(await reminders.SendDueAsync(cancellationToken));
    }
}
