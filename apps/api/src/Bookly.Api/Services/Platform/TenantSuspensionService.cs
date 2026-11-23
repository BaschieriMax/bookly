using Bookly.Api.Data;
using Bookly.Api.DTOs.Platform;
using Bookly.Api.Entities;
using Bookly.Api.Services.Admin;
using Bookly.Api.Services.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Platform;

public enum SuspendOutcome
{
    Suspended,
    NotFound,

    /// <summary>An appointment changed while the suspension was being saved: nothing was changed.</summary>
    Conflict,
}

/// <summary>
/// Suspension that also cancels the future appointments and notifies (DEC-039). The super-admin
/// sees only how many appointments are affected, never which (data minimisation).
/// </summary>
public sealed class TenantSuspensionService(
    AppDbContext db,
    SuspensionNoticeSignal signal,
    IOptions<SuspensionNoticeOptions> noticeOptions,
    TimeProvider timeProvider,
    ILogger<TenantSuspensionService> logger)
{
    public async Task<FutureAppointmentsDto?> CountFutureAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        if (!await db.Tenants.AnyAsync(t => t.Id == tenantId, cancellationToken))
        {
            return null;
        }

        return new FutureAppointmentsDto(await Future(tenantId, timeProvider.GetUtcNow()).CountAsync(cancellationToken));
    }

    /// <summary>
    /// In one transaction: the tenant becomes Suspended, its future confirmed appointments
    /// become CancelledByBusiness, and one email per customer who can be emailed plus one
    /// summary per owner are queued. The emails go out in the background.
    /// </summary>
    public async Task<SuspendOutcome> SuspendAndCancelAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        var (outcome, cancelled, notices) = await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear(); // a retried attempt starts from scratch
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            var tenant = await db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
            if (tenant is null)
            {
                return (SuspendOutcome.NotFound, 0, 0);
            }

            var now = timeProvider.GetUtcNow();
            tenant.Status = TenantStatus.Suspended;

            var appointments = await Future(tenantId, now)
                .Include(a => a.Customer)
                .Include(a => a.TenantCustomer)
                .OrderBy(a => a.StartUtc).ThenBy(a => a.Id)
                .ToListAsync(cancellationToken);
            foreach (var appointment in appointments)
            {
                appointment.Status = AppointmentStatus.CancelledByBusiness;
                appointment.CancellationReason = null;
                appointment.UpdatedAt = now;
            }

            var queued = 0;
            if (appointments.Count > 0)
            {
                queued = await QueueNoticesAsync(tenantId, appointments, now, cancellationToken);
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                // The owner moved or cancelled one of them meanwhile: the caller retries with fresh data.
                await transaction.RollbackAsync(CancellationToken.None);
                db.ChangeTracker.Clear();
                return (SuspendOutcome.Conflict, 0, 0);
            }

            await transaction.CommitAsync(cancellationToken);
            return (SuspendOutcome.Suspended, appointments.Count, queued);
        });

        if (outcome == SuspendOutcome.Suspended)
        {
            logger.LogInformation(
                "Tenant {TenantId} suspended: {Cancelled} future appointments cancelled, {Notices} notices queued",
                tenantId, cancelled, notices);
            if (notices > 0)
            {
                signal.Notify();
            }
        }

        return outcome;
    }

    /// <summary>
    /// Progress of the emails of the latest suspension of each tenant (DEC-039), for the
    /// platform page. Tenants without such a suspension are missing from the result.
    /// </summary>
    public async Task<IReadOnlyDictionary<Guid, PlatformSuspensionNoticesDto>> ProgressAsync(
        IReadOnlyCollection<Guid> tenantIds, CancellationToken cancellationToken)
    {
        if (tenantIds.Count == 0)
        {
            return new Dictionary<Guid, PlatformSuspensionNoticesDto>();
        }

        var latest = await db.TenantSuspensions.AsNoTracking()
            .Where(s => tenantIds.Contains(s.TenantId))
            .GroupBy(s => s.TenantId)
            .Select(g => g.OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).First())
            .ToListAsync(cancellationToken);
        if (latest.Count == 0)
        {
            return new Dictionary<Guid, PlatformSuspensionNoticesDto>();
        }

        var suspensionIds = latest.Select(s => s.Id).ToList();
        var counts = await db.SuspensionNotices.AsNoTracking()
            .Where(n => suspensionIds.Contains(n.SuspensionId))
            .GroupBy(n => new { n.SuspensionId, n.Kind, n.Status })
            .Select(g => new
            {
                g.Key.SuspensionId,
                g.Key.Kind,
                g.Key.Status,
                Count = g.Count(),
                Retried = g.Count(n => n.Attempts > 0),
            })
            .ToListAsync(cancellationToken);

        var now = timeProvider.GetUtcNow();
        var limitReached = await SuspensionNoticeService.SentTodayAsync(db, now, cancellationToken) >= noticeOptions.Value.DailyLimit;

        return latest.ToDictionary(s => s.TenantId, s =>
        {
            var rows = counts.Where(c => c.SuspensionId == s.Id).ToList();
            int Sum(SuspensionNoticeKind kind, params SuspensionNoticeStatus[] statuses) =>
                rows.Where(r => r.Kind == kind && statuses.Contains(r.Status)).Sum(r => r.Count);

            var pending = rows.Where(r => r.Status == SuspensionNoticeStatus.Pending).ToList();
            var state = pending.Count == 0 ? "Done"
                : limitReached ? "PausedDailyLimit"
                : pending.Any(r => r.Retried > 0) ? "Retrying"
                : "Sending";

            return new PlatformSuspensionNoticesDto(
                s.CancelledAppointments,
                Customers: rows.Where(r => r.Kind == SuspensionNoticeKind.Customer).Sum(r => r.Count),
                Sent: Sum(SuspensionNoticeKind.Customer, SuspensionNoticeStatus.Sent),
                NotSent: Sum(SuspensionNoticeKind.Customer, SuspensionNoticeStatus.Skipped, SuspensionNoticeStatus.Failed),
                OwnerSummaries: rows.Where(r => r.Kind == SuspensionNoticeKind.OwnerSummary).Sum(r => r.Count),
                OwnerSummariesSent: Sum(SuspensionNoticeKind.OwnerSummary, SuspensionNoticeStatus.Sent),
                state);
        });
    }

    private IQueryable<Appointment> Future(Guid tenantId, DateTimeOffset now) =>
        db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(a => a.TenantId == tenantId && a.Status == AppointmentStatus.Confirmed && a.StartUtc > now);

    /// <summary>
    /// One email per customer who can be emailed (their appointments listed together), and one
    /// summary per owner listing the appointments whose customer cannot be emailed.
    /// </summary>
    private async Task<int> QueueNoticesAsync(
        Guid tenantId, IReadOnlyList<Appointment> appointments, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var suspension = new TenantSuspension
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenantId,
            CancelledAppointments = appointments.Count,
            CreatedAt = now,
        };
        db.TenantSuspensions.Add(suspension);

        // Decided on the data as it is now; the address is read again when the email goes out.
        var reachable = appointments.Where(a => CustomerContact.Of(a).NotifyEmail(a) is not null).ToList();
        var toCall = appointments.Except(reachable).Select(a => a.Id).ToList();
        var owners = await db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(m => m.TenantId == tenantId && m.Role == TenantRole.Owner)
            .OrderBy(m => m.CreatedAt).ThenBy(m => m.UserId)
            .Select(m => m.UserId)
            .ToListAsync(cancellationToken);

        var position = 0;
        SuspensionNotice Notice(SuspensionNoticeKind kind, List<Guid> appointmentIds, Guid? ownerUserId) => new()
        {
            Id = Guid.CreateVersion7(),
            SuspensionId = suspension.Id,
            Kind = kind,
            Position = position++,
            AppointmentIds = appointmentIds,
            OwnerUserId = ownerUserId,
            NextAttemptAt = now,
            CreatedAt = now,
        };

        // Owners first: they may have customers to call before the soonest appointments.
        foreach (var ownerId in owners)
        {
            suspension.Notices.Add(Notice(SuspensionNoticeKind.OwnerSummary, [.. toCall], ownerId));
        }

        // Grouped by customer, in order of their earliest appointment (the list is sorted by start).
        foreach (var group in reachable.GroupBy(a => a.CustomerId ?? a.TenantCustomerId))
        {
            suspension.Notices.Add(Notice(SuspensionNoticeKind.Customer, [.. group.Select(a => a.Id)], null));
        }

        return suspension.Notices.Count;
    }
}
