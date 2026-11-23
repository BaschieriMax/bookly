using System.Text.RegularExpressions;
using Bookly.Api.Data;
using Bookly.Api.DTOs.Platform;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Infrastructure.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Platform;

/// <summary>
/// Super-admin operations on tenants: create, suspend/reactivate, invite owners (DEC-028).
/// Tenants are cross-cutting here, so the tenant filter is always bypassed explicitly.
/// </summary>
public sealed partial class TenantProvisioningService(
    AppDbContext db,
    UserManager<AppUser> userManager,
    AccountService accounts,
    TenantSuspensionService suspensions,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<TenantProvisioningService> logger)
{
    /// <summary>Slugs that would clash with app routes or be confusing in /b/{slug}.</summary>
    private static readonly HashSet<string> ReservedSlugs =
    [
        "admin", "api", "app", "account", "b", "bookly", "login", "platform", "privacy", "prenota", "registrati", "static", "support", "www",
    ];

    public Task<IReadOnlyList<PlatformTenantDto>> ListAsync(CancellationToken cancellationToken) => QueryAsync(null, cancellationToken);

    private async Task<IReadOnlyList<PlatformTenantDto>> QueryAsync(Guid? tenantId, CancellationToken cancellationToken)
    {
        var allStaff = db.StaffMembers.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var allServices = db.Services.IgnoreQueryFilters([AppDbContext.TenantFilter]);
        var tenants = await db.Tenants.AsNoTracking()
            .Where(t => tenantId == null || t.Id == tenantId)
            .OrderBy(t => t.Name).ThenBy(t => t.Id)
            .Select(t => new
            {
                t.Id,
                t.Slug,
                t.Name,
                t.Status,
                t.TimeZone,
                t.CreatedAt,
                StaffCount = allStaff.Count(s => s.TenantId == t.Id),
                ServiceCount = allServices.Count(s => s.TenantId == t.Id),
            })
            .ToListAsync(cancellationToken);

        var owners = await db.TenantMemberships.IgnoreQueryFilters([AppDbContext.TenantFilter]).AsNoTracking()
            .Where(m => m.Role == TenantRole.Owner && (tenantId == null || m.TenantId == tenantId))
            .OrderBy(m => m.User.LastName).ThenBy(m => m.User.FirstName)
            .Select(m => new
            {
                m.TenantId,
                Owner = new PlatformOwnerDto(m.UserId, m.User.Email!, m.User.FirstName, m.User.LastName, m.User.PasswordHash == null),
            })
            .ToListAsync(cancellationToken);
        var ownersByTenant = owners.ToLookup(o => o.TenantId, o => o.Owner);

        // Email progress of the latest suspension, only while the tenant stays suspended (DEC-039).
        var notices = await suspensions.ProgressAsync(
            [.. tenants.Where(t => t.Status == TenantStatus.Suspended).Select(t => t.Id)], cancellationToken);

        return [.. tenants.Select(t => new PlatformTenantDto(
            t.Id,
            t.Slug,
            t.Name,
            t.Status.ToString(),
            t.TimeZone,
            t.CreatedAt,
            [.. ownersByTenant[t.Id]],
            t.StaffCount,
            t.ServiceCount,
            notices.GetValueOrDefault(t.Id)))];
    }

    public async Task<ServiceResult<FutureAppointmentsDto>> CountFutureAppointmentsAsync(Guid tenantId, CancellationToken cancellationToken) =>
        await suspensions.CountFutureAsync(tenantId, cancellationToken) is { } count
            ? ServiceResult<FutureAppointmentsDto>.Ok(count)
            : ServiceResult<FutureAppointmentsDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.TenantNotFound, "Tenant not found.");

    public async Task<ServiceResult<PlatformTenantDto>> CreateAsync(CreateTenantRequest request, CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (!SlugPattern().IsMatch(slug) || ReservedSlugs.Contains(slug))
        {
            return ServiceResult<PlatformTenantDto>.Fail(
                StatusCodes.Status400BadRequest, ErrorCodes.InvalidSlug, "Use 3–40 lowercase letters, digits and hyphens.");
        }

        if (!TimeZoneInfo.TryFindSystemTimeZoneById(request.TimeZone, out _) || !request.TimeZone.Contains('/', StringComparison.Ordinal))
        {
            return ServiceResult<PlatformTenantDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidTimeZone, "Unknown IANA time zone.");
        }

        if (await db.Tenants.AnyAsync(t => t.Slug == slug, cancellationToken))
        {
            return SlugTaken();
        }

        var tenant = new Tenant
        {
            Id = Guid.CreateVersion7(),
            Slug = slug,
            Name = request.Name.Trim(),
            TimeZone = request.TimeZone,
            CreatedAt = timeProvider.GetUtcNow(),
        };
        db.Tenants.Add(tenant);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Unique index on Slug: a concurrent creation won the race.
            db.ChangeTracker.Clear();
            return SlugTaken();
        }

        var invited = await InviteOwnerAsync(
            tenant.Id, new InviteOwnerRequest(request.OwnerEmail, request.OwnerFirstName, request.OwnerLastName), cancellationToken);
        return invited.Succeeded
            ? ServiceResult<PlatformTenantDto>.Ok(invited.Value!, StatusCodes.Status201Created)
            : invited;
    }

    /// <summary>
    /// Suspended tenants disappear from the public pages and the admin area (both resolve only
    /// Active tenants); their data is kept (booking-domain: multi-tenancy). With
    /// <paramref name="cancelFutureAppointments"/> the future appointments are cancelled too and
    /// the customers and owners are emailed in the background (DEC-039).
    /// </summary>
    public async Task<ServiceResult<PlatformTenantDto>> SetStatusAsync(
        Guid tenantId, TenantStatus status, bool cancelFutureAppointments, CancellationToken cancellationToken)
    {
        if (cancelFutureAppointments)
        {
            if (status != TenantStatus.Suspended)
            {
                return ServiceResult<PlatformTenantDto>.Fail(
                    StatusCodes.Status400BadRequest, ErrorCodes.CancelRequiresSuspension, "Appointments are cancelled only when suspending.");
            }

            return await suspensions.SuspendAndCancelAsync(tenantId, cancellationToken) switch
            {
                SuspendOutcome.NotFound => NotFound(),
                SuspendOutcome.Conflict => ServiceResult<PlatformTenantDto>.Fail(
                    StatusCodes.Status409Conflict, ErrorCodes.ConcurrentUpdate, "An appointment changed meanwhile: try again."),
                _ => ServiceResult<PlatformTenantDto>.Ok(await GetAsync(tenantId, cancellationToken)),
            };
        }

        var tenant = await db.Tenants.SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        tenant.Status = status;
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Tenant {TenantId} set to {Status}", tenantId, status);
        return ServiceResult<PlatformTenantDto>.Ok(await GetAsync(tenantId, cancellationToken));
    }

    /// <summary>
    /// Makes a user Owner of the tenant. New emails get an account without password and an
    /// invitation link (7 days); existing accounts are told they can now manage the tenant.
    /// Inviting a pending owner again re-sends the link.
    /// </summary>
    public async Task<ServiceResult<PlatformTenantDto>> InviteOwnerAsync(Guid tenantId, InviteOwnerRequest request, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.AsNoTracking().SingleOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        var email = request.Email.Trim();
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new AppUser
            {
                Id = Guid.CreateVersion7(),
                UserName = email,
                Email = email,
                FirstName = request.FirstName.Trim(),
                LastName = request.LastName.Trim(),
                CreatedAt = timeProvider.GetUtcNow(),
            };
            var created = await userManager.CreateAsync(user);
            if (!created.Succeeded)
            {
                return ServiceResult<PlatformTenantDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.ValidationFailed, "Invalid email.");
            }
        }

        var membership = await db.TenantMemberships.IgnoreQueryFilters([AppDbContext.TenantFilter])
            .SingleOrDefaultAsync(m => m.TenantId == tenantId && m.UserId == user.Id, cancellationToken);
        var pending = user.PasswordHash is null;

        if (membership is { Role: TenantRole.Owner } && !pending)
        {
            return ServiceResult<PlatformTenantDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.AlreadyOwner, "This user already owns the tenant.");
        }

        if (membership is null)
        {
            db.TenantMemberships.Add(new TenantMembership
            {
                TenantId = tenantId, UserId = user.Id, Role = TenantRole.Owner, CreatedAt = timeProvider.GetUtcNow(),
            });
        }
        else
        {
            membership.Role = TenantRole.Owner; // a Staff member promoted to Owner
        }

        await db.SaveChangesAsync(cancellationToken);

        var message = pending
            ? EmailTemplates.OwnerInvitation(user.Email!, user.FirstName, tenant.Name, await accounts.BuildInvitationLinkAsync(user))
            : EmailTemplates.OwnerAdded(user.Email!, user.FirstName, tenant.Name, $"{appOptions.Value.PublicBaseUrl.TrimEnd('/')}/admin");
        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // The membership stands: the invitation can be re-sent from the platform page.
            logger.LogError(exception, "Sending email {EmailKind} failed", message.Kind);
        }

        return ServiceResult<PlatformTenantDto>.Ok(await GetAsync(tenantId, cancellationToken));
    }

    private async Task<PlatformTenantDto> GetAsync(Guid tenantId, CancellationToken cancellationToken) =>
        (await QueryAsync(tenantId, cancellationToken)).Single();

    private static ServiceResult<PlatformTenantDto> NotFound() =>
        ServiceResult<PlatformTenantDto>.Fail(StatusCodes.Status404NotFound, ErrorCodes.TenantNotFound, "Tenant not found.");

    private static ServiceResult<PlatformTenantDto> SlugTaken() =>
        ServiceResult<PlatformTenantDto>.Fail(StatusCodes.Status409Conflict, ErrorCodes.SlugTaken, "This address is already used by another business.");

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")]
    private static partial Regex SlugPattern();
}
