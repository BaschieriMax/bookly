using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 6: customers book, list and cancel appointments.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class BookingTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027 08:00 Rome. Shop works Tuesday 2 March 09:00–13:00.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset TenAm = new(2027, 3, 2, 10, 0, 0, TimeSpan.FromHours(1));

    private sealed record Shop(Tenant Tenant, StaffMember StaffA, StaffMember StaffB, Service Service);

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var a = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere A");
        var b = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere B");
        await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == b.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.SortOrder, 1));
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio", duration: 30, buffer: 10);
        foreach (var staff in new[] { a, b })
        {
            await TestData.EnableServiceAsync(db, tenant.Id, staff.Id, service.Id);
            await TestData.AddWorkingHoursAsync(db, tenant.Id, staff.Id, DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(13, 0));
        }

        return new Shop(tenant, a, b, service);
    }

    private static object Booking(Shop shop, DateTimeOffset start, Guid? staffId = null, string? note = null) =>
        new { serviceId = shop.Service.Id, staffId, start, note };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    [Fact]
    public async Task Confirmed_customer_books_a_free_slot_and_gets_an_email()
    {
        var shop = await ArrangeShopAsync();
        var customer = await TestUsers.CreateAsync(_factory);
        using var session = await TestUsers.LoginAsync(_factory, customer);

        using var response = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm, shop.StaffA.Id, "  sfumatura bassa "));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await JsonAsync(response);
        Assert.Equal("2027-03-02T10:00:00+01:00", body.GetProperty("start").GetString());
        Assert.Equal("2027-03-02T10:30:00+01:00", body.GetProperty("end").GetString());
        Assert.True(body.GetProperty("canCancel").GetBoolean());

        await using var db = database.CreateDbContext(shop.Tenant.Id);
        var saved = await db.Appointments.SingleAsync(a => a.CustomerId == customer.Id);
        Assert.Equal(shop.StaffA.Id, saved.StaffMemberId);
        Assert.Equal(TenAm.AddMinutes(40), saved.BlockedUntilUtc);
        Assert.Equal("sfumatura bassa", saved.CustomerNote);

        var email = Assert.Single(_factory.Emails.SentTo(customer.Email!));
        Assert.Contains("martedì 2 marzo 2027, 10:00", email.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Unconfirmed_email_cannot_book_and_anonymous_users_are_unauthorized()
    {
        var shop = await ArrangeShopAsync();
        var unconfirmed = await TestUsers.CreateAsync(_factory, emailConfirmed: false);
        using var session = await TestUsers.LoginAsync(_factory, unconfirmed);
        using var anonymous = _factory.CreateSession();

        using var forbidden = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm));
        using var unauthorized = await anonymous.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm));

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal("booking.email_not_confirmed", await CodeAsync(forbidden));
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public async Task A_time_that_is_not_an_offered_slot_is_rejected()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, await TestUsers.CreateAsync(_factory));

        using var misaligned = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm.AddMinutes(5)));
        using var closed = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm.AddDays(1)));

        Assert.Equal(HttpStatusCode.Conflict, misaligned.StatusCode);
        Assert.Equal("booking.slot_unavailable", await CodeAsync(misaligned));
        Assert.Equal(HttpStatusCode.Conflict, closed.StatusCode);
    }

    [Fact]
    public async Task Any_staff_assigns_the_least_busy_free_barber()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, await TestUsers.CreateAsync(_factory));
        using (var first = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm.AddHours(-1), shop.StaffA.Id)))
        {
            Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        }

        using var response = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("Barbiere B", (await JsonAsync(response)).GetProperty("staffName").GetString());
    }

    [Fact]
    public async Task Concurrent_bookings_of_the_last_free_slot_give_one_201_and_409s()
    {
        var shop = await ArrangeShopAsync();
        var sessions = new List<ApiSession>();
        for (var i = 0; i < 4; i++)
        {
            sessions.Add(await TestUsers.LoginAsync(_factory, await TestUsers.CreateAsync(_factory)));
        }

        var responses = await Task.WhenAll(sessions.Select(s =>
            s.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm, shop.StaffA.Id))));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.Created), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        foreach (var response in responses)
        {
            response.Dispose();
        }

        sessions.ForEach(s => s.Dispose());
    }

    [Fact]
    public async Task Service_of_another_tenant_is_not_found()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, await TestUsers.CreateAsync(_factory));

        using var response = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(other, TenAm));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("booking.service_not_found", await CodeAsync(response));
    }

    [Fact]
    public async Task Customers_only_see_their_own_appointments()
    {
        var shop = await ArrangeShopAsync();
        var mario = await TestUsers.CreateAsync(_factory);
        var luigi = await TestUsers.CreateAsync(_factory);
        using var marioSession = await TestUsers.LoginAsync(_factory, mario);
        using var luigiSession = await TestUsers.LoginAsync(_factory, luigi);
        (await marioSession.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm))).Dispose();

        var marioList = await marioSession.Client.GetFromJsonAsync<JsonElement[]>("/api/me/appointments");
        var luigiList = await luigiSession.Client.GetFromJsonAsync<JsonElement[]>("/api/me/appointments");
        var marioPast = await marioSession.Client.GetFromJsonAsync<JsonElement[]>("/api/me/appointments?scope=past");

        var item = Assert.Single(marioList!);
        Assert.Equal(shop.Tenant.Slug, item.GetProperty("tenant").GetProperty("slug").GetString());
        Assert.Equal("Taglio", item.GetProperty("serviceName").GetString());
        Assert.Empty(luigiList!);
        Assert.Empty(marioPast!);
    }

    [Fact]
    public async Task Cancel_rules_window_ownership_and_state()
    {
        var shop = await ArrangeShopAsync();
        var mario = await TestUsers.CreateAsync(_factory);
        var luigi = await TestUsers.CreateAsync(_factory);
        using var marioSession = await TestUsers.LoginAsync(_factory, mario);
        using var luigiSession = await TestUsers.LoginAsync(_factory, luigi);
        using var booked = await marioSession.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm));
        var id = (await JsonAsync(booked)).GetProperty("id").GetGuid();

        using var notMine = await luigiSession.PostAsync($"/api/me/appointments/{id}/cancel");
        using var cancelled = await marioSession.PostAsync($"/api/me/appointments/{id}/cancel");
        using var again = await marioSession.PostAsync($"/api/me/appointments/{id}/cancel");

        Assert.Equal(HttpStatusCode.NotFound, notMine.StatusCode);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        Assert.Equal("CancelledByCustomer", (await JsonAsync(cancelled)).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains(_factory.Emails.SentTo(mario.Email!), m => m.Subject.StartsWith("Prenotazione disdetta", StringComparison.Ordinal));

        // The freed slot can be booked again.
        using var rebook = await luigiSession.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm, shop.StaffA.Id));
        Assert.Equal(HttpStatusCode.Created, rebook.StatusCode);
    }

    [Fact]
    public async Task Cancelling_inside_the_window_is_refused_with_422()
    {
        var shop = await ArrangeShopAsync();
        var mario = await TestUsers.CreateAsync(_factory);
        using var factory = new BooklyApiFactory(database);
        using var session = await TestUsers.LoginAsync(factory, mario);
        using var booked = await session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", Booking(shop, TenAm));
        var id = (await JsonAsync(booked)).GetProperty("id").GetGuid();

        factory.Clock.SetUtcNow(TenAm.AddHours(-11)); // window is 12 hours
        using var response = await session.PostAsync($"/api/me/appointments/{id}/cancel");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("booking.cancellation_window_passed", await CodeAsync(response));
    }

    public void Dispose() => _factory.Dispose();
}
