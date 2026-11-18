using Bookly.Api.Data;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Services.Availability;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Jobs;

public sealed record ReminderRunResult(int Sent, int Failed);

/// <summary>
/// Sends the ~24 h reminder (booking-domain: notifications). Idempotent: each appointment is
/// claimed by setting ReminderSentAt with a conditional UPDATE before the email is sent, so two
/// overlapping runs never email twice; a failed email releases the claim and is retried next run.
/// </summary>
public sealed class ReminderService(
    AppDbContext db,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<ReminderService> logger)
{
    /// <summary>How long before the start the reminder goes out.</summary>
    public static readonly TimeSpan Lead = TimeSpan.FromHours(24);

    /// <summary>Appointments booked this close to the start already got the confirmation: no reminder.</summary>
    public static readonly TimeSpan MinBookedAhead = TimeSpan.FromHours(12);

    public const int BatchSize = 200;

    public async Task<ReminderRunResult> SendDueAsync(CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var until = now + Lead;

        // A platform job: it works across tenants, so the tenant filter is bypassed explicitly.
        var due = await db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AsNoTracking()
            .Where(a => a.Status == AppointmentStatus.Confirmed
                && a.ReminderSentAt == null
                && a.StartUtc > now
                && a.StartUtc <= until
                && a.CreatedAt <= a.StartUtc - MinBookedAhead
                && db.Tenants.Any(t => t.Id == a.TenantId && t.Status == TenantStatus.Active))
            .OrderBy(a => a.StartUtc)
            .Take(BatchSize)
            .Select(a => new
            {
                a.Id,
                a.StartUtc,
                ServiceName = a.Service.Name,
                StaffName = a.StaffMember.DisplayName,
                a.Customer.Email,
                a.Customer.FirstName,
                Tenant = db.Tenants.Single(t => t.Id == a.TenantId),
            })
            .ToListAsync(cancellationToken);

        int sent = 0, failed = 0;
        foreach (var item in due)
        {
            var claimedAt = timeProvider.GetUtcNow();
            var claimed = await db.Appointments
                .IgnoreQueryFilters([AppDbContext.TenantFilter])
                .Where(a => a.Id == item.Id && a.ReminderSentAt == null && a.Status == AppointmentStatus.Confirmed)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.ReminderSentAt, claimedAt), cancellationToken);
            if (claimed == 0 || item.Email is null)
            {
                continue; // another run took it, or it changed meanwhile
            }

            var tenant = item.Tenant;
            var timeZone = AvailabilityService.TimeZoneOf(tenant);
            var deadline = item.StartUtc.AddHours(-tenant.CancellationWindowHours);
            var message = EmailTemplates.AppointmentReminder(
                item.Email,
                item.FirstName,
                tenant.Name,
                item.ServiceName,
                item.StaffName,
                DateFormatting.LongItalian(item.StartUtc, timeZone),
                tenant.Address,
                deadline > now ? DateFormatting.LongItalian(deadline, timeZone) : null,
                tenant.Phone,
                $"{appOptions.Value.PublicBaseUrl.TrimEnd('/')}/account/appuntamenti");

            try
            {
                await emailSender.SendAsync(message, cancellationToken);
                sent++;
            }
            catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
            {
                failed++;
                logger.LogError(exception, "Reminder for appointment {AppointmentId} failed: will retry", item.Id);
                await db.Appointments
                    .IgnoreQueryFilters([AppDbContext.TenantFilter])
                    .Where(a => a.Id == item.Id && a.ReminderSentAt == claimedAt)
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.ReminderSentAt, (DateTimeOffset?)null), CancellationToken.None);
            }
        }

        logger.LogInformation("Reminder run: {Sent} sent, {Failed} failed", sent, failed);
        return new ReminderRunResult(sent, failed);
    }
}

public sealed class JobsOptions
{
    public const string Section = "Jobs";

    /// <summary>Shared secret sent by the scheduler in X-Job-Secret. Empty = job endpoints disabled.</summary>
    public string Secret { get; set; } = string.Empty;
}
