using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Bookly.Api.Services.Platform;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 10: the super-admin creates tenants, invites owners and suspends tenants.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class PlatformTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    private const string InvitationSubject = "Sei stato invitato a gestire";

    private static string NewSlug() => $"shop-{Guid.NewGuid():N}"[..20];

    private static string NewEmail() => $"{Guid.NewGuid():N}@example.test";

    private static object NewTenant(string slug, string email) => new
    {
        name = "Sfumo Barber",
        slug,
        timeZone = "Europe/Rome",
        ownerEmail = email,
        ownerFirstName = "Gianni",
        ownerLastName = "Sfumo",
    };

    private async Task<ApiSession> SuperAdminAsync() =>
        await TestUsers.LoginAsync(_factory, await TestUsers.CreateAsync(_factory, superAdmin: true));

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    private (Guid UserId, string Token) InvitationOf(string email)
    {
        var message = _factory.Emails.SentTo(email).Last(m => m.Subject.StartsWith(InvitationSubject, StringComparison.Ordinal));
        var link = new Uri(System.Text.RegularExpressions.Regex.Match(message.TextBody, @"https?://\S+").Value);
        var query = QueryHelpers.ParseQuery(link.Query);
        Assert.Equal("/invito", link.AbsolutePath);
        return (Guid.Parse(query["userId"]!), query["token"]!);
    }

    [Fact]
    public async Task Only_super_admins_use_the_platform_api()
    {
        using var anonymous = _factory.CreateSession();
        using var anonymousResponse = await anonymous.Client.GetAsync("/api/platform/tenants");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        using var session = await TestUsers.LoginAsync(_factory, owner);
        using var list = await session.Client.GetAsync("/api/platform/tenants");
        using var create = await session.PostAsync("/api/platform/tenants", NewTenant(NewSlug(), NewEmail()));

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
    }

    [Fact]
    public async Task New_tenant_owner_is_invited_activates_the_account_and_manages_it()
    {
        using var admin = await SuperAdminAsync();
        var email = NewEmail();
        var slug = NewSlug();

        using var created = await admin.PostAsync("/api/platform/tenants", NewTenant(slug, email));

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var tenant = await JsonAsync(created);
        Assert.Equal("Active", tenant.GetProperty("status").GetString());
        var owner = Assert.Single(tenant.GetProperty("owners").EnumerateArray());
        Assert.True(owner.GetProperty("pending").GetBoolean());

        var (userId, token) = InvitationOf(email);
        using var invitee = _factory.CreateSession();
        var invitation = await invitee.Client.GetFromJsonAsync<JsonElement>($"/api/auth/invitation?userId={userId}&token={token}");
        Assert.Equal(email, invitation.GetProperty("email").GetString());
        Assert.Equal("Sfumo Barber", invitation.GetProperty("tenants")[0].GetString());

        using var weak = await invitee.PostAsync("/api/auth/accept-invitation", new { userId, token, password = "aaaaaaaaaaaa", acceptPrivacy = true });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.True((await JsonAsync(weak)).GetProperty("errors").TryGetProperty("password", out _));

        using var accepted = await invitee.PostAsync("/api/auth/accept-invitation", new { userId, token, password = "una-password-lunga", acceptPrivacy = true });
        Assert.Equal(HttpStatusCode.NoContent, accepted.StatusCode);

        var me = await invitee.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.True(me.GetProperty("emailConfirmed").GetBoolean());
        var membership = Assert.Single(me.GetProperty("memberships").EnumerateArray());
        Assert.Equal("Owner", membership.GetProperty("role").GetString());
        Assert.Equal(slug, membership.GetProperty("tenantSlug").GetString());

        // The owner can work in the admin area right away; the link cannot be reused.
        using var services = await invitee.Client.GetAsync("/api/admin/services");
        Assert.Equal(HttpStatusCode.OK, services.StatusCode);
        using var reused = await _factory.CreateSession().PostAsync("/api/auth/accept-invitation", new { userId, token, password = "altra-password-lunga", acceptPrivacy = true });
        Assert.Equal("auth.invalid_token", await CodeAsync(reused));
    }

    [Fact]
    public async Task Slugs_are_validated_and_unique()
    {
        using var admin = await SuperAdminAsync();
        var slug = NewSlug();

        using var invalid = await admin.PostAsync("/api/platform/tenants", NewTenant("Sfumo Barber!", NewEmail()));
        using var reserved = await admin.PostAsync("/api/platform/tenants", NewTenant("admin", NewEmail()));
        using var first = await admin.PostAsync("/api/platform/tenants", NewTenant(slug, NewEmail()));
        using var taken = await admin.PostAsync("/api/platform/tenants", NewTenant(slug.ToUpperInvariant(), NewEmail()));

        Assert.Equal("platform.invalid_slug", await CodeAsync(invalid));
        Assert.Equal("platform.invalid_slug", await CodeAsync(reserved));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
        Assert.Equal("platform.slug_taken", await CodeAsync(taken));
    }

    [Fact]
    public async Task Existing_accounts_become_owners_and_pending_invitations_can_be_resent()
    {
        using var admin = await SuperAdminAsync();
        var pendingEmail = NewEmail();
        using var created = await admin.PostAsync("/api/platform/tenants", NewTenant(NewSlug(), pendingEmail));
        var tenantId = (await JsonAsync(created)).GetProperty("id").GetGuid();

        var existing = await TestUsers.CreateAsync(_factory);
        object Invite(string email) => new { email, firstName = "Anna", lastName = "Rossi" };

        using var added = await admin.PostAsync($"/api/platform/tenants/{tenantId}/owners", Invite(existing.Email!));
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        Assert.Contains(_factory.Emails.SentTo(existing.Email!), m => m.Subject.StartsWith("Ora gestisci", StringComparison.Ordinal));
        Assert.Contains((await JsonAsync(added)).GetProperty("owners").EnumerateArray(),
            o => o.GetProperty("email").GetString() == existing.Email && !o.GetProperty("pending").GetBoolean());

        using var again = await admin.PostAsync($"/api/platform/tenants/{tenantId}/owners", Invite(existing.Email!));
        Assert.Equal("platform.already_owner", await CodeAsync(again));

        using var resent = await admin.PostAsync($"/api/platform/tenants/{tenantId}/owners", Invite(pendingEmail));
        Assert.Equal(HttpStatusCode.OK, resent.StatusCode);
        Assert.Equal(2, _factory.Emails.SentTo(pendingEmail).Count(m => m.Subject.StartsWith(InvitationSubject, StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Suspended_tenants_disappear_from_public_pages_and_admin_area()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        using var admin = await SuperAdminAsync();
        using var ownerSession = await TestUsers.LoginAsync(_factory, owner);

        using var suspended = await admin.SendAsync(HttpMethod.Put, $"/api/platform/tenants/{tenant.Id}/status", new { status = "Suspended" });
        Assert.Equal("Suspended", (await JsonAsync(suspended)).GetProperty("status").GetString());

        using var publicPage = await ownerSession.Client.GetAsync($"/api/public/tenants/{tenant.Slug}");
        using var adminArea = await ownerSession.Client.GetAsync("/api/admin/services");
        Assert.Equal(HttpStatusCode.NotFound, publicPage.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, adminArea.StatusCode);

        using var reactivated = await admin.SendAsync(HttpMethod.Put, $"/api/platform/tenants/{tenant.Id}/status", new { status = "Active" });
        Assert.Equal(HttpStatusCode.OK, reactivated.StatusCode);
        using var back = await ownerSession.Client.GetAsync($"/api/public/tenants/{tenant.Slug}");
        Assert.Equal(HttpStatusCode.OK, back.StatusCode);
    }

    [Fact]
    public async Task Bootstrap_grants_super_admin_only_to_confirmed_accounts()
    {
        var confirmed = await TestUsers.CreateAsync(_factory);
        var unconfirmed = await TestUsers.CreateAsync(_factory, emailConfirmed: false);

        await using var scope = _factory.Services.CreateAsyncScope();
        await SuperAdminBootstrapper.RunAsync(
            scope.ServiceProvider,
            new PlatformOptions { SuperAdminEmails = [confirmed.Email!, unconfirmed.Email!, "nobody@example.test"] },
            NullLogger.Instance);
        await SuperAdminBootstrapper.RunAsync(
            scope.ServiceProvider, new PlatformOptions { SuperAdminEmails = [confirmed.Email!] }, NullLogger.Instance);

        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        Assert.True(await users.IsInRoleAsync((await users.FindByIdAsync(confirmed.Id.ToString()))!, AppRoleConfiguration.SuperAdmin));
        Assert.False(await users.IsInRoleAsync((await users.FindByIdAsync(unconfirmed.Id.ToString()))!, AppRoleConfiguration.SuperAdmin));
    }

    public void Dispose() => _factory.Dispose();
}
