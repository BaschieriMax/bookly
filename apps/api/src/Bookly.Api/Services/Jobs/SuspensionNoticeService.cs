using System.ComponentModel.DataAnnotations;
using Bookly.Api.Data;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Services.Admin;
using Bookly.Api.Services.Availability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Jobs;

public sealed record SuspensionNoticeRunResult(int Sent, int Failed, int Skipped, bool DailyLimitReached);

/// <summary>
/// Sends the emails queued by a suspension that cancelled appointments (DEC-039): owner summaries
/// first, then customers by their earliest appointment. Idempotent like the reminders: each notice
/// is claimed with a conditional UPDATE before the email goes out, so overlapping runs (the
/// in-app worker and the scheduler) never send twice. A failed email is retried later with a
/// growing pause; after <see cref="SuspensionNoticeOptions.MaxAttempts"/> it is given up.
/// </summary>
public sealed class SuspensionNoticeService(
    AppDbContext db,
    IEmailSender emailSender,
    IOptions<SuspensionNoticeOptions> options,
    TimeProvider timeProvider,
    ILogger<SuspensionNoticeService> logger)
{
    /// <summary>A claim older than this belongs to a run that died: the notice can be taken again.</summary>
    public static readonly TimeSpan ClaimTimeout = TimeSpan.FromMinutes(10);

    private enum Outcome
    {
        Sent,
        Skipped,
        Failed,
        TakenByAnotherRun,
    }

    /// <summary>
    /// Sends due notices until none is left or the daily limit is reached. Stops at the first
    /// failure: the mail server is probably down or out of quota, so insisting is pointless.
    /// </summary>
    /// <param name="timeBudget">
    /// No new email is started after this long (scheduler calls time out); the rest waits for
    /// the next run. Null: no limit (the in-app worker).
    /// </param>
    public async Task<SuspensionNoticeRunResult> SendDueAsync(CancellationToken cancellationToken, TimeSpan? timeBudget = null)
    {
        var settings = options.Value;
        int sent = 0, failed = 0, skipped = 0;
        var limitReached = false;
        var started = System.Diagnostics.Stopwatch.StartNew();
        bool OutOfTime() => timeBudget is { } budget && started.Elapsed >= budget;

        while (failed == 0 && !OutOfTime())
        {
            var now = timeProvider.GetUtcNow();
            var budget = settings.DailyLimit - await SentTodayAsync(db, now, cancellationToken);
            if (budget <= 0)
            {
                limitReached = await AnyDueAsync(now, cancellationToken);
                break;
            }

            var claimable = now - ClaimTimeout;
            var due = await db.SuspensionNotices.AsNoTracking()
                .Where(n => n.Status == SuspensionNoticeStatus.Pending
                    && n.NextAttemptAt <= now
                    && (n.ClaimedAt == null || n.ClaimedAt < claimable))
                .OrderBy(n => n.Suspension.CreatedAt).ThenBy(n => n.Position)
                .Take(Math.Min(settings.BatchSize, budget))
                .Select(n => n.Id)
                .ToListAsync(cancellationToken);
            if (due.Count == 0)
            {
                break;
            }

            var progressed = false;
            foreach (var id in due)
            {
                var outcome = await SendOneAsync(id, cancellationToken);
                switch (outcome)
                {
                    case Outcome.Sent:
                        sent++;
                        progressed = true;
                        break;
                    case Outcome.Skipped:
                        skipped++;
                        progressed = true;
                        break;
                    case Outcome.Failed:
                        failed++;
                        break;
                }

                if (failed > 0 || OutOfTime())
                {
                    break;
                }

                if (outcome == Outcome.Sent && settings.SendIntervalMilliseconds > 0)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(settings.SendIntervalMilliseconds), timeProvider, cancellationToken);
                }
            }

            if (!progressed)
            {
                break; // everything was taken by another run
            }
        }

        if (sent + failed + skipped > 0 || limitReached)
        {
            logger.LogInformation(
                "Suspension notices: {Sent} sent, {Failed} failed, {Skipped} skipped, daily limit reached: {LimitReached}",
                sent, failed, skipped, limitReached);
        }

        return new SuspensionNoticeRunResult(sent, failed, skipped, limitReached);
    }

    /// <summary>Notices sent since midnight UTC, counted against <see cref="SuspensionNoticeOptions.DailyLimit"/>.</summary>
    public static Task<int> SentTodayAsync(AppDbContext db, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var midnight = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var nextMidnight = midnight.AddDays(1);
        return db.SuspensionNotices.CountAsync(n => n.SentAt >= midnight && n.SentAt < nextMidnight, cancellationToken);
    }

    /// <summary>Delay before the next attempt after <paramref name="attempts"/> failures.</summary>
    public static TimeSpan Backoff(int attempts) => attempts switch
    {
        <= 1 => TimeSpan.FromMinutes(5),
        2 => TimeSpan.FromMinutes(30),
        3 => TimeSpan.FromHours(2),
        _ => TimeSpan.FromHours(6),
    };

    private Task<bool> AnyDueAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
        db.SuspensionNotices.AnyAsync(n => n.Status == SuspensionNoticeStatus.Pending && n.NextAttemptAt <= now, cancellationToken);

    private async Task<Outcome> SendOneAsync(Guid id, CancellationToken cancellationToken)
    {
        var claimedAt = timeProvider.GetUtcNow();
        var claimable = claimedAt - ClaimTimeout;
        var claimed = await db.SuspensionNotices
            .Where(n => n.Id == id
                && n.Status == SuspensionNoticeStatus.Pending
                && (n.ClaimedAt == null || n.ClaimedAt < claimable))
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.ClaimedAt, claimedAt), cancellationToken);
        if (claimed == 0)
        {
            return Outcome.TakenByAnotherRun;
        }

        var notice = await db.SuspensionNotices.AsNoTracking()
            .Include(n => n.Suspension)
            .SingleAsync(n => n.Id == id, cancellationToken);
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == notice.Suspension.TenantId, cancellationToken);

        var message = notice.Kind == SuspensionNoticeKind.Customer
            ? await CustomerMessageAsync(notice, tenant, cancellationToken)
            : await OwnerMessageAsync(notice, tenant, cancellationToken);
        if (message is null)
        {
            await FinishAsync(id, claimedAt, SuspensionNoticeStatus.Skipped, sentAt: null);
            return Outcome.Skipped;
        }

        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            var attempts = notice.Attempts + 1;
            var giveUp = attempts >= options.Value.MaxAttempts;
            logger.LogError(
                exception, "Suspension notice {NoticeId} failed (attempt {Attempts}){GiveUp}", id, attempts, giveUp ? ": given up" : ": will retry");
            var retryAt = timeProvider.GetUtcNow() + Backoff(attempts);
            await db.SuspensionNotices
                .Where(n => n.Id == id && n.ClaimedAt == claimedAt)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(n => n.Attempts, attempts)
                    .SetProperty(n => n.NextAttemptAt, retryAt)
                    .SetProperty(n => n.Status, giveUp ? SuspensionNoticeStatus.Failed : SuspensionNoticeStatus.Pending)
                    .SetProperty(n => n.ClaimedAt, (DateTimeOffset?)null), CancellationToken.None);
            return Outcome.Failed;
        }

        await FinishAsync(id, claimedAt, SuspensionNoticeStatus.Sent, timeProvider.GetUtcNow());
        return Outcome.Sent;
    }

    // CancellationToken.None: once the email is out, the notice must be marked whatever happens to the run.
    private Task FinishAsync(Guid id, DateTimeOffset claimedAt, SuspensionNoticeStatus status, DateTimeOffset? sentAt) =>
        db.SuspensionNotices
            .Where(n => n.Id == id && n.ClaimedAt == claimedAt)
            .ExecuteUpdateAsync(s => s
                .SetProperty(n => n.Status, status)
                .SetProperty(n => n.SentAt, sentAt)
                .SetProperty(n => n.ClaimedAt, (DateTimeOffset?)null), CancellationToken.None);

    private Task<List<Appointment>> AppointmentsAsync(SuspensionNotice notice, CancellationToken cancellationToken) =>
        db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AsNoTracking()
            .Include(a => a.Customer)
            .Include(a => a.TenantCustomer)
            .Include(a => a.Service)
            .Include(a => a.StaffMember)
            .Where(a => notice.AppointmentIds.Contains(a.Id))
            .OrderBy(a => a.StartUtc).ThenBy(a => a.Id)
            .ToListAsync(cancellationToken);

    /// <summary>Null when the customer can no longer be emailed (address erased, account deleted).</summary>
    private async Task<EmailMessage?> CustomerMessageAsync(SuspensionNotice notice, Tenant tenant, CancellationToken cancellationToken)
    {
        var appointments = await AppointmentsAsync(notice, cancellationToken);
        var recipient = appointments
            .Select(a => (Contact: CustomerContact.Of(a), Appointment: a))
            .FirstOrDefault(x => x.Contact.NotifyEmail(x.Appointment) is not null);
        if (recipient.Contact is null)
        {
            return null;
        }

        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        return EmailTemplates.AppointmentsCancelledNotice(
            recipient.Contact.NotifyEmail(recipient.Appointment)!,
            recipient.Contact.FirstName,
            tenant.Name,
            [.. appointments.Select(a =>
                $"{a.Service.Name} con {a.StaffMember.DisplayName}, {DateFormatting.LongItalian(a.StartUtc, timeZone)}")],
            tenant.Phone);
    }

    /// <summary>Null when the owner's account is gone.</summary>
    private async Task<EmailMessage?> OwnerMessageAsync(SuspensionNotice notice, Tenant tenant, CancellationToken cancellationToken)
    {
        var owner = notice.OwnerUserId is { } ownerId
            ? await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == ownerId, cancellationToken)
            : null;
        if (owner is null || owner.DeletedAt is not null || string.IsNullOrWhiteSpace(owner.Email))
        {
            return null;
        }

        var toCall = await AppointmentsAsync(notice, cancellationToken);
        var notified = await db.SuspensionNotices.CountAsync(
            n => n.SuspensionId == notice.SuspensionId && n.Kind == SuspensionNoticeKind.Customer, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);

        return EmailTemplates.TenantSuspendedSummary(
            owner.Email,
            owner.FirstName,
            tenant.Name,
            notice.Suspension.CancelledAppointments,
            notified,
            toCall.Select(a => a.CustomerId ?? a.TenantCustomerId).Distinct().Count(),
            [.. toCall.Select(a =>
            {
                var contact = CustomerContact.Of(a);
                return new EmailTemplates.CustomerToCall(
                    $"{contact.FirstName} {contact.LastName}", contact.Phone, DateFormatting.LongItalian(a.StartUtc, timeZone));
            })]);
    }
}

public sealed class SuspensionNoticeOptions
{
    public const string Section = "SuspensionNotices";

    /// <summary>
    /// Notices sent per UTC day at most. Resend free sends 100 emails a day in total: the rest is
    /// left to confirmations and invitations (TD-008).
    /// </summary>
    [Range(1, 10000)]
    public int DailyLimit { get; set; } = 80;

    [Range(1, 500)]
    public int BatchSize { get; set; } = 20;

    /// <summary>Pause between two emails: Resend accepts only a few requests per second.</summary>
    [Range(0, 10000)]
    public int SendIntervalMilliseconds { get; set; } = 500;

    /// <summary>In-app worker: sends right after a suspension and every <see cref="PollMinutes"/> while the app is awake. Off in tests.</summary>
    public bool RunInBackground { get; set; } = true;

    [Range(1, 1440)]
    public int PollMinutes { get; set; } = 10;

    [Range(1, 50)]
    public int MaxAttempts { get; set; } = 8;
}
