using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Bookly.Api.Tenancy;

namespace Bookly.Api.IntegrationTests;

/// <summary>DEC-019: the sidebar comes from the server, filtered by the role in the current tenant.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class NavigationTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    private async Task<Guid> NewTenantAsync()
    {
        await using var db = database.CreateDbContext();
        return (await TestData.AddTenantAsync(db)).Id;
    }

    private static async Task<string[]> RoutesAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = await response.Content.ReadFromJsonAsync<JsonElement[]>();
        return [.. items!.Select(i => i.GetProperty("route").GetString()!)];
    }

    [Fact]
    public async Task Owner_gets_the_full_admin_menu()
    {
        var tenant = await NewTenantAsync();
        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant, TenantRole.Owner));
        using var session = await TestUsers.LoginAsync(_factory, owner);

        using var response = await session.Client.GetAsync("/api/navigation/admin");

        Assert.Equal(["/admin", "/admin/servizi", "/admin/staff", "/admin/orari", "/admin/brand", "/admin/impostazioni"], await RoutesAsync(response));
    }

    [Fact]
    public async Task Staff_only_gets_calendar_and_schedule()
    {
        var tenant = await NewTenantAsync();
        var staff = await TestUsers.CreateAsync(_factory, memberships: (tenant, TenantRole.Staff));
        using var session = await TestUsers.LoginAsync(_factory, staff);

        using var response = await session.Client.GetAsync("/api/navigation/admin");

        Assert.Equal(["/admin", "/admin/orari"], await RoutesAsync(response));
    }

    [Fact]
    public async Task Customer_without_membership_is_forbidden_and_anonymous_is_unauthorized()
    {
        var customer = await TestUsers.CreateAsync(_factory);
        using var session = await TestUsers.LoginAsync(_factory, customer);
        using var anonymous = _factory.CreateSession();

        using var forbidden = await session.Client.GetAsync("/api/navigation/admin");
        using var unauthorized = await anonymous.Client.GetAsync("/api/navigation/admin");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public async Task With_several_memberships_the_tenant_header_is_required_and_validated()
    {
        var tenantA = await NewTenantAsync();
        var tenantB = await NewTenantAsync();
        var otherTenant = await NewTenantAsync();
        var user = await TestUsers.CreateAsync(_factory, memberships: [(tenantA, TenantRole.Owner), (tenantB, TenantRole.Staff)]);
        using var session = await TestUsers.LoginAsync(_factory, user);

        using var withoutHeader = await session.Client.GetAsync("/api/navigation/admin");

        using var asStaffOfB = new HttpRequestMessage(HttpMethod.Get, "/api/navigation/admin");
        asStaffOfB.Headers.Add(TenantMembershipResolver.TenantHeader, tenantB.ToString());
        using var staffResponse = await session.Client.SendAsync(asStaffOfB);

        using var notMember = new HttpRequestMessage(HttpMethod.Get, "/api/navigation/admin");
        notMember.Headers.Add(TenantMembershipResolver.TenantHeader, otherTenant.ToString());
        using var notMemberResponse = await session.Client.SendAsync(notMember);

        Assert.Equal(HttpStatusCode.Forbidden, withoutHeader.StatusCode);
        Assert.Equal(["/admin", "/admin/orari"], await RoutesAsync(staffResponse));
        Assert.Equal(HttpStatusCode.Forbidden, notMemberResponse.StatusCode);
    }

    [Fact]
    public async Task Platform_menu_is_only_for_super_admins()
    {
        var admin = await TestUsers.CreateAsync(_factory, superAdmin: true);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (await NewTenantAsync(), TenantRole.Owner));
        using var adminSession = await TestUsers.LoginAsync(_factory, admin);
        using var ownerSession = await TestUsers.LoginAsync(_factory, owner);

        using var adminResponse = await adminSession.Client.GetAsync("/api/navigation/platform");
        using var ownerResponse = await ownerSession.Client.GetAsync("/api/navigation/platform");

        Assert.Equal(["/platform/tenant", "/platform/navigazione"], await RoutesAsync(adminResponse));
        Assert.Equal(HttpStatusCode.Forbidden, ownerResponse.StatusCode);
    }

    [Fact]
    public async Task Super_admin_can_disable_an_item_for_everyone()
    {
        var admin = await TestUsers.CreateAsync(_factory, superAdmin: true);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (await NewTenantAsync(), TenantRole.Owner));
        using var adminSession = await TestUsers.LoginAsync(_factory, admin);
        using var ownerSession = await TestUsers.LoginAsync(_factory, owner);
        const int brandItemId = 5;

        try
        {
            using var disable = await adminSession.SendAsync(HttpMethod.Patch, $"/api/platform/navigation/{brandItemId}", new { isEnabled = false });
            using var menu = await ownerSession.Client.GetAsync("/api/navigation/admin");

            Assert.Equal(HttpStatusCode.OK, disable.StatusCode);
            Assert.DoesNotContain("/admin/brand", await RoutesAsync(menu));
        }
        finally
        {
            (await adminSession.SendAsync(HttpMethod.Patch, $"/api/platform/navigation/{brandItemId}", new { isEnabled = true })).Dispose();
        }
    }

    [Fact]
    public async Task Owner_cannot_change_the_menu()
    {
        var owner = await TestUsers.CreateAsync(_factory, memberships: (await NewTenantAsync(), TenantRole.Owner));
        using var session = await TestUsers.LoginAsync(_factory, owner);

        using var response = await session.SendAsync(HttpMethod.Patch, "/api/platform/navigation/1", new { isEnabled = false });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    public void Dispose() => _factory.Dispose();
}
