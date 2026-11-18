using Bookly.Api.Data;
using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Creates confirmed users with roles and memberships, and logs them in.</summary>
public static class TestUsers
{
    public const string Password = "una-password-lunga";

    public static async Task<AppUser> CreateAsync(
        BooklyApiFactory factory,
        bool superAdmin = false,
        params (Guid TenantId, TenantRole Role)[] memberships)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var email = $"{Guid.NewGuid():N}@example.test";
        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = "Test",
            LastName = "User",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var created = await users.CreateAsync(user, Password);
        Assert.True(created.Succeeded, string.Join(", ", created.Errors.Select(e => e.Code)));

        if (superAdmin)
        {
            await users.AddToRoleAsync(user, AppRoleConfiguration.SuperAdmin);
        }

        foreach (var (tenantId, role) in memberships)
        {
            db.TenantMemberships.Add(new TenantMembership { TenantId = tenantId, UserId = user.Id, Role = role, CreatedAt = DateTimeOffset.UtcNow });
        }

        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>Logs in and refreshes the antiforgery token for the authenticated identity.</summary>
    public static async Task<ApiSession> LoginAsync(BooklyApiFactory factory, AppUser user)
    {
        var session = factory.CreateSession();
        using var login = await session.PostAsync("/api/auth/login", new { email = user.Email, password = Password });
        Assert.Equal(System.Net.HttpStatusCode.NoContent, login.StatusCode);
        (await session.MeAsync()).Dispose();
        return session;
    }
}
