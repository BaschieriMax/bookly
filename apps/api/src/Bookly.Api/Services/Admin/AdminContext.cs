using System.Security.Claims;
using Bookly.Api.Entities;
using Bookly.Api.Tenancy;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// Who is acting in the admin area: user, tenant and role. Only valid after the TenantMember /
/// TenantOwner policy succeeded (which resolved the membership).
/// </summary>
public sealed class AdminContext(IHttpContextAccessor httpContextAccessor, TenantMembershipResolver resolver)
{
    public Guid UserId =>
        Guid.Parse(httpContextAccessor.HttpContext!.User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public Guid TenantId => Membership.TenantId;

    public bool IsOwner => Membership.Role == TenantRole.Owner;

    private ResolvedMembership Membership =>
        resolver.Current ?? throw new InvalidOperationException("Admin context used outside an authorized tenant request.");
}
