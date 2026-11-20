using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Jobs;

public sealed record RetentionRunResult(int AppointmentsCleaned, int UnconfirmedAccountsDeleted, int AddressBookEntriesAnonymized = 0);

/// <summary>
/// Storage limitation (GDPR art. 5.1.e, DEC-030): free-text notes of appointments are removed
/// 24 months after the appointment; accounts never confirmed within 30 days (and never used) are
/// deleted; address-book customers (DEC-037) with no appointment in the last 24 months are
/// anonymised (the row stays for the businesses' history). Run daily by the scheduler; idempotent.
/// </summary>
public sealed class RetentionService(
    AppDbContext db,
    UserManager<AppUser> userManager,
    TimeProvider timeProvider,
    ILogger<RetentionService> logger)
{
    public const int AppointmentRetentionMonths = 24;
    public static readonly TimeSpan UnconfirmedAccountLifetime = TimeSpan.FromDays(30);
    public const int BatchSize = 500;

    public async Task<RetentionRunResult> ApplyAsync(CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var appointmentCutoff = now.AddMonths(-AppointmentRetentionMonths);

        var cleaned = await db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(a => a.EndUtc < appointmentCutoff && (a.CustomerNote != null || a.CancellationReason != null))
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.CustomerNote, (string?)null)
                .SetProperty(a => a.CancellationReason, (string?)null), cancellationToken);

        var allAppointments = db.Appointments.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var anonymized = await db.TenantCustomers
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .Where(c => c.AnonymizedAt == null
                && c.CreatedAt < appointmentCutoff
                && !allAppointments.Any(a => a.TenantCustomerId == c.Id && a.EndUtc >= appointmentCutoff))
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.FirstName, "Cliente")
                .SetProperty(c => c.LastName, "anonimo")
                .SetProperty(c => c.Phone, (string?)null)
                .SetProperty(c => c.PhoneDigits, (string?)null)
                .SetProperty(c => c.Email, (string?)null)
                .SetProperty(c => c.AnonymizedAt, now)
                .SetProperty(c => c.UpdatedAt, now), cancellationToken);

        var accountCutoff = now - UnconfirmedAccountLifetime;
        var memberships = db.TenantMemberships.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var appointments = db.Appointments.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var stale = await db.Users
            .Where(u => !u.EmailConfirmed
                && u.DeletedAt == null
                && u.PasswordHash != null // invited owners (no password yet) are handled by their invitation
                && u.CreatedAt < accountCutoff
                && !appointments.Any(a => a.CustomerId == u.Id)
                && !memberships.Any(m => m.UserId == u.Id)
                && !db.UserRoles.Any(r => r.UserId == u.Id))
            .OrderBy(u => u.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        var deleted = 0;
        foreach (var user in stale)
        {
            if ((await userManager.DeleteAsync(user)).Succeeded)
            {
                deleted++;
            }
        }

        logger.LogInformation(
            "Retention run: {Appointments} appointments cleaned, {Accounts} unconfirmed accounts deleted, {Entries} address-book entries anonymised",
            cleaned, deleted, anonymized);
        return new RetentionRunResult(cleaned, deleted, anonymized);
    }
}
