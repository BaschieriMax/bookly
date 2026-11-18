using Microsoft.AspNetCore.Identity;

namespace Bookly.Api.Entities;

/// <summary>Global account: the same user can book with any tenant (assumption A1).</summary>
public class AppUser : IdentityUser<Guid>
{
    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    public DateTimeOffset? PrivacyAcceptedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<TenantMembership> Memberships { get; } = [];
}

/// <summary>Platform-level roles (e.g. SuperAdmin). Tenant roles live in <see cref="TenantMembership"/>.</summary>
public class AppRole : IdentityRole<Guid>;
