using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 12: access/portability, rectification, erasure with anonymisation, retention.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class GdprTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027, 08:00 in Rome.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset Past = new(2027, 2, 15, 9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Future = new(2027, 3, 5, 9, 0, 0, TimeSpan.Zero);

    private sealed record Booked(Tenant Tenant, StaffMember Staff, Guid PastId, Guid FutureId);

    private async Task<Booked> BookAsync(AppUser customer, string tenantName = "Sfumo Barber")
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == tenant.Id).ExecuteUpdateAsync(t => t.SetProperty(x => x.Name, tenantName));
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Luca");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio");
        var past = TestData.NewAppointment(tenant.Id, staff.Id, service, customer.Id, Past, AppointmentStatus.Completed);
        past.CustomerNote = "Sfumatura bassa";
        var future = TestData.NewAppointment(tenant.Id, staff.Id, service, customer.Id, Future);
        future.CustomerNote = "Arrivo in bici";
        db.Appointments.AddRange(past, future);
        await db.SaveChangesAsync();
        return new Booked(tenant, staff, past.Id, future.Id);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    [Fact]
    public async Task Users_read_and_correct_their_profile()
    {
        var user = await TestUsers.CreateAsync(_factory);
        using var session = await TestUsers.LoginAsync(_factory, user);

        using var updated = await session.SendAsync(HttpMethod.Put, "/api/me/profile", new { firstName = " Maria ", lastName = "Bianchi", phoneNumber = "333 1234567" });
        using var invalid = await session.SendAsync(HttpMethod.Put, "/api/me/profile", new { firstName = "", lastName = "Bianchi", phoneNumber = "abc" });
        var profile = await session.Client.GetFromJsonAsync<JsonElement>("/api/me/profile");

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("Maria", profile.GetProperty("firstName").GetString());
        Assert.Equal("333 1234567", profile.GetProperty("phoneNumber").GetString());
    }

    [Fact]
    public async Task Export_contains_every_appointment_across_businesses_and_nobody_elses()
    {
        var user = await TestUsers.CreateAsync(_factory);
        var other = await TestUsers.CreateAsync(_factory);
        await BookAsync(user, "Sfumo Barber");
        await BookAsync(user, "Estetica Luna");
        await BookAsync(other, "Altro negozio");
        using var session = await TestUsers.LoginAsync(_factory, user);

        using var response = await session.Client.GetAsync("/api/me/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.StartsWith("bookly-dati-", response.Content.Headers.ContentDisposition?.FileName, StringComparison.Ordinal);
        var export = await JsonAsync(response);
        Assert.Equal(user.Email, export.GetProperty("account").GetProperty("email").GetString());
        var tenants = export.GetProperty("appointments").EnumerateArray().Select(a => a.GetProperty("tenant").GetString()).ToList();
        Assert.Equal(4, tenants.Count);
        Assert.DoesNotContain("Altro negozio", tenants);
        Assert.Contains(export.GetProperty("appointments").EnumerateArray(), a => a.GetProperty("note").GetString() == "Sfumatura bassa");
    }

    [Fact]
    public async Task Deleting_the_account_anonymises_history_and_cancels_future_appointments()
    {
        var user = await TestUsers.CreateAsync(_factory);
        var booked = await BookAsync(user);
        await using (var db = database.CreateDbContext())
        {
            db.TenantMemberships.Add(new TenantMembership { TenantId = booked.Tenant.Id, UserId = user.Id, Role = TenantRole.Staff, CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
            await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == booked.Staff.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, user.Id));
        }

        using var session = await TestUsers.LoginAsync(_factory, user);
        using var wrong = await session.PostAsync("/api/me/delete", new { password = TestUsers.Password + "-errata" });
        Assert.Equal("account.invalid_password", (await JsonAsync(wrong)).GetProperty("code").GetString());

        using var deleted = await session.PostAsync("/api/me/delete", new { password = TestUsers.Password });
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        // Session ended, old credentials no longer work.
        using var me = await session.MeAsync();
        Assert.Equal(HttpStatusCode.NoContent, me.StatusCode);
        using var login = await _factory.CreateSession().PostAsync("/api/auth/login", new { email = user.Email, password = TestUsers.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        await using (var db = database.CreateDbContext())
        {
            var row = await db.Users.SingleAsync(u => u.Id == user.Id);
            Assert.Equal(("Cliente", "eliminato"), (row.FirstName, row.LastName));
            Assert.EndsWith("@deleted.invalid", row.Email, StringComparison.Ordinal);
            Assert.Null(row.PhoneNumber);
            Assert.Null(row.PasswordHash);
            Assert.NotNull(row.DeletedAt);

            var appointments = await db.Appointments.IgnoreQueryFilters().Where(a => a.CustomerId == user.Id).ToListAsync();
            Assert.Equal(AppointmentStatus.Completed, appointments.Single(a => a.Id == booked.PastId).Status);
            Assert.Equal(AppointmentStatus.CancelledByCustomer, appointments.Single(a => a.Id == booked.FutureId).Status);
            Assert.All(appointments, a => Assert.Null(a.CustomerNote));
            Assert.False(await db.TenantMemberships.IgnoreQueryFilters().AnyAsync(m => m.UserId == user.Id));
            Assert.Null(await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == booked.Staff.Id).Select(s => s.UserId).SingleAsync());
        }

        Assert.Contains(_factory.Emails.SentTo(user.Email!), m => m.Subject.Contains("eliminato", StringComparison.Ordinal));

        // The business still sees the past appointment, without contact details.
        var owner = await TestUsers.CreateAsync(_factory, memberships: (booked.Tenant.Id, TenantRole.Owner));
        using var ownerSession = await TestUsers.LoginAsync(_factory, owner);
        var calendar = await ownerSession.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-02-15&to=2027-02-15");
        var customer = calendar.GetProperty("appointments")[0].GetProperty("customer");
        Assert.Equal("Cliente", customer.GetProperty("firstName").GetString());
        Assert.Equal(JsonValueKind.Null, customer.GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task Owners_must_hand_over_their_business_first()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        using var session = await TestUsers.LoginAsync(_factory, owner);

        using var response = await session.PostAsync("/api/me/delete", new { password = TestUsers.Password });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("account.owner_of_tenant", (await JsonAsync(response)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Retention_clears_old_notes_and_deletes_stale_unconfirmed_accounts()
    {
        var customer = await TestUsers.CreateAsync(_factory);
        var booked = await BookAsync(customer);
        var stale = await TestUsers.CreateAsync(_factory, emailConfirmed: false);
        var fresh = await TestUsers.CreateAsync(_factory, emailConfirmed: false);
        await using (var db = database.CreateDbContext())
        {
            await db.Users.Where(u => u.Id == stale.Id).ExecuteUpdateAsync(u => u.SetProperty(x => x.CreatedAt, new DateTimeOffset(2029, 1, 1, 0, 0, 0, TimeSpan.Zero)));
            await db.Users.Where(u => u.Id == fresh.Id).ExecuteUpdateAsync(u => u.SetProperty(x => x.CreatedAt, new DateTimeOffset(2029, 2, 20, 0, 0, 0, TimeSpan.Zero)));
        }

        // Over 24 months after the past appointment (not yet for the later one);
        // 59 days after "stale" was created, 9 days after "fresh".
        _factory.Clock.SetUtcNow(new DateTimeOffset(2029, 3, 1, 0, 0, 0, TimeSpan.Zero));
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/jobs/apply-retention");
        request.Headers.Add("X-Job-Secret", BooklyApiFactory.JobSecret);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await using var check = database.CreateDbContext();
        var notes = await check.Appointments.IgnoreQueryFilters()
            .Where(a => a.Id == booked.PastId || a.Id == booked.FutureId)
            .ToDictionaryAsync(a => a.Id, a => a.CustomerNote);
        Assert.Null(notes[booked.PastId]);
        Assert.Equal("Arrivo in bici", notes[booked.FutureId]);
        Assert.False(await check.Users.AnyAsync(u => u.Id == stale.Id));
        Assert.True(await check.Users.AnyAsync(u => u.Id == fresh.Id));
        Assert.True(await check.Users.AnyAsync(u => u.Id == customer.Id));
    }

    public void Dispose() => _factory.Dispose();
}
