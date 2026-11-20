using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Appointments entered by the business from the calendar, and its address book (DEC-037).</summary>
[Collection(DatabaseCollection.Name)]
public sealed class BusinessAppointmentTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027 08:00 Rome. Both staff work Tuesday 2 March 09:00–13:00.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset TenAm = new(2027, 3, 2, 9, 0, 0, TimeSpan.Zero); // 10:00 in Rome

    private sealed record Shop(Tenant Tenant, StaffMember A, StaffMember B, Service Service, AppUser Owner, AppUser StaffUserB, AppUser Customer);

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == tenant.Id).ExecuteUpdateAsync(t => t
            .SetProperty(x => x.Name, "Sfumo Barber")
            .SetProperty(x => x.Phone, "059 123456"));
        var a = await TestData.AddStaffAsync(db, tenant.Id, "Anna");
        var b = await TestData.AddStaffAsync(db, tenant.Id, "Bruno");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio", duration: 30, buffer: 10);
        foreach (var staff in new[] { a, b })
        {
            await TestData.EnableServiceAsync(db, tenant.Id, staff.Id, service.Id);
            await TestData.AddWorkingHoursAsync(db, tenant.Id, staff.Id, DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(13, 0));
        }

        // An account customer who already booked online here (10:00 with Anna).
        var customer = await TestData.AddCustomerAsync(db);
        db.Appointments.Add(TestData.NewAppointment(tenant.Id, a.Id, service, customer.Id, TenAm));
        await db.SaveChangesAsync();

        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        var staffUser = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Staff));
        await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == b.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, staffUser.Id).SetProperty(x => x.SortOrder, 1));

        return new Shop(await db.Tenants.SingleAsync(t => t.Id == tenant.Id), a, b, service, owner, staffUser, customer);
    }

    private static Task<HttpResponseMessage> CreateAsync(
        ApiSession session,
        Shop shop,
        string time,
        Guid? staffId = null,
        Guid? customerAccountId = null,
        Guid? tenantCustomerId = null,
        object? newCustomer = null,
        bool notifyCustomer = true,
        bool allowOutsideHours = false,
        string date = "2027-03-02") =>
        session.PostAsync("/api/admin/appointments", new
        {
            serviceId = shop.Service.Id,
            staffId = staffId ?? shop.A.Id,
            date,
            time,
            customerAccountId,
            tenantCustomerId,
            newCustomer,
            note = "Sfumatura bassa",
            notifyCustomer,
            allowOutsideHours,
        });

    private static readonly object Giulia = new { firstName = "Giulia", lastName = "Bianchi", phone = "347 222 3344", email = "giulia@example.test" };

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    [Fact]
    public async Task Owner_enters_an_appointment_for_a_new_customer_who_stays_in_the_address_book()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var created = await CreateAsync(session, shop, "11:00", newCustomer: Giulia);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await JsonAsync(created);
        Assert.Equal("Business", body.GetProperty("origin").GetString());
        Assert.Equal("2027-03-02T11:00:00+01:00", body.GetProperty("start").GetString());
        Assert.Equal("Sfumatura bassa", body.GetProperty("customerNote").GetString());
        var customer = body.GetProperty("customer");
        Assert.False(customer.GetProperty("hasAccount").GetBoolean());
        Assert.Equal("Giulia", customer.GetProperty("firstName").GetString());
        Assert.Equal("347 222 3344", customer.GetProperty("phone").GetString());

        await using (var db = database.CreateDbContext())
        {
            var appointment = await db.Appointments.IgnoreQueryFilters().SingleAsync(a => a.Id == body.GetProperty("id").GetGuid());
            Assert.Null(appointment.CustomerId);
            Assert.Equal(shop.Owner.Id, appointment.CreatedByUserId);
            Assert.Equal(AppointmentOrigin.Business, appointment.Origin);
            var entry = await db.TenantCustomers.IgnoreQueryFilters().SingleAsync(c => c.Id == appointment.TenantCustomerId);
            Assert.Equal(shop.Tenant.Id, entry.TenantId);
            Assert.Equal("3472223344", entry.PhoneDigits);
        }

        var email = Assert.Single(_factory.Emails.SentTo("giulia@example.test"));
        Assert.Equal("Appuntamento confermato da Sfumo Barber", email.Subject);
        Assert.Contains("martedì 2 marzo 2027, 11:00", email.TextBody, StringComparison.Ordinal);
        Assert.Contains($"/b/{shop.Tenant.Slug}", email.TextBody, StringComparison.Ordinal);
        Assert.Contains("al numero 059 123456", email.TextBody, StringComparison.Ordinal);

        // The same person again (other spacing and case): no duplicate in the address book.
        using var again = await CreateAsync(session, shop, "12:00", newCustomer: new { firstName = "giulia", lastName = "BIANCHI", phone = "3472223344" });
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);
        await using var check = database.CreateDbContext();
        Assert.Equal(1, await check.TenantCustomers.IgnoreQueryFilters().CountAsync(c => c.TenantId == shop.Tenant.Id));
    }

    [Fact]
    public async Task No_email_without_an_address_or_when_the_business_turns_it_off()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var noAddress = await CreateAsync(session, shop, "11:00", newCustomer: new { firstName = "Paolo", lastName = "Ferrari", phone = "339 123 4567" });
        using var turnedOff = await CreateAsync(session, shop, "12:00", customerAccountId: shop.Customer.Id, notifyCustomer: false);

        Assert.Equal(HttpStatusCode.Created, noAddress.StatusCode);
        Assert.Equal(HttpStatusCode.Created, turnedOff.StatusCode);
        Assert.Empty(_factory.Emails.SentTo(shop.Customer.Email!));
    }

    [Fact]
    public async Task An_account_customer_gets_the_link_to_their_bookings()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var created = await CreateAsync(session, shop, "11:30", customerAccountId: shop.Customer.Id);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await JsonAsync(created);
        Assert.True(body.GetProperty("customer").GetProperty("hasAccount").GetBoolean());
        var email = Assert.Single(_factory.Emails.SentTo(shop.Customer.Email!));
        Assert.Contains("/account/appuntamenti", email.TextBody, StringComparison.Ordinal);

        // Linked to the account: the customer sees it among their own bookings.
        var id = body.GetProperty("id").GetGuid();
        await using var db = database.CreateDbContext();
        var stored = await db.Appointments.IgnoreQueryFilters().SingleAsync(a => a.Id == id);
        Assert.Equal(shop.Customer.Id, stored.CustomerId);
        Assert.Null(stored.TenantCustomerId);
    }

    [Fact]
    public async Task The_customer_must_be_exactly_one_and_belong_to_the_business()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        Guid strangerId, foreignEntryId;
        await using (var db = database.CreateDbContext())
        {
            strangerId = (await TestData.AddCustomerAsync(db)).Id; // never booked with this business
            foreignEntryId = (await TestData.AddTenantCustomerAsync(db, other.Tenant.Id, "Rossella", "Neri", "333 999 0000")).Id;
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var none = await CreateAsync(session, shop, "11:00");
        using var two = await CreateAsync(session, shop, "11:00", customerAccountId: shop.Customer.Id, newCustomer: Giulia);
        using var stranger = await CreateAsync(session, shop, "11:00", customerAccountId: strangerId);
        using var foreignEntry = await CreateAsync(session, shop, "11:00", tenantCustomerId: foreignEntryId);
        using var badPhone = await CreateAsync(session, shop, "11:00", newCustomer: new { firstName = "A", lastName = "B", phone = "12-34" });

        Assert.Equal(HttpStatusCode.BadRequest, none.StatusCode);
        Assert.Equal("admin.customer_required", await CodeAsync(none));
        Assert.Equal(HttpStatusCode.BadRequest, two.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, stranger.StatusCode);
        Assert.Equal("admin.customer_not_found", await CodeAsync(stranger));
        Assert.Equal(HttpStatusCode.NotFound, foreignEntry.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, badPhone.StatusCode);
    }

    [Fact]
    public async Task Outside_hours_needs_confirmation_but_overlaps_and_the_past_are_always_refused()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            db.TimeOffs.Add(new TimeOff
            {
                Id = Guid.NewGuid(),
                TenantId = shop.Tenant.Id,
                StaffMemberId = shop.B.Id,
                StartUtc = new DateTimeOffset(2027, 3, 2, 11, 0, 0, TimeSpan.Zero), // 12:00–13:00 Rome
                EndUtc = new DateTimeOffset(2027, 3, 2, 12, 0, 0, TimeSpan.Zero),
            });
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var afterHours = await CreateAsync(session, shop, "19:30", newCustomer: Giulia);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, afterHours.StatusCode);
        Assert.Equal("admin.outside_working_hours", await CodeAsync(afterHours));
        using var duringTimeOff = await CreateAsync(session, shop, "12:00", staffId: shop.B.Id, newCustomer: Giulia);
        Assert.Equal("admin.outside_working_hours", await CodeAsync(duringTimeOff));

        using var confirmed = await CreateAsync(session, shop, "19:30", newCustomer: Giulia, allowOutsideHours: true);
        Assert.Equal(HttpStatusCode.Created, confirmed.StatusCode);

        // 10:00 with Anna is taken (online booking): confirming does not override the database.
        using var overlap = await CreateAsync(session, shop, "10:15", newCustomer: Giulia, allowOutsideHours: true);
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);
        Assert.Equal("booking.slot_unavailable", await CodeAsync(overlap));

        using var past = await CreateAsync(session, shop, "07:30", newCustomer: Giulia, allowOutsideHours: true, date: "2027-03-01");
        Assert.Equal("admin.in_past", await CodeAsync(past));

        await using var check = database.CreateDbContext();
        Assert.Equal(1, await check.Appointments.IgnoreQueryFilters().CountAsync(a => a.TenantId == shop.Tenant.Id && a.Origin == AppointmentOrigin.Business));
    }

    [Fact]
    public async Task Staff_enter_appointments_only_for_themselves()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.StaffUserB);

        using var own = await CreateAsync(session, shop, "11:00", staffId: shop.B.Id, newCustomer: Giulia);
        using var colleague = await CreateAsync(session, shop, "11:00", staffId: shop.A.Id, newCustomer: Giulia);

        Assert.Equal(HttpStatusCode.Created, own.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, colleague.StatusCode);
        Assert.Equal("admin.staff_scope", await CodeAsync(colleague));
    }

    [Fact]
    public async Task Search_finds_the_address_book_and_the_accounts_that_booked_here_only()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Luca", "Rossini", "333 123 4567", "luca@example.test");
            await TestData.AddTenantCustomerAsync(db, other.Tenant.Id, "Rossella", "Neri", "333 999 0000");
            // An account that booked only with the other business.
            var elsewhere = await TestData.AddCustomerAsync(db);
            await db.Users.Where(u => u.Id == elsewhere.Id).ExecuteUpdateAsync(u => u.SetProperty(x => x.LastName, "Rossetti"));
            db.Appointments.Add(TestData.NewAppointment(other.Tenant.Id, other.A.Id, other.Service, elsewhere.Id, TenAm.AddHours(1)));
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        var byName = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers?q=ross");
        Assert.Equal(
            ["Account Mario Rossi", "AddressBook Luca Rossini"],
            byName.EnumerateArray().Select(c => $"{c.GetProperty("kind").GetString()} {c.GetProperty("firstName").GetString()} {c.GetProperty("lastName").GetString()}"));

        var byPhone = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers?q=123%2045");
        Assert.Equal("Rossini", Assert.Single(byPhone.EnumerateArray()).GetProperty("lastName").GetString());

        var tooShort = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers?q=r");
        Assert.Equal(0, tooShort.GetArrayLength());
        var wildcard = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/customers?q=%25%25");
        Assert.Equal(0, wildcard.GetArrayLength());

        using var anonymous = _factory.CreateClient();
        using var refused = await anonymous.GetAsync("/api/admin/customers?q=ross");
        Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
    }

    [Fact]
    public async Task Calendar_moves_notify_an_address_book_customer_with_the_business_page()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        using var created = await CreateAsync(session, shop, "11:00", newCustomer: Giulia);
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();

        var day = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-03-02&to=2027-03-02");
        var listed = day.GetProperty("appointments").EnumerateArray().Single(a => a.GetProperty("id").GetGuid() == id);
        Assert.False(listed.GetProperty("customer").GetProperty("hasAccount").GetBoolean());

        using var moved = await session.PostAsync($"/api/admin/appointments/{id}/move", new { date = "2027-03-02", time = "12:00" });

        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        var email = _factory.Emails.SentTo("giulia@example.test").Single(m => m.Subject.StartsWith("Appuntamento spostato", StringComparison.Ordinal));
        Assert.Contains($"/b/{shop.Tenant.Slug}", email.TextBody, StringComparison.Ordinal);
        Assert.Contains("contatta l'attività al numero 059 123456", email.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Reminders_reach_address_book_customers_only_when_the_business_allows_it()
    {
        var now = new DateTimeOffset(2032, 5, 10, 8, 0, 0, TimeSpan.Zero);
        _factory.Clock.SetUtcNow(now);
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            var withEmail = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Giulia", "Bianchi", "347 222 3344", "giulia.reminder@example.test");
            var optedOut = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Paolo", "Ferrari", "339 123 4567", "paolo.reminder@example.test");
            var noEmail = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Sara", "Galli", "333 000 4444");
            var start = now.AddHours(20);
            foreach (var (entry, notify, offset) in new[] { (withEmail, true, 0), (optedOut, false, 1), (noEmail, true, 2) })
            {
                var appointment = TestData.NewBusinessAppointment(shop.Tenant.Id, shop.A.Id, shop.Service, entry.Id, start.AddHours(offset), notify);
                appointment.CreatedAt = now.AddDays(-3);
                db.Appointments.Add(appointment);
            }

            await db.SaveChangesAsync();
        }

        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jobs/send-reminders");
        request.Headers.Add("X-Job-Secret", BooklyApiFactory.JobSecret);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reminder = Assert.Single(_factory.Emails.SentTo("giulia.reminder@example.test"));
        Assert.StartsWith("Promemoria", reminder.Subject, StringComparison.Ordinal);
        Assert.Contains("Vedi l'attività", reminder.TextBody, StringComparison.Ordinal);
        Assert.Contains($"/b/{shop.Tenant.Slug}", reminder.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("disdici online", reminder.TextBody, StringComparison.Ordinal);
        Assert.Empty(_factory.Emails.SentTo("paolo.reminder@example.test"));
    }

    [Fact]
    public async Task Retention_anonymises_address_book_customers_without_recent_appointments()
    {
        var shop = await ArrangeShopAsync();
        var created = new DateTimeOffset(2030, 1, 10, 9, 0, 0, TimeSpan.Zero);
        Guid oldId, recentId, newId;
        await using (var db = database.CreateDbContext())
        {
            var old = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Vecchio", "Cliente", "333 111 2222", "old@example.test", created);
            var recent = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Cliente", "Recente", "333 111 3333", createdAt: created);
            var fresh = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Nuovo", "Arrivato", "333 111 4444", createdAt: new DateTimeOffset(2032, 12, 1, 0, 0, 0, TimeSpan.Zero));
            db.Appointments.Add(TestData.NewBusinessAppointment(shop.Tenant.Id, shop.A.Id, shop.Service, old.Id, new DateTimeOffset(2030, 6, 1, 9, 0, 0, TimeSpan.Zero)));
            db.Appointments.Add(TestData.NewBusinessAppointment(shop.Tenant.Id, shop.A.Id, shop.Service, recent.Id, new DateTimeOffset(2032, 6, 1, 9, 0, 0, TimeSpan.Zero)));
            await db.SaveChangesAsync();
            (oldId, recentId, newId) = (old.Id, recent.Id, fresh.Id);
        }

        // Cutoff: 24 months before 1 January 2033.
        _factory.Clock.SetUtcNow(new DateTimeOffset(2033, 1, 1, 6, 0, 0, TimeSpan.Zero));
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jobs/apply-retention");
        request.Headers.Add("X-Job-Secret", BooklyApiFactory.JobSecret);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await using var check = database.CreateDbContext();
        var entries = await check.TenantCustomers.IgnoreQueryFilters()
            .Where(c => c.Id == oldId || c.Id == recentId || c.Id == newId)
            .ToDictionaryAsync(c => c.Id);
        Assert.Equal("Cliente anonimo", $"{entries[oldId].FirstName} {entries[oldId].LastName}");
        Assert.Null(entries[oldId].Phone);
        Assert.Null(entries[oldId].Email);
        Assert.NotNull(entries[oldId].AnonymizedAt);
        Assert.Null(entries[recentId].AnonymizedAt);
        Assert.Null(entries[newId].AnonymizedAt);
    }

    [Fact]
    public async Task The_database_requires_exactly_one_customer()
    {
        var shop = await ArrangeShopAsync();
        await using var db = database.CreateDbContext();
        var orphan = TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, shop.Customer.Id, TenAm.AddHours(2));
        orphan.CustomerId = null;
        db.Appointments.Add(orphan);

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Contains("CK_Appointments_OneCustomer", error.InnerException?.Message, StringComparison.Ordinal);
    }

    public void Dispose() => _factory.Dispose();
}
