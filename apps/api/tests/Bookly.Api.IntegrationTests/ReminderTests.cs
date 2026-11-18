using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 11: the reminder job (~24 h before), idempotent and safe to run concurrently.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class ReminderTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    private sealed record Shop(Tenant Tenant, StaffMember Staff, Service Service);

    /// <summary>Each test runs at its own far-future time, so leftovers of other tests are never due.</summary>
    private DateTimeOffset StartClock(int month)
    {
        var now = new DateTimeOffset(2031, month, 10, 8, 0, 0, TimeSpan.Zero);
        _factory.Clock.SetUtcNow(now);
        return now;
    }

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == tenant.Id).ExecuteUpdateAsync(t => t
            .SetProperty(x => x.Name, "Sfumo Barber")
            .SetProperty(x => x.Address, "Via Emilia 1, Modena")
            .SetProperty(x => x.Phone, "059 123456"));
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Luca");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio");
        return new Shop(tenant, staff, service);
    }

    private async Task<(AppUser Customer, Guid AppointmentId)> BookAsync(
        Shop shop, DateTimeOffset start, DateTimeOffset createdAt, AppointmentStatus status = AppointmentStatus.Confirmed)
    {
        await using var db = database.CreateDbContext();
        var customer = await TestData.AddCustomerAsync(db);
        var appointment = TestData.NewAppointment(shop.Tenant.Id, shop.Staff.Id, shop.Service, customer.Id, start, status);
        appointment.CreatedAt = createdAt;
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
        return (customer, appointment.Id);
    }

    private static async Task<HttpResponseMessage> RunAsync(HttpClient client, string? secret = BooklyApiFactory.JobSecret)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jobs/send-reminders");
        if (secret is not null)
        {
            request.Headers.Add("X-Job-Secret", secret);
        }

        return await client.SendAsync(request);
    }

    private int RemindersTo(AppUser customer) =>
        _factory.Emails.SentTo(customer.Email!).Count(m => m.Subject.StartsWith("Promemoria", StringComparison.Ordinal));

    [Fact]
    public async Task The_job_requires_the_secret_and_no_session()
    {
        using var client = _factory.CreateClient();

        using var missing = await RunAsync(client, secret: null);
        using var wrong = await RunAsync(client, secret: "not-the-secret");
        using var ok = await RunAsync(client);

        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode); // no antiforgery token needed
    }

    [Fact]
    public async Task The_job_is_disabled_without_a_configured_secret()
    {
        using var disabled = _factory.WithWebHostBuilder(b => b.UseSetting("Jobs:Secret", string.Empty));
        using var client = disabled.CreateClient();

        using var response = await RunAsync(client);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Reminds_once_appointments_in_the_next_24_hours()
    {
        var now = StartClock(1);
        var shop = await ArrangeShopAsync();
        var (due, _) = await BookAsync(shop, now.AddHours(23), createdAt: now.AddDays(-3));
        var (later, _) = await BookAsync(shop, now.AddHours(25), createdAt: now.AddDays(-3));
        var (cancelled, _) = await BookAsync(shop, now.AddHours(20), createdAt: now.AddDays(-3), AppointmentStatus.CancelledByCustomer);
        var (lastMinute, _) = await BookAsync(shop, now.AddHours(10), createdAt: now.AddHours(-1));
        var (past, _) = await BookAsync(shop, now.AddHours(-1), createdAt: now.AddDays(-3));
        using var client = _factory.CreateClient();

        using var first = await RunAsync(client);
        using var second = await RunAsync(client);

        Assert.Equal(1, RemindersTo(due));
        Assert.All([later, cancelled, lastMinute, past], c => Assert.Equal(0, RemindersTo(c)));
        Assert.Equal(0, (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("sent").GetInt32());

        var email = _factory.Emails.SentTo(due.Email!).Single();
        Assert.Contains("Sfumo Barber: Taglio con Luca", email.TextBody, StringComparison.Ordinal);
        Assert.Contains("Via Emilia 1, Modena", email.TextBody, StringComparison.Ordinal);
        Assert.Contains("disdici online entro", email.TextBody, StringComparison.Ordinal);
        Assert.Contains("https://app.bookly.test/account/appuntamenti", email.TextBody, StringComparison.Ordinal);

        // Later runs pick up appointments as they enter the 24-hour window.
        _factory.Clock.Advance(TimeSpan.FromHours(10));
        var (soon, _) = await BookAsync(shop, now.AddHours(30), createdAt: now.AddDays(-3));
        using var third = await RunAsync(client);
        Assert.Equal(1, RemindersTo(soon));
        Assert.Equal(1, RemindersTo(later));
    }

    [Fact]
    public async Task Late_cancellation_window_points_to_the_phone()
    {
        var now = StartClock(2);
        var shop = await ArrangeShopAsync();
        var (customer, _) = await BookAsync(shop, now.AddHours(6), createdAt: now.AddDays(-2));
        using var client = _factory.CreateClient();

        using var response = await RunAsync(client);

        var email = _factory.Emails.SentTo(customer.Email!).Single();
        Assert.Contains("avvisa l'attività al numero 059 123456", email.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Suspended_tenants_send_no_reminders()
    {
        var now = StartClock(3);
        var shop = await ArrangeShopAsync();
        var (customer, _) = await BookAsync(shop, now.AddHours(20), createdAt: now.AddDays(-2));
        await using (var db = database.CreateDbContext())
        {
            await db.Tenants.Where(t => t.Id == shop.Tenant.Id).ExecuteUpdateAsync(t => t.SetProperty(x => x.Status, TenantStatus.Suspended));
        }

        using var client = _factory.CreateClient();
        using var response = await RunAsync(client);

        Assert.Equal(0, RemindersTo(customer));
    }

    [Fact]
    public async Task A_failed_email_is_retried_on_the_next_run()
    {
        var now = StartClock(4);
        var shop = await ArrangeShopAsync();
        var (customer, id) = await BookAsync(shop, now.AddHours(20), createdAt: now.AddDays(-2));
        _factory.Emails.FailWhen = m => m.To == customer.Email;
        using var client = _factory.CreateClient();

        using var failing = await RunAsync(client);
        Assert.Equal(1, (await failing.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("failed").GetInt32());
        await using (var db = database.CreateDbContext())
        {
            Assert.Null(await db.Appointments.IgnoreQueryFilters().Where(a => a.Id == id).Select(a => a.ReminderSentAt).SingleAsync());
        }

        _factory.Emails.FailWhen = null;
        using var retry = await RunAsync(client);
        Assert.Equal(1, RemindersTo(customer));
    }

    [Fact]
    public async Task Concurrent_runs_send_a_single_email()
    {
        var now = StartClock(5);
        var shop = await ArrangeShopAsync();
        var customers = new List<AppUser>();
        for (var i = 0; i < 5; i++)
        {
            customers.Add((await BookAsync(shop, now.AddHours(10 + i), createdAt: now.AddDays(-2))).Customer);
        }

        var clients = Enumerable.Range(0, 4).Select(_ => _factory.CreateClient()).ToList();
        var responses = await Task.WhenAll(clients.Select(c => RunAsync(c)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.All(customers, c => Assert.Equal(1, RemindersTo(c)));
        foreach (var response in responses)
        {
            response.Dispose();
        }

        clients.ForEach(c => c.Dispose());
    }

    public void Dispose() => _factory.Dispose();
}
