using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;

namespace Bookly.Api.Auth.Policies;

/// <summary>Authorization policies (overview §11). UI guards are UX only: these are the real checks.</summary>
public static class Policies
{
    /// <summary>Owner or Staff of the tenant resolved for the request.</summary>
    public const string TenantMember = "TenantMember";

    /// <summary>Owner of the tenant resolved for the request.</summary>
    public const string TenantOwner = "TenantOwner";

    /// <summary>Platform super-admin.</summary>
    public const string PlatformAdmin = "PlatformAdmin";

    public static void AddBooklyPolicies(this AuthorizationOptions options)
    {
        options.AddPolicy(TenantMember, p => p
            .RequireAuthenticatedUser()
            .AddRequirements(new TenantRoleRequirement(TenantRole.Owner, TenantRole.Staff)));

        options.AddPolicy(TenantOwner, p => p
            .RequireAuthenticatedUser()
            .AddRequirements(new TenantRoleRequirement(TenantRole.Owner)));

        options.AddPolicy(PlatformAdmin, p => p
            .RequireAuthenticatedUser()
            .RequireRole(AppRoleConfiguration.SuperAdmin));
    }
}

public sealed class TenantRoleRequirement(params TenantRole[] allowedRoles) : IAuthorizationRequirement
{
    public IReadOnlyCollection<TenantRole> AllowedRoles { get; } = allowedRoles;
}

internal sealed class TenantRoleHandler(TenantMembershipResolver resolver) : AuthorizationHandler<TenantRoleRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, TenantRoleRequirement requirement)
    {
        var membership = await resolver.ResolveAsync();
        if (membership is not null && requirement.AllowedRoles.Contains(membership.Role))
        {
            context.Succeed(requirement);
        }
    }
}
