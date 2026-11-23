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
/// Endpoints called by the schedulers (cron-job.org, GitHub Actions as backup: DEC-012, DEC-034). They authenticate with a
/// shared secret instead of a user session, so antiforgery does not apply.
/// </summary>
[ApiController]
[Route("api/jobs")]
[AllowAnonymous]
[RequireAntiforgeryToken(false)]
[EnableRateLimiting(RateLimitPolicies.Auth)]
[Produces("application/json")]
public sealed class JobsController(
    ReminderService reminders,
    RetentionService retention,
    SuspensionNoticeService suspensionNotices,
    SuspensionNoticeSignal suspensionNoticeSignal,
    IOptions<JobsOptions> options) : ControllerBase
{
    public const string SecretHeader = "X-Job-Secret";

    /// <summary>Well under the schedulers' timeouts (cron-job.org 30 s after a warm start, curl 120 s); the rest goes next run.</summary>
    private static readonly TimeSpan SchedulerTimeBudget = TimeSpan.FromSeconds(20);

    [HttpPost("send-reminders")]
    [ProducesResponseType<ReminderRunResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> SendReminders(CancellationToken cancellationToken) =>
        Authorize() ?? Results.Ok(await reminders.SendDueAsync(cancellationToken));

    /// <summary>Daily data retention (DEC-030).</summary>
    [HttpPost("apply-retention")]
    [ProducesResponseType<RetentionRunResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> ApplyRetention(CancellationToken cancellationToken) =>
        Authorize() ?? Results.Ok(await retention.ApplyAsync(cancellationToken));

    /// <summary>
    /// Resumes the emails of a suspension after errors or the daily limit (DEC-039): sends for up
    /// to 20 seconds, then leaves the rest to the in-app worker. Both claim each email, so no duplicates.
    /// </summary>
    [HttpPost("send-suspension-notices")]
    [ProducesResponseType<SuspensionNoticeRunResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> SendSuspensionNotices(CancellationToken cancellationToken)
    {
        if (Authorize() is { } denied)
        {
            return denied;
        }

        var result = await suspensionNotices.SendDueAsync(cancellationToken, SchedulerTimeBudget);
        suspensionNoticeSignal.Notify(); // the app is awake now: the worker carries on with what is left
        return Results.Ok(result);
    }


    /// <summary>Null when the secret matches; 404 when jobs are disabled, 401 otherwise.</summary>
    private IResult? Authorize()
    {
        var configured = options.Value.Secret;
        if (string.IsNullOrEmpty(configured))
        {
            return Results.NotFound(); // jobs disabled: do not advertise the endpoints
        }

        var provided = Request.Headers[SecretHeader].ToString();
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(configured))
            ? null
            : ApiProblems.Create(StatusCodes.Status401Unauthorized, ErrorCodes.InvalidToken, "Invalid job secret.");
    }
}
