using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>The "Clienti" page: list, detail, correction, export and erasure (DEC-038).</summary>
[Collection(DatabaseCollection.Name)]
public sealed class CustomerPageTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027 08:00 Rome.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset Past = new(2027, 2, 15, 9, 0, 0, TimeSpan.Zero);   // 15 Feb, 10:00 Rome
    private static readonly DateTimeOffset Future = new(2027, 3, 2, 9, 0, 0, TimeSpan.Zero);  // 2 Mar, 10:00 Rome

    private sealed record Shop(Tenant Tenant, StaffMember Staff, Service Service, AppUser Owner, AppUser StaffUser, AppUser Account, TenantCustomer Giulia, TenantCustomer Paolo);

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Anna");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio", duration: 30, buffer: 0);
        var account = await TestData.AddCustomerAsync(db); // Mario Rossi
        var giulia = await TestData.AddTenantCustomerAsync(db, tenant.Id, "Giulia", "Rossetti", "347 222 3344", "giulia@example.test");
        var paolo = await TestData.AddTenantCustomerAsync(db, tenant.Id, "Paolo", "Ferrari", "339 123 4567");

        var past = TestData.NewBusinessAppointment(tenant.Id, staff.Id, service, giulia.Id, Past);
        past.Status = AppointmentStatus.Completed;
        past.CustomerNote = "Sfumatura bassa";
        var future = TestData.NewBusinessAppointment(tenant.Id, staff.Id, service, giulia.Id, Future);
        future.CustomerNote = "Porta la foto";
        db.Appointments.AddRange(past, future, TestData.NewAppointment(tenant.Id, staff.Id, service, account.Id, Past.AddHours(2)));
        await db.SaveChangesAsync();

        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        var staffUser = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Staff));
        return new Shop(tenant, staff, service, owner, staffUser, account, giulia, paolo);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static string Names(JsonElement list) =>
        string.Join(", ", list.GetProperty("items").EnumerateArray()
            .Select(c => $"{c.GetProperty("kind").GetString()} {c.GetProperty("firstName").GetString()} {c.GetProperty("lastName").GetString()}"));

    [Fact]
    public async Task The_owner_lists_address_book_and_account_customers_of_their_business_only()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            await TestData.AddCustomerAsync(db); // an account that never booked here
            var gone = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Vecchio", "Cliente", "333 111 2222");
            await db.TenantCustomers.IgnoreQueryFilters().Where(c => c.Id == gone.Id).ExecuteUpdateAsync(c => c.SetProperty(x => x.AnonymizedAt, DateTimeOffset.UtcNow));
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        var all = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list");
        Assert.Equal("AddressBook Paolo Ferrari, AddressBook Giulia Rossetti, Account Mario Rossi", Names(all));
        Assert.Equal(3, all.GetProperty("total").GetInt32());

        var giulia = all.GetProperty("items")[1];
        Assert.Equal(2, giulia.GetProperty("appointments").GetInt32());
        Assert.Equal("2027-02-15T10:00:00+01:00", giulia.GetProperty("lastVisit").GetString());
        Assert.Equal("2027-03-02T10:00:00+01:00", giulia.GetProperty("nextAppointment").GetString());
        Assert.Equal(JsonValueKind.Null, all.GetProperty("items")[0].GetProperty("lastVisit").ValueKind);

        var accounts = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list?kind=Account");
        Assert.Equal("Account Mario Rossi", Names(accounts));
        var byPhone = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list?q=339%20123");
        Assert.Equal("AddressBook Paolo Ferrari", Names(byPhone));
        var paged = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list?page=2&pageSize=2");
        Assert.Equal("Account Mario Rossi", Names(paged));
        Assert.Equal(3, paged.GetProperty("total").GetInt32());

        // Another business sees its own customers only.
        using var otherSession = await TestUsers.LoginAsync(_factory, other.Owner);
        var theirs = await otherSession.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list");
        Assert.DoesNotContain(theirs.GetProperty("items").EnumerateArray(), c => c.GetProperty("id").GetGuid() == shop.Giulia.Id);
    }

    [Fact]
    public async Task Staff_members_cannot_open_the_customer_page()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.StaffUser);

        using var list = await session.Client.GetAsync("/api/admin/customers/list");
        using var detail = await session.Client.GetAsync($"/api/admin/customers/address-book/{shop.Giulia.Id}");
        using var appointments = await session.Client.GetAsync($"/api/admin/customers/address-book/{shop.Giulia.Id}/appointments");
        using var erase = await session.SendAsync(HttpMethod.Delete, $"/api/admin/customers/address-book/{shop.Giulia.Id}");
        // The search for the calendar dialog stays available to them.
        using var search = await session.Client.GetAsync("/api/admin/customers?q=ross");

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, detail.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, appointments.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, erase.StatusCode);
        Assert.Equal(HttpStatusCode.OK, search.StatusCode);
    }

    [Fact]
    public async Task Details_show_the_numbers_and_never_reveal_other_accounts()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        var giulia = await session.Client.GetFromJsonAsync<JsonElement>($"/api/admin/customers/address-book/{shop.Giulia.Id}");
        Assert.Equal("AddressBook", giulia.GetProperty("kind").GetString());
        var stats = giulia.GetProperty("stats");
        Assert.Equal(
            "total 2, upcoming 1, past 1, completed 1, noShow 0, cancelled 0",
            $"total {stats.GetProperty("total").GetInt32()}, upcoming {stats.GetProperty("upcoming").GetInt32()}, past {stats.GetProperty("past").GetInt32()}, "
            + $"completed {stats.GetProperty("completed").GetInt32()}, noShow {stats.GetProperty("noShow").GetInt32()}, cancelled {stats.GetProperty("cancelled").GetInt32()}");
        Assert.Equal("2027-02-15T10:00:00+01:00", stats.GetProperty("lastVisit").GetString());
        Assert.Equal("2027-03-02T10:00:00+01:00", stats.GetProperty("nextAppointment").GetString());

        var mario = await session.Client.GetFromJsonAsync<JsonElement>($"/api/admin/customers/account/{shop.Account.Id}");
        Assert.Equal("Account", mario.GetProperty("kind").GetString());
        Assert.Equal(1, mario.GetProperty("stats").GetProperty("total").GetInt32());
        Assert.Equal(JsonValueKind.Null, mario.GetProperty("stats").GetProperty("nextAppointment").ValueKind);

        using var foreignAccount = await session.Client.GetAsync($"/api/admin/customers/account/{other.Account.Id}");
        using var foreignEntry = await session.Client.GetAsync($"/api/admin/customers/address-book/{other.Giulia.Id}");
        using var foreignAccountAppointments = await session.Client.GetAsync($"/api/admin/customers/account/{other.Account.Id}/appointments");
        using var foreignEntryAppointments = await session.Client.GetAsync($"/api/admin/customers/address-book/{other.Giulia.Id}/appointments");
        Assert.Equal(HttpStatusCode.NotFound, foreignAccount.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignEntry.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignAccountAppointments.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreignEntryAppointments.StatusCode);
    }

    [Fact]
    public async Task A_regular_customer_s_appointments_come_ten_at_a_time()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            // 23 more past visits, one a week before 15 Feb, and two more upcoming ones.
            for (var week = 1; week <= 23; week++)
            {
                var visit = TestData.NewBusinessAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, shop.Giulia.Id, Past.AddDays(-7 * week));
                visit.Status = week == 5 ? AppointmentStatus.NoShow : AppointmentStatus.Completed;
                db.Appointments.Add(visit);
            }

            var cancelled = TestData.NewBusinessAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, shop.Giulia.Id, Future.AddDays(7));
            cancelled.Status = AppointmentStatus.CancelledByBusiness;
            db.Appointments.AddRange(cancelled, TestData.NewBusinessAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, shop.Giulia.Id, Future.AddDays(14)));
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        var path = $"/api/admin/customers/address-book/{shop.Giulia.Id}/appointments";

        var first = await session.Client.GetFromJsonAsync<JsonElement>(path);
        Assert.Equal(24, first.GetProperty("total").GetInt32());
        Assert.Equal(10, first.GetProperty("pageSize").GetInt32());
        var starts = first.GetProperty("items").EnumerateArray().Select(a => a.GetProperty("start").GetString()).ToList();
        Assert.Equal(10, starts.Count);
        Assert.Equal("2027-02-15T10:00:00+01:00", starts[0]); // newest first
        Assert.Equal("2027-02-08T10:00:00+01:00", starts[1]);

        var third = await session.Client.GetFromJsonAsync<JsonElement>($"{path}?when=past&page=3");
        Assert.Equal(4, third.GetProperty("items").GetArrayLength());

        var upcoming = await session.Client.GetFromJsonAsync<JsonElement>($"{path}?when=upcoming");
        Assert.Equal(
            ["2027-03-02T10:00:00+01:00 Confirmed", "2027-03-09T10:00:00+01:00 CancelledByBusiness", "2027-03-16T10:00:00+01:00 Confirmed"],
            upcoming.GetProperty("items").EnumerateArray().Select(a => $"{a.GetProperty("start").GetString()} {a.GetProperty("status").GetString()}"));

        var stats = (await session.Client.GetFromJsonAsync<JsonElement>($"/api/admin/customers/address-book/{shop.Giulia.Id}")).GetProperty("stats");
        Assert.Equal(27, stats.GetProperty("total").GetInt32());
        Assert.Equal(3, stats.GetProperty("upcoming").GetInt32());
        Assert.Equal(24, stats.GetProperty("past").GetInt32());
        Assert.Equal(23, stats.GetProperty("completed").GetInt32());
        Assert.Equal(1, stats.GetProperty("noShow").GetInt32());
        Assert.Equal(1, stats.GetProperty("cancelled").GetInt32());

        using var wrongWhen = await session.Client.GetAsync($"{path}?when=tomorrow");
        Assert.Equal(HttpStatusCode.BadRequest, wrongWhen.StatusCode);
    }

    [Fact]
    public async Task The_owner_corrects_an_address_book_entry()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var updated = await session.SendAsync(HttpMethod.Put, $"/api/admin/customers/address-book/{shop.Paolo.Id}",
            new { firstName = "Paolo", lastName = "Ferraro", phone = "339 765 4321", email = "paolo@example.test" });
        using var invalid = await session.SendAsync(HttpMethod.Put, $"/api/admin/customers/address-book/{shop.Paolo.Id}", new { firstName = "Paolo", lastName = "Ferraro", phone = "12" });
        using var foreign = await session.SendAsync(HttpMethod.Put, $"/api/admin/customers/address-book/{other.Paolo.Id}", new { firstName = "X", lastName = "Y", phone = "333 000 1111" });

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("Ferraro", (await JsonAsync(updated)).GetProperty("lastName").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);

        await using var db = database.CreateDbContext();
        var entry = await db.TenantCustomers.IgnoreQueryFilters().SingleAsync(c => c.Id == shop.Paolo.Id);
        Assert.Equal("3397654321", entry.PhoneDigits);
        Assert.Equal("paolo@example.test", entry.Email);
        var untouched = await db.TenantCustomers.IgnoreQueryFilters().SingleAsync(c => c.Id == other.Paolo.Id);
        Assert.Equal("Ferrari", untouched.LastName);
    }

    [Fact]
    public async Task The_owner_downloads_the_data_of_an_address_book_customer()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var response = await session.Client.GetAsync($"/api/admin/customers/address-book/{shop.Giulia.Id}/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("cliente-rossetti-giulia.json", response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName);
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString(), StringComparison.Ordinal);
        var document = await JsonAsync(response);
        Assert.Equal("347 222 3344", document.GetProperty("customer").GetProperty("phone").GetString());
        Assert.Equal(
            ["Sfumatura bassa", "Porta la foto"],
            document.GetProperty("appointments").EnumerateArray().Select(a => a.GetProperty("note").GetString()));
    }

    [Fact]
    public async Task Erasing_anonymises_the_entry_clears_notes_and_cancels_future_appointments_silently()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var erased = await session.SendAsync(HttpMethod.Delete, $"/api/admin/customers/address-book/{shop.Giulia.Id}");

        Assert.Equal(HttpStatusCode.OK, erased.StatusCode);
        Assert.Equal(1, (await JsonAsync(erased)).GetProperty("cancelledAppointments").GetInt32());
        Assert.Empty(_factory.Emails.SentTo("giulia@example.test"));

        await using (var db = database.CreateDbContext())
        {
            var entry = await db.TenantCustomers.IgnoreQueryFilters().SingleAsync(c => c.Id == shop.Giulia.Id);
            Assert.Equal("Cliente anonimo", $"{entry.FirstName} {entry.LastName}");
            Assert.Null(entry.Phone);
            Assert.Null(entry.PhoneDigits);
            Assert.Null(entry.Email);
            Assert.NotNull(entry.AnonymizedAt);

            var appointments = await db.Appointments.IgnoreQueryFilters()
                .Where(a => a.TenantCustomerId == shop.Giulia.Id).OrderBy(a => a.StartUtc).ToListAsync();
            Assert.Equal([AppointmentStatus.Completed, AppointmentStatus.CancelledByBusiness], appointments.Select(a => a.Status));
            Assert.All(appointments, a => Assert.Null(a.CustomerNote));
            Assert.Equal("Dati del cliente cancellati", appointments[1].CancellationReason);
        }

        // Gone from the page, the search and further actions.
        var list = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers/list?kind=AddressBook");
        Assert.Equal("AddressBook Paolo Ferrari", Names(list));
        var search = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers?q=ross");
        Assert.DoesNotContain(search.EnumerateArray(), c => c.GetProperty("id").GetGuid() == shop.Giulia.Id);
        using var again = await session.SendAsync(HttpMethod.Delete, $"/api/admin/customers/address-book/{shop.Giulia.Id}");
        using var export = await session.Client.GetAsync($"/api/admin/customers/address-book/{shop.Giulia.Id}/export");
        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, export.StatusCode);
    }

    public void Dispose() => _factory.Dispose();
}
