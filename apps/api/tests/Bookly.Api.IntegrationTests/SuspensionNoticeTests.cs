using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>
/// DEC-039: suspending a tenant can also cancel its future appointments; customers and owners are
/// emailed in the background, idempotently, with retries and a daily limit.
/// </summary>
[Collection(DatabaseCollection.Name)]
public sealed class SuspensionNoticeTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    private sealed record Shop(Tenant Tenant, StaffMember Staff, Service Service, AppUser Owner);

    /// <summary>
    /// Each test runs on its own far-future day: the daily limit counts per day, and every test
    /// sends all of its notices before it ends, so nothing is left due for the others.
    /// </summary>
    private static DateTimeOffset StartClock(BooklyApiFactory factory, int year)
    {
        var now = new DateTimeOffset(year, 6, 10, 8, 0, 0, TimeSpan.Zero);
        factory.Clock.SetUtcNow(now);
        return now;
    }

    private async Task<Shop> ArrangeShopAsync(BooklyApiFactory factory)
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == tenant.Id).ExecuteUpdateAsync(t => t
            .SetProperty(x => x.Name, "Sfumo Barber")
            .SetProperty(x => x.Phone, "059 123456"));
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Luca");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio");
        var owner = await TestUsers.CreateAsync(factory, memberships: (tenant.Id, TenantRole.Owner));
        return new Shop(tenant, staff, service, owner);
    }

    private async Task<Guid> BookAccountAsync(Shop shop, AppUser customer, DateTimeOffset start, AppointmentStatus status = AppointmentStatus.Confirmed)
    {
        await using var db = database.CreateDbContext();
        var appointment = TestData.NewAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, customer.Id, start, status);
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return appointment.Id;
    }

    private async Task<Guid> BookAddressBookAsync(Shop shop, TenantCustomer customer, DateTimeOffset start, bool notify = true)
    {
        await using var db = database.CreateDbContext();
        var appointment = TestData.NewBusinessAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, customer.Id, start, notify);
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return appointment.Id;
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static Task<HttpResponseMessage> SuspendAsync(ApiSession admin, Guid tenantId, bool cancel = true) =>
        admin.SendAsync(HttpMethod.Put, $"/api/platform/tenants/{tenantId}/status", new { status = "Suspended", cancelFutureAppointments = cancel });

    private static async Task<JsonElement> RunJobAsync(BooklyApiFactory factory)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jobs/send-suspension-notices");
        request.Headers.Add("X-Job-Secret", BooklyApiFactory.JobSecret);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    private static async Task<JsonElement> NoticesOfAsync(ApiSession admin, Guid tenantId)
    {
        var tenants = await admin.Client.GetFromJsonAsync<JsonElement>("/api/platform/tenants");
        return tenants.EnumerateArray().Single(t => t.GetProperty("id").GetGuid() == tenantId).GetProperty("suspensionNotices");
    }

    private static async Task<ApiSession> SuperAdminAsync(BooklyApiFactory factory) =>
        await TestUsers.LoginAsync(factory, await TestUsers.CreateAsync(factory, superAdmin: true));

    private static EmailMessage SingleEmailTo(BooklyApiFactory factory, string email) => Assert.Single(factory.Emails.SentTo(email));

    [Fact]
    public async Task The_dialog_gets_only_the_number_of_future_confirmed_appointments()
    {
        var now = StartClock(_factory, 2041);
        var shop = await ArrangeShopAsync(_factory);
        await using var db = database.CreateDbContext();
        var customer = await TestData.AddCustomerAsync(db);
        await BookAccountAsync(shop, customer, now.AddDays(1));
        await BookAccountAsync(shop, customer, now.AddDays(2));
        await BookAccountAsync(shop, customer, now.AddDays(-1)); // past
        await BookAccountAsync(shop, customer, now.AddDays(3), AppointmentStatus.CancelledByCustomer);
        using var admin = await SuperAdminAsync(_factory);
        using var ownerSession = await TestUsers.LoginAsync(_factory, shop.Owner);

        var count = await admin.Client.GetFromJsonAsync<JsonElement>($"/api/platform/tenants/{shop.Tenant.Id}/future-appointments");
        using var forbidden = await ownerSession.Client.GetAsync($"/api/platform/tenants/{shop.Tenant.Id}/future-appointments");
        using var missing = await admin.Client.GetAsync($"/api/platform/tenants/{Guid.NewGuid()}/future-appointments");

        Assert.Equal(2, count.GetProperty("count").GetInt32());
        Assert.Single(count.EnumerateObject()); // who and when stay with the business
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Suspending_with_cancellation_cancels_the_future_and_emails_customers_once_and_owners_a_summary()
    {
        var now = StartClock(_factory, 2042);
        var shop = await ArrangeShopAsync(_factory);
        await using var db = database.CreateDbContext();
        var account = await TestData.AddCustomerAsync(db);
        var pastCustomer = await TestData.AddCustomerAsync(db);
        var withEmail = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Giulia", "Rossetti", "347 222 3344", $"{Guid.NewGuid():N}@example.test");
        var noEmail = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Luca", "Ferri", "340 555 6677");
        var noNotify = await TestData.AddTenantCustomerAsync(db, shop.Tenant.Id, "Anna", "Neri", "333 000 4444", $"{Guid.NewGuid():N}@example.test");

        var first = await BookAccountAsync(shop, account, now.AddDays(1).AddHours(1));
        await BookAccountAsync(shop, account, now.AddDays(3));
        await BookAddressBookAsync(shop, withEmail, now.AddDays(2));
        await BookAddressBookAsync(shop, noEmail, now.AddDays(4));
        await BookAddressBookAsync(shop, noNotify, now.AddDays(5), notify: false);
        var past = await BookAccountAsync(shop, pastCustomer, now.AddDays(-2));
        using var admin = await SuperAdminAsync(_factory);

        using var suspended = await SuspendAsync(admin, shop.Tenant.Id);

        Assert.Equal(HttpStatusCode.OK, suspended.StatusCode);
        var body = await JsonAsync(suspended);
        Assert.Equal("Suspended", body.GetProperty("status").GetString());
        var notices = body.GetProperty("suspensionNotices");
        Assert.Equal(5, notices.GetProperty("cancelledAppointments").GetInt32());
        Assert.Equal(2, notices.GetProperty("customers").GetInt32()); // one email per customer who can be emailed
        Assert.Equal(0, notices.GetProperty("sent").GetInt32());
        Assert.Equal(1, notices.GetProperty("ownerSummaries").GetInt32());
        Assert.Equal("Sending", notices.GetProperty("state").GetString());

        await using var check = database.CreateDbContext();
        var statuses = await check.Appointments.IgnoreQueryFilters()
            .Where(a => a.TenantId == shop.Tenant.Id)
            .ToDictionaryAsync(a => a.Id, a => a.Status);
        Assert.Equal(5, statuses.Values.Count(s => s == AppointmentStatus.CancelledByBusiness));
        Assert.Equal(AppointmentStatus.Confirmed, statuses[past]); // the past is untouched
        Assert.Empty(_factory.Emails.SentTo(account.Email!)); // nothing in the request: the emails go out in the background

        var run = await RunJobAsync(_factory);
        Assert.Equal(3, run.GetProperty("sent").GetInt32());

        // The account customer gets one email listing both appointments: neutral, no link, the phone.
        var customerEmail = SingleEmailTo(_factory, account.Email!);
        Assert.Equal("Appuntamenti annullati: Sfumo Barber", customerEmail.Subject);
        Assert.Equal(2, customerEmail.TextBody.Split("Taglio con Luca, ").Length - 1);
        Assert.Contains("11 giugno 2042, 11:00", customerEmail.TextBody); // tenant time zone (Rome, summer time)
        Assert.Contains("Chiama 059 123456: tel:059123456", customerEmail.TextBody);
        Assert.DoesNotContain("sospes", customerEmail.HtmlBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("/b/", customerEmail.HtmlBody, StringComparison.Ordinal);

        var single = SingleEmailTo(_factory, withEmail.Email!);
        Assert.Equal("Appuntamento annullato: Sfumo Barber", single.Subject);
        Assert.Contains("Il tuo appuntamento da Sfumo Barber è stato annullato:", single.TextBody);

        Assert.Empty(_factory.Emails.SentTo(noNotify.Email!)); // the business chose no emails for that appointment
        Assert.Empty(_factory.Emails.SentTo(pastCustomer.Email!)); // only past appointments

        // The owner learns what happened and whom to call.
        var summary = SingleEmailTo(_factory, shop.Owner.Email!);
        Assert.Equal("Attività sospesa: Sfumo Barber, 5 appuntamenti annullati", summary.Subject);
        Assert.Contains("Abbiamo annullato 5 appuntamenti futuri e stiamo avvisando via email 2 clienti", summary.TextBody);
        Assert.Contains("2 clienti non possono essere avvisati via email", summary.TextBody);
        Assert.Contains("- Luca Ferri, 340 555 6677, ", summary.TextBody);
        Assert.Contains("- Anna Neri, 333 000 4444, ", summary.TextBody);
        Assert.DoesNotContain("Rossetti", summary.TextBody);

        // Idempotent: a second run sends nothing more.
        var again = await RunJobAsync(_factory);
        Assert.Equal(0, again.GetProperty("sent").GetInt32());
        Assert.Single(_factory.Emails.SentTo(account.Email!));

        var done = await NoticesOfAsync(admin, shop.Tenant.Id);
        Assert.Equal("Done", done.GetProperty("state").GetString());
        Assert.Equal(2, done.GetProperty("sent").GetInt32());
        Assert.Equal(1, done.GetProperty("ownerSummariesSent").GetInt32());

        // Reactivating does not bring the appointments back; the progress is no longer shown.
        using var reactivated = await admin.SendAsync(HttpMethod.Put, $"/api/platform/tenants/{shop.Tenant.Id}/status", new { status = "Active" });
        Assert.Equal(JsonValueKind.Null, (await JsonAsync(reactivated)).GetProperty("suspensionNotices").ValueKind);
        var afterReactivation = await check.Appointments.IgnoreQueryFilters().AsNoTracking().SingleAsync(a => a.Id == first);
        Assert.Equal(AppointmentStatus.CancelledByBusiness, afterReactivation.Status);
    }

    [Fact]
    public async Task Suspending_only_keeps_the_appointments_and_emails_nobody()
    {
        var now = StartClock(_factory, 2043);
        var shop = await ArrangeShopAsync(_factory);
        await using var db = database.CreateDbContext();
        var customer = await TestData.AddCustomerAsync(db);
        var appointment = await BookAccountAsync(shop, customer, now.AddDays(1));
        using var admin = await SuperAdminAsync(_factory);

        using var suspended = await SuspendAsync(admin, shop.Tenant.Id, cancel: false);
        await RunJobAsync(_factory);

        Assert.Equal(JsonValueKind.Null, (await JsonAsync(suspended)).GetProperty("suspensionNotices").ValueKind);
        var stored = await db.Appointments.IgnoreQueryFilters().AsNoTracking().SingleAsync(a => a.Id == appointment);
        Assert.Equal(AppointmentStatus.Confirmed, stored.Status);
        Assert.Empty(_factory.Emails.SentTo(customer.Email!));
        Assert.Empty(_factory.Emails.SentTo(shop.Owner.Email!));
    }

    [Fact]
    public async Task Cancelling_appointments_requires_a_suspension_of_an_existing_tenant()
    {
        StartClock(_factory, 2044);
        var shop = await ArrangeShopAsync(_factory);
        using var admin = await SuperAdminAsync(_factory);

        using var active = await admin.SendAsync(
            HttpMethod.Put, $"/api/platform/tenants/{shop.Tenant.Id}/status", new { status = "Active", cancelFutureAppointments = true });
        using var missing = await SuspendAsync(admin, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.BadRequest, active.StatusCode);
        Assert.Equal("platform.cancel_requires_suspension", (await JsonAsync(active)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task A_failed_email_is_retried_later_and_the_others_are_not_sent_twice()
    {
        var now = StartClock(_factory, 2045);
        var shop = await ArrangeShopAsync(_factory);
        await using var db = database.CreateDbContext();
        var soon = await TestData.AddCustomerAsync(db);
        var later = await TestData.AddCustomerAsync(db);
        await BookAccountAsync(shop, soon, now.AddDays(1));
        await BookAccountAsync(shop, later, now.AddDays(2));
        using var admin = await SuperAdminAsync(_factory);
        using var suspended = await SuspendAsync(admin, shop.Tenant.Id);
        _factory.Emails.FailWhen = m => m.To == later.Email;

        // Owner summary first, then customers by their earliest appointment; the run stops at the failure.
        var failing = await RunJobAsync(_factory);
        Assert.Equal(2, failing.GetProperty("sent").GetInt32());
        Assert.Equal(1, failing.GetProperty("failed").GetInt32());
        Assert.Equal("Retrying", (await NoticesOfAsync(admin, shop.Tenant.Id)).GetProperty("state").GetString());

        var tooSoon = await RunJobAsync(_factory);
        Assert.Equal(0, tooSoon.GetProperty("sent").GetInt32()); // waits before retrying

        _factory.Emails.FailWhen = null;
        _factory.Clock.Advance(TimeSpan.FromMinutes(6));
        var retried = await RunJobAsync(_factory);

        Assert.Equal(1, retried.GetProperty("sent").GetInt32());
        Assert.Single(_factory.Emails.SentTo(later.Email!));
        Assert.Single(_factory.Emails.SentTo(soon.Email!));
        Assert.Single(_factory.Emails.SentTo(shop.Owner.Email!));
        Assert.Equal("Done", (await NoticesOfAsync(admin, shop.Tenant.Id)).GetProperty("state").GetString());
    }

    [Fact]
    public async Task The_daily_limit_pauses_the_emails_until_the_next_day()
    {
        using var limited = new BooklyApiFactory(database, settings: new Dictionary<string, string> { ["SuspensionNotices:DailyLimit"] = "2" });
        var now = StartClock(limited, 2046);
        var shop = await ArrangeShopAsync(limited);
        await using var db = database.CreateDbContext();
        List<AppUser> customers = [await TestData.AddCustomerAsync(db), await TestData.AddCustomerAsync(db), await TestData.AddCustomerAsync(db)];
        for (var i = 0; i < customers.Count; i++)
        {
            await BookAccountAsync(shop, customers[i], now.AddDays(i + 1));
        }

        using var admin = await SuperAdminAsync(limited);
        using var suspended = await SuspendAsync(admin, shop.Tenant.Id);

        var paused = await RunJobAsync(limited);
        Assert.Equal(2, paused.GetProperty("sent").GetInt32());
        Assert.True(paused.GetProperty("dailyLimitReached").GetBoolean());
        var progress = await NoticesOfAsync(admin, shop.Tenant.Id);
        Assert.Equal("PausedDailyLimit", progress.GetProperty("state").GetString());
        Assert.Equal(1, progress.GetProperty("sent").GetInt32()); // the owner summary and the soonest customer
        Assert.Single(limited.Emails.SentTo(customers[0].Email!));
        Assert.Empty(limited.Emails.SentTo(customers[2].Email!));

        limited.Clock.SetUtcNow(new DateTimeOffset(now.UtcDateTime.Date.AddDays(1).AddMinutes(5), TimeSpan.Zero));
        var resumed = await RunJobAsync(limited);

        Assert.Equal(2, resumed.GetProperty("sent").GetInt32());
        Assert.False(resumed.GetProperty("dailyLimitReached").GetBoolean());
        Assert.All(customers, c => Assert.Single(limited.Emails.SentTo(c.Email!)));
    }

    [Fact]
    public async Task The_in_app_worker_sends_right_after_the_suspension()
    {
        using var background = new BooklyApiFactory(database, settings: new Dictionary<string, string>
        {
            ["SuspensionNotices:RunInBackground"] = "true",
        });
        var now = StartClock(background, 2047);
        var shop = await ArrangeShopAsync(background);
        await using var db = database.CreateDbContext();
        var customer = await TestData.AddCustomerAsync(db);
        await BookAccountAsync(shop, customer, now.AddDays(1));
        using var admin = await SuperAdminAsync(background);

        using var suspended = await SuspendAsync(admin, shop.Tenant.Id);

        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (background.Emails.SentTo(customer.Email!).Count == 0 && DateTime.UtcNow < deadline)
        {
            await Task.Delay(100);
        }

        Assert.Single(background.Emails.SentTo(customer.Email!));
        Assert.Single(background.Emails.SentTo(shop.Owner.Email!));
    }

    public void Dispose() => _factory.Dispose();
}
