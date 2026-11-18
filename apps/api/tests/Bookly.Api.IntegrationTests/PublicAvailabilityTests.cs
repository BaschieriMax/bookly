using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Public tenant page endpoints: tenant info, services, availability (Step 5).</summary>
[Collection(DatabaseCollection.Name)]
public sealed class PublicAvailabilityTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    // Tuesday 2 March 2027, Europe/Rome = UTC+1.
    private const string Tuesday = "2027-03-02";

    private sealed record Shop(Tenant Tenant, StaffMember StaffA, StaffMember StaffB, Service Service);

    /// <summary>Two barbers working Tuesday 09:00–13:00, one 30+10 min service, A busy 09:00–09:40.</summary>
    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var a = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere A");
        var b = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere B");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio", duration: 30, buffer: 10);
        foreach (var staff in new[] { a, b })
        {
            await TestData.EnableServiceAsync(db, tenant.Id, staff.Id, service.Id);
            await TestData.AddWorkingHoursAsync(db, tenant.Id, staff.Id, DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(13, 0));
        }

        var customer = await TestData.AddCustomerAsync(db);
        db.Appointments.Add(TestData.NewAppointment(tenant.Id, a.Id, service, customer.Id, new DateTimeOffset(2027, 3, 2, 8, 0, 0, TimeSpan.Zero)));
        await db.SaveChangesAsync();

        return new Shop(tenant, a, b, service);
    }

    private async Task<string[]> SlotStartsAsync(HttpClient client, string url)
    {
        using var response = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return [.. body.GetProperty("slots").EnumerateArray().Select(s => s.GetProperty("start").GetString()!)];
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString();

    [Fact]
    public async Task Tenant_page_returns_public_data_and_hides_suspended_or_unknown_tenants()
    {
        var shop = await ArrangeShopAsync();
        using var client = _factory.CreateClient();

        using var ok = await client.GetAsync($"/api/public/tenants/{shop.Tenant.Slug}");
        await using (var db = database.CreateDbContext())
        {
            await db.Tenants.Where(t => t.Id == shop.Tenant.Id).ExecuteUpdateAsync(t => t.SetProperty(x => x.Status, TenantStatus.Suspended));
        }
        using var suspended = await client.GetAsync($"/api/public/tenants/{shop.Tenant.Slug}");
        using var unknown = await client.GetAsync("/api/public/tenants/non-esiste");

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var body = await ok.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Europe/Rome", body.GetProperty("timeZone").GetString());
        Assert.False(body.GetProperty("brand").GetProperty("hasLogo").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, suspended.StatusCode);
        Assert.Equal("tenant.not_found", await CodeAsync(suspended));
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Services_list_only_active_services_of_the_tenant_with_their_staff()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext(shop.Tenant.Id))
        {
            var hidden = await TestData.AddServiceAsync(db, shop.Tenant.Id, "Nascosto");
            await db.Services.Where(s => s.Id == hidden.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, false));
        }

        using var client = _factory.CreateClient();
        var services = await client.GetFromJsonAsync<JsonElement[]>($"/api/public/tenants/{shop.Tenant.Slug}/services");

        var service = Assert.Single(services!);
        Assert.Equal(shop.Service.Id, service.GetProperty("id").GetGuid());
        Assert.NotEqual(other.Service.Id, service.GetProperty("id").GetGuid());
        Assert.Equal(["Barbiere A", "Barbiere B"], service.GetProperty("staff").EnumerateArray().Select(s => s.GetProperty("displayName").GetString()));
        Assert.False(service.TryGetProperty("bufferMinutes", out _)); // internal detail, never exposed
    }

    [Fact]
    public async Task Any_staff_offers_9_00_while_the_busy_barber_starts_after_the_appointment_and_buffer()
    {
        var shop = await ArrangeShopAsync();
        using var client = _factory.CreateClient();
        var baseUrl = $"/api/public/tenants/{shop.Tenant.Slug}/availability?serviceId={shop.Service.Id}&date={Tuesday}";

        var anyStaff = await SlotStartsAsync(client, baseUrl);
        var staffA = await SlotStartsAsync(client, $"{baseUrl}&staffId={shop.StaffA.Id}");

        Assert.Equal("2027-03-02T09:00:00+01:00", anyStaff[0]);
        Assert.Equal("2027-03-02T09:45:00+01:00", staffA[0]); // busy until 09:40, next aligned slot
        Assert.Equal("2027-03-02T12:15:00+01:00", staffA[^1]); // 12:15 + 40 min = 12:55
    }

    [Fact]
    public async Task Minimum_notice_hides_slots_too_close_to_now()
    {
        var shop = await ArrangeShopAsync();
        using var factory = new BooklyApiFactory(database);
        factory.Clock.SetUtcNow(new DateTimeOffset(2027, 3, 2, 8, 30, 0, TimeSpan.Zero)); // 09:30 in Rome
        using var client = factory.CreateClient();

        var slots = await SlotStartsAsync(client, $"/api/public/tenants/{shop.Tenant.Slug}/availability?serviceId={shop.Service.Id}&date={Tuesday}&staffId={shop.StaffB.Id}");

        Assert.Equal("2027-03-02T10:30:00+01:00", slots[0]); // 60 min notice
    }

    [Fact]
    public async Task Service_or_staff_of_another_tenant_is_not_found()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var client = _factory.CreateClient();
        var url = $"/api/public/tenants/{shop.Tenant.Slug}/availability?date={Tuesday}";

        using var foreignService = await client.GetAsync($"{url}&serviceId={other.Service.Id}");
        using var foreignStaff = await client.GetAsync($"{url}&serviceId={shop.Service.Id}&staffId={other.StaffA.Id}");

        Assert.Equal(HttpStatusCode.NotFound, foreignService.StatusCode);
        Assert.Equal("booking.service_not_found", await CodeAsync(foreignService));
        Assert.Equal(HttpStatusCode.NotFound, foreignStaff.StatusCode);
        Assert.Equal("booking.staff_not_found", await CodeAsync(foreignStaff));
    }

    [Fact]
    public async Task Days_endpoint_marks_only_working_days_and_limits_the_range()
    {
        var shop = await ArrangeShopAsync();
        using var client = _factory.CreateClient();
        var url = $"/api/public/tenants/{shop.Tenant.Slug}/availability/days?serviceId={shop.Service.Id}";

        var week = await client.GetFromJsonAsync<JsonElement>($"{url}&from=2027-03-01&to=2027-03-07");
        using var tooLong = await client.GetAsync($"{url}&from=2027-03-01&to=2027-06-01");

        var available = week.GetProperty("days").EnumerateArray()
            .Where(d => d.GetProperty("available").GetBoolean())
            .Select(d => d.GetProperty("date").GetString());
        Assert.Equal(["2027-03-02"], available);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Equal("booking.invalid_range", await CodeAsync(tooLong));
    }

    public void Dispose() => _factory.Dispose();
}
