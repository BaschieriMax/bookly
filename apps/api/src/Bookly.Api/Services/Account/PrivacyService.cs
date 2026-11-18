using Bookly.Api.Data;
using Bookly.Api.DTOs.Account;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Availability;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Account;

/// <summary>
/// The user's GDPR rights on their own data: access/portability (export), rectification (profile)
/// and erasure (delete account, DEC-030). A user's data spans tenants, so the tenant filter is
/// bypassed explicitly and every query is scoped by the user id.
/// </summary>
public sealed class PrivacyService(
    AppDbContext db,
    UserManager<AppUser> userManager,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<PrivacyService> logger)
{
    public const string DeletedEmailDomain = "deleted.invalid";

    public static ProfileDto ToProfile(AppUser user) =>
        new(user.Email!, user.FirstName, user.LastName, user.PhoneNumber, user.CreatedAt);

    public async Task<ProfileDto> UpdateProfileAsync(AppUser user, UpdateProfileRequest request)
    {
        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        await userManager.UpdateAsync(user);
        return ToProfile(user);
    }

    public async Task<DataExportDto> ExportAsync(AppUser user, CancellationToken cancellationToken)
    {
        var memberships = await db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .OrderBy(m => m.Tenant.Name)
            .Select(m => new ExportMembershipDto(m.Tenant.Name, m.Role.ToString()))
            .ToListAsync(cancellationToken);

        var rows = await db.Appointments
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AsNoTracking()
            .Where(a => a.CustomerId == user.Id)
            .OrderBy(a => a.StartUtc)
            .Select(a => new
            {
                a.StartUtc,
                a.EndUtc,
                a.Status,
                a.CustomerNote,
                a.CancellationReason,
                a.CreatedAt,
                Service = a.Service.Name,
                Staff = a.StaffMember.DisplayName,
                Tenant = db.Tenants.Single(t => t.Id == a.TenantId),
            })
            .ToListAsync(cancellationToken);

        return new DataExportDto(
            timeProvider.GetUtcNow(),
            new ExportAccountDto(user.Id, user.Email!, user.FirstName, user.LastName, user.PhoneNumber, user.EmailConfirmed, user.CreatedAt, user.PrivacyAcceptedAt),
            memberships,
            [.. rows.Select(r =>
            {
                var timeZone = AvailabilityService.TimeZoneOf(r.Tenant);
                return new ExportAppointmentDto(
                    r.Tenant.Name,
                    r.Service,
                    r.Staff,
                    TimeZoneInfo.ConvertTime(r.StartUtc, timeZone),
                    TimeZoneInfo.ConvertTime(r.EndUtc, timeZone),
                    r.Status.ToString(),
                    r.CustomerNote,
                    r.CancellationReason,
                    r.CreatedAt);
            })]);
    }

    /// <summary>
    /// Erasure (GDPR art. 17) with anonymisation of the history the businesses need (booking-domain):
    /// future appointments are cancelled, free-text notes removed, staff logins detached and the
    /// account row is kept but stripped of every personal field, so past appointments read as
    /// "Cliente eliminato". Owners must hand over their business first.
    /// </summary>
    public async Task<ServiceResult<bool>> DeleteAccountAsync(AppUser user, string password, CancellationToken cancellationToken)
    {
        if (!await userManager.CheckPasswordAsync(user, password))
        {
            return ServiceResult<bool>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidPassword, "Wrong password.");
        }

        var ownsTenant = await db.TenantMemberships
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .AnyAsync(m => m.UserId == user.Id && m.Role == TenantRole.Owner, cancellationToken);
        if (ownsTenant)
        {
            return ServiceResult<bool>.Fail(
                StatusCodes.Status409Conflict, ErrorCodes.OwnerOfTenant, "Owners must transfer their business before deleting the account.");
        }

        var now = timeProvider.GetUtcNow();
        var originalEmail = user.Email!;
        var originalFirstName = user.FirstName;

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            var appointments = db.Appointments.IgnoreQueryFilters([AppDbContext.TenantFilter]).Where(a => a.CustomerId == user.Id);
            await appointments
                .Where(a => a.Status == AppointmentStatus.Confirmed && a.StartUtc > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.Status, AppointmentStatus.CancelledByCustomer)
                    .SetProperty(a => a.UpdatedAt, now), cancellationToken);
            await appointments
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.CustomerNote, (string?)null)
                    .SetProperty(a => a.CancellationReason, (string?)null), cancellationToken);

            await db.StaffMembers.IgnoreQueryFilters([AppDbContext.TenantFilter])
                .Where(s => s.UserId == user.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, (Guid?)null), cancellationToken);
            await db.TenantMemberships.IgnoreQueryFilters([AppDbContext.TenantFilter])
                .Where(m => m.UserId == user.Id)
                .ExecuteDeleteAsync(cancellationToken);
            await db.UserRoles.Where(r => r.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
            await db.UserClaims.Where(c => c.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
            await db.UserLogins.Where(l => l.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
            await db.UserTokens.Where(t => t.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);

            var placeholder = $"deleted-{user.Id:N}@{DeletedEmailDomain}";
            user.FirstName = "Cliente";
            user.LastName = "eliminato";
            user.Email = placeholder;
            user.NormalizedEmail = placeholder.ToUpperInvariant();
            user.UserName = placeholder;
            user.NormalizedUserName = placeholder.ToUpperInvariant();
            user.EmailConfirmed = false;
            user.PhoneNumber = null;
            user.PhoneNumberConfirmed = false;
            user.PasswordHash = null;
            user.PrivacyAcceptedAt = null;
            user.LockoutEnabled = true;
            user.LockoutEnd = DateTimeOffset.MaxValue;
            user.DeletedAt = now;
            user.SecurityStamp = Guid.NewGuid().ToString(); // ends every session and invalidates every link
            await db.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        });

        logger.LogInformation("Account {UserId} deleted and anonymised", user.Id);
        try
        {
            await emailSender.SendAsync(
                EmailTemplates.AccountDeleted(originalEmail, originalFirstName, appOptions.Value.PublicBaseUrl.TrimEnd('/')), cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "Account deletion email failed");
        }

        return ServiceResult<bool>.Ok(true);
    }
}
