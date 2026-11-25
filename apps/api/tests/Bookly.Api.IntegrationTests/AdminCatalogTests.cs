using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 8: the owner manages catalog, schedule, settings and brand; staff only their own schedule.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class AdminCatalogTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    private sealed record Shop(Tenant Tenant, StaffMember Staff, Service Service, AppUser Owner);

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Luca");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio");
        await TestData.EnableServiceAsync(db, tenant.Id, staff.Id, service.Id);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        return new Shop(tenant, staff, service, owner);
    }

    private async Task<(AppUser User, StaffMember Staff)> AddStaffWithLoginAsync(Guid tenantId)
    {
        var user = await TestUsers.CreateAsync(_factory, memberships: (tenantId, TenantRole.Staff));
        await using var db = database.CreateDbContext(tenantId);
        var staff = await TestData.AddStaffAsync(db, tenantId, "Giulia");
        await db.StaffMembers.Where(s => s.Id == staff.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, user.Id));
        return (user, staff);
    }

    private static object ServiceBody(string name = "Barba", int duration = 20) =>
        new { name, description = (string?)null, durationMinutes = duration, bufferMinutes = 5, priceCents = 1500, priceIsFrom = false, isActive = true, sortOrder = 1 };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    [Fact]
    public async Task Owner_creates_updates_and_deletes_a_service()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var created = await session.PostAsync("/api/admin/services", ServiceBody());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();

        using var updated = await session.SendAsync(HttpMethod.Put, $"/api/admin/services/{id}", ServiceBody("Barba e baffi", 25));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(25, (await JsonAsync(updated)).GetProperty("durationMinutes").GetInt32());

        var list = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/services");
        Assert.Equal(2, list.GetArrayLength());

        using var deleted = await session.SendAsync(HttpMethod.Delete, $"/api/admin/services/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task Service_with_appointments_cannot_be_deleted()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            var customer = await TestData.AddCustomerAsync(db);
            db.Appointments.Add(TestData.NewAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, customer.Id, new DateTimeOffset(2027, 3, 2, 9, 0, 0, TimeSpan.Zero)));
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        using var response = await session.SendAsync(HttpMethod.Delete, $"/api/admin/services/{shop.Service.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("admin.in_use", await CodeAsync(response));
    }

    [Fact]
    public async Task Owner_saves_staff_with_the_services_they_offer()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var created = await session.PostAsync("/api/admin/staff", new { displayName = "Marco", isActive = true, sortOrder = 2, serviceIds = new[] { shop.Service.Id } });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await JsonAsync(created);
        Assert.Equal(shop.Service.Id, body.GetProperty("serviceIds")[0].GetGuid());

        var staffId = body.GetProperty("id").GetGuid();
        using var cleared = await session.SendAsync(HttpMethod.Put, $"/api/admin/staff/{staffId}", new { displayName = "Marco", isActive = false, sortOrder = 2, serviceIds = Array.Empty<Guid>() });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Equal(0, (await JsonAsync(cleared)).GetProperty("serviceIds").GetArrayLength());
    }

    [Fact]
    public async Task Staff_cannot_link_services_of_another_tenant()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var response = await session.PostAsync("/api/admin/staff", new { displayName = "Marco", isActive = true, sortOrder = 0, serviceIds = new[] { other.Service.Id } });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Owner_replaces_weekly_hours_and_overlaps_are_rejected()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        var path = $"/api/admin/staff/{shop.Staff.Id}/working-hours";

        using var overlapping = await session.SendAsync(HttpMethod.Put, path, new
        {
            intervals = new[] { new { dayOfWeek = 2, start = "09:00", end = "13:00" }, new { dayOfWeek = 2, start = "12:00", end = "18:00" } },
        });
        Assert.Equal(HttpStatusCode.BadRequest, overlapping.StatusCode);
        Assert.Equal("admin.overlapping_hours", await CodeAsync(overlapping));

        using var saved = await session.SendAsync(HttpMethod.Put, path, new
        {
            intervals = new[] { new { dayOfWeek = 2, start = "15:00", end = "19:00" }, new { dayOfWeek = 2, start = "09:00", end = "13:00" } },
        });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        var hours = await session.Client.GetFromJsonAsync<JsonElement>(path);
        Assert.Equal(2, hours.GetArrayLength());
        Assert.Equal("09:00:00", hours[0].GetProperty("start").GetString());
    }

    [Fact]
    public async Task Time_off_reports_the_confirmed_appointments_it_overlaps()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            var customer = await TestData.AddCustomerAsync(db);
            db.Appointments.Add(TestData.NewAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, customer.Id, new DateTimeOffset(2027, 3, 2, 9, 0, 0, TimeSpan.Zero)));
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        var path = $"/api/admin/staff/{shop.Staff.Id}/time-off";
        using var created = await session.PostAsync(path, new { startDate = "2027-03-02", endDate = "2027-03-02", reason = "Ferie" });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await JsonAsync(created);
        Assert.Equal(1, body.GetProperty("conflictingAppointments").GetInt32());
        Assert.Equal("2027-03-02T00:00:00+01:00", body.GetProperty("timeOff").GetProperty("start").GetString());
        Assert.Equal("2027-03-03T00:00:00+01:00", body.GetProperty("timeOff").GetProperty("end").GetString());

        var id = body.GetProperty("timeOff").GetProperty("id").GetGuid();
        using var deleted = await session.SendAsync(HttpMethod.Delete, $"{path}/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task Time_off_with_hours_is_converted_with_the_offset_of_its_date()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        // 28 March 2027: Italy switches to summer time (+02:00) during the night.
        using var created = await session.PostAsync($"/api/admin/staff/{shop.Staff.Id}/time-off", new
        {
            startDate = "2027-03-27",
            startTime = "15:00",
            endDate = "2027-03-28",
            endTime = "12:00",
        });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var timeOff = (await JsonAsync(created)).GetProperty("timeOff");
        Assert.Equal("2027-03-27T15:00:00+01:00", timeOff.GetProperty("start").GetString());
        Assert.Equal("2027-03-28T12:00:00+02:00", timeOff.GetProperty("end").GetString());

        using var reversed = await session.PostAsync($"/api/admin/staff/{shop.Staff.Id}/time-off", new
        {
            startDate = "2027-03-28",
            startTime = "12:00",
            endDate = "2027-03-28",
            endTime = "09:00",
        });
        Assert.Equal(HttpStatusCode.BadRequest, reversed.StatusCode);
    }

    [Fact]
    public async Task Staff_manages_only_their_own_schedule_and_cannot_change_the_catalog()
    {
        var shop = await ArrangeShopAsync();
        var (user, own) = await AddStaffWithLoginAsync(shop.Tenant.Id);
        using var session = await TestUsers.LoginAsync(_factory, user);

        var staffList = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/staff");
        Assert.Contains(staffList.EnumerateArray(), s => s.GetProperty("id").GetGuid() == own.Id && s.GetProperty("isMe").GetBoolean());

        using var ownHours = await session.SendAsync(HttpMethod.Put, $"/api/admin/staff/{own.Id}/working-hours", new { intervals = new[] { new { dayOfWeek = 1, start = "09:00", end = "12:00" } } });
        Assert.Equal(HttpStatusCode.OK, ownHours.StatusCode);

        using var otherHours = await session.Client.GetAsync($"/api/admin/staff/{shop.Staff.Id}/working-hours");
        Assert.Equal(HttpStatusCode.Forbidden, otherHours.StatusCode);
        Assert.Equal("admin.staff_scope", await CodeAsync(otherHours));

        using var createService = await session.PostAsync("/api/admin/services", ServiceBody());
        Assert.Equal(HttpStatusCode.Forbidden, createService.StatusCode);

        using var settings = await session.Client.GetAsync("/api/admin/settings");
        Assert.Equal(HttpStatusCode.Forbidden, settings.StatusCode);
    }

    [Fact]
    public async Task Owner_of_another_tenant_gets_404_on_every_resource()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, other.Owner);

        using var service = await session.SendAsync(HttpMethod.Put, $"/api/admin/services/{shop.Service.Id}", ServiceBody());
        using var deleteService = await session.SendAsync(HttpMethod.Delete, $"/api/admin/services/{shop.Service.Id}");
        using var staff = await session.SendAsync(HttpMethod.Put, $"/api/admin/staff/{shop.Staff.Id}", new { displayName = "X", isActive = true, sortOrder = 0, serviceIds = Array.Empty<Guid>() });
        using var hours = await session.Client.GetAsync($"/api/admin/staff/{shop.Staff.Id}/working-hours");
        using var timeOff = await session.PostAsync($"/api/admin/staff/{shop.Staff.Id}/time-off", new { startDate = "2027-03-02", endDate = "2027-03-02" });

        Assert.All([service, deleteService, staff, hours, timeOff], r => Assert.Equal(HttpStatusCode.NotFound, r.StatusCode));

        var services = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/services");
        Assert.DoesNotContain(services.EnumerateArray(), s => s.GetProperty("id").GetGuid() == shop.Service.Id);
    }

    [Fact]
    public async Task Anonymous_and_customers_cannot_use_the_admin_api()
    {
        await ArrangeShopAsync();
        using var anonymous = _factory.CreateSession();
        using var anonymousResponse = await anonymous.Client.GetAsync("/api/admin/services");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);

        var customer = await TestUsers.CreateAsync(_factory);
        using var session = await TestUsers.LoginAsync(_factory, customer);
        using var customerResponse = await session.Client.GetAsync("/api/admin/services");
        Assert.Equal(HttpStatusCode.Forbidden, customerResponse.StatusCode);
    }

    [Fact]
    public async Task Owner_saves_settings_and_unknown_time_zones_are_rejected()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        object Settings(string timeZone) => new
        {
            name = "Sfumo Barber",
            phone = "+39 059 123456",
            address = "Via Emilia 1, Modena",
            timeZone,
            cancellationWindowHours = 24,
            slotIntervalMinutes = 30,
            minNoticeMinutes = 120,
            bookingHorizonDays = 30,
            notifyOnCustomerCancellation = true,
            notifyOnOnlineBooking = false,
        };

        using var invalid = await session.SendAsync(HttpMethod.Put, "/api/admin/settings", Settings("Mars/Olympus"));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("admin.invalid_time_zone", await CodeAsync(invalid));

        using var saved = await session.SendAsync(HttpMethod.Put, "/api/admin/settings", Settings("Europe/Rome"));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var savedBody = await JsonAsync(saved);
        Assert.True(savedBody.GetProperty("notifyOnCustomerCancellation").GetBoolean());
        Assert.False(savedBody.GetProperty("notifyOnOnlineBooking").GetBoolean());

        var publicInfo = await session.Client.GetFromJsonAsync<JsonElement>($"/api/public/tenants/{shop.Tenant.Slug}");
        Assert.Equal("Sfumo Barber", publicInfo.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Brand_and_logo_are_validated_and_served_publicly()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var brand = await session.SendAsync(HttpMethod.Put, "/api/admin/brand", new { primaryColor = "#2F6B4F", ground = "Dark", headingFont = "Serif" });
        Assert.Equal(HttpStatusCode.OK, brand.StatusCode);
        Assert.Equal("#2f6b4f", (await JsonAsync(brand)).GetProperty("primaryColor").GetString());

        using var badColor = await session.SendAsync(HttpMethod.Put, "/api/admin/brand", new { primaryColor = "red", ground = "Dark", headingFont = "Serif" });
        Assert.Equal(HttpStatusCode.BadRequest, badColor.StatusCode);

        // An SVG renamed to .png is rejected by its real signature.
        using var svg = await UploadLogoAsync(session, "<svg xmlns=\"http://www.w3.org/2000/svg\"/>"u8.ToArray(), "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, svg.StatusCode);
        Assert.Equal("admin.invalid_logo", await CodeAsync(svg));

        using var tooBig = await UploadLogoAsync(session, PngBytes(300 * 1024), "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, tooBig.StatusCode);

        using var png = await UploadLogoAsync(session, PngBytes(1024), "image/png");
        Assert.Equal(HttpStatusCode.OK, png.StatusCode);
        Assert.True((await JsonAsync(png)).GetProperty("hasLogo").GetBoolean());

        using var logo = await session.Client.GetAsync($"/api/public/tenants/{shop.Tenant.Slug}/logo");
        Assert.Equal(HttpStatusCode.OK, logo.StatusCode);
        Assert.Equal("image/png", logo.Content.Headers.ContentType?.MediaType);

        using var removed = await session.SendAsync(HttpMethod.Delete, "/api/admin/brand/logo");
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
    }

    [Fact]
    public async Task Logo_upload_can_carry_a_home_screen_icon_served_with_a_manifest()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        var slug = shop.Tenant.Slug;

        // Wrong size: the browser always sends 256×256.
        using var wrongSize = await UploadLogoAsync(session, PngBytes(1024), "image/png", IconPng(512));
        Assert.Equal(HttpStatusCode.BadRequest, wrongSize.StatusCode);
        Assert.Equal("admin.invalid_logo", await CodeAsync(wrongSize));

        using var withIcon = await UploadLogoAsync(session, PngBytes(1024), "image/png", IconPng(256));
        Assert.Equal(HttpStatusCode.OK, withIcon.StatusCode);

        var publicInfo = await session.Client.GetFromJsonAsync<JsonElement>($"/api/public/tenants/{slug}");
        Assert.True(publicInfo.GetProperty("brand").GetProperty("hasHomeIcon").GetBoolean());

        using var icon = await session.Client.GetAsync($"/api/public/tenants/{slug}/icon");
        Assert.Equal(HttpStatusCode.OK, icon.StatusCode);
        Assert.Equal("image/png", icon.Content.Headers.ContentType?.MediaType);
        Assert.Equal(IconPng(256), await icon.Content.ReadAsByteArrayAsync());

        using var manifest = await session.Client.GetAsync($"/api/public/tenants/{slug}/manifest.webmanifest");
        Assert.Equal(HttpStatusCode.OK, manifest.StatusCode);
        Assert.Equal("application/manifest+json", manifest.Content.Headers.ContentType?.MediaType);
        var body = await JsonAsync(manifest);
        Assert.Equal(shop.Tenant.Name, body.GetProperty("name").GetString());
        Assert.Equal(shop.Tenant.Name, body.GetProperty("short_name").GetString());
        Assert.Equal($"/b/{slug}", body.GetProperty("start_url").GetString());
        Assert.Equal($"/b/{slug}", body.GetProperty("scope").GetString());
        Assert.Equal("browser", body.GetProperty("display").GetString());
        var only = Assert.Single(body.GetProperty("icons").EnumerateArray());
        Assert.Equal($"/api/public/tenants/{slug}/icon", only.GetProperty("src").GetString());
        Assert.False(only.TryGetProperty("purpose", out _));

        // A new logo without an icon must not keep the icon of the old one.
        using var withoutIcon = await UploadLogoAsync(session, PngBytes(2048), "image/png");
        Assert.Equal(HttpStatusCode.OK, withoutIcon.StatusCode);
        using var gone = await session.Client.GetAsync($"/api/public/tenants/{slug}/icon");
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
        var fallback = await session.Client.GetFromJsonAsync<JsonElement>($"/api/public/tenants/{slug}/manifest.webmanifest");
        Assert.Equal("/icon-192.png", fallback.GetProperty("icons")[0].GetProperty("src").GetString());
        Assert.Equal("maskable", fallback.GetProperty("icons")[2].GetProperty("purpose").GetString());

        using var unknown = await session.Client.GetAsync("/api/public/tenants/non-esiste/manifest.webmanifest");
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    private static async Task<HttpResponseMessage> UploadLogoAsync(ApiSession session, byte[] bytes, string contentType, byte[]? icon = null)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { file, "logo", "logo.png" } };
        if (icon is not null)
        {
            var iconFile = new ByteArrayContent(icon);
            iconFile.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            form.Add(iconFile, "icon", "icon.png");
        }

        return await session.SendContentAsync(HttpMethod.Put, "/api/admin/brand/logo", form);
    }

    /// <summary>PNG signature + IHDR of a square image: all the server checks about the icon.</summary>
    private static byte[] IconPng(uint size)
    {
        var bytes = new byte[64];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13 }.CopyTo(bytes, 0);
        "IHDR"u8.CopyTo(bytes.AsSpan(12));
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(16), size);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(20), size);
        return bytes;
    }

    private static byte[] PngBytes(int length)
    {
        var bytes = new byte[length];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(bytes, 0);
        return bytes;
    }

    public void Dispose() => _factory.Dispose();
}
