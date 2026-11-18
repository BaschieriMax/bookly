using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 9: the admin calendar and the business side of the appointment lifecycle.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class CalendarTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027 08:00 Rome. Both staff work Tuesday 2 March 09:00–13:00.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset TenAm = new(2027, 3, 2, 9, 0, 0, TimeSpan.Zero); // 10:00 in Rome

    private sealed record Shop(Tenant Tenant, StaffMember A, StaffMember B, Service Service, AppUser Owner, AppUser StaffUserB, AppUser Customer, Appointment Booked);

    private async Task<Shop> ArrangeShopAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var a = await TestData.AddStaffAsync(db, tenant.Id, "Anna");
        var b = await TestData.AddStaffAsync(db, tenant.Id, "Bruno");
        var service = await TestData.AddServiceAsync(db, tenant.Id, "Taglio", duration: 30, buffer: 10);
        foreach (var staff in new[] { a, b })
        {
            await TestData.EnableServiceAsync(db, tenant.Id, staff.Id, service.Id);
            await TestData.AddWorkingHoursAsync(db, tenant.Id, staff.Id, DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(13, 0));
        }

        var customer = await TestData.AddCustomerAsync(db);
        var booked = TestData.NewAppointment(tenant.Id, a.Id, service, customer.Id, TenAm);
        booked.ReminderSentAt = TenAm.AddDays(-1);
        db.Appointments.Add(booked);
        await db.SaveChangesAsync();

        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        var staffUser = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Staff));
        await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == b.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, staffUser.Id).SetProperty(x => x.SortOrder, 1));

        return new Shop(tenant, a, b, service, owner, staffUser, customer, booked);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    private static Task<HttpResponseMessage> MoveAsync(ApiSession session, Guid id, string date, string time, Guid? staffId = null) =>
        session.PostAsync($"/api/admin/appointments/{id}/move", new { date, time, staffId });

    private async Task<AppointmentStatus> StatusAsync(Guid id)
    {
        await using var db = database.CreateDbContext();
        return await db.Appointments.IgnoreQueryFilters().Where(a => a.Id == id).Select(a => a.Status).SingleAsync();
    }

    [Fact]
    public async Task Owner_gets_staff_hours_and_appointments_of_a_week()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            db.Appointments.Add(TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, shop.Customer.Id, TenAm, AppointmentStatus.CancelledByCustomer));
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        var week = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-03-01&to=2027-03-07");

        Assert.Equal("Europe/Rome", week.GetProperty("timeZone").GetString());
        Assert.Equal(["Anna", "Bruno"], week.GetProperty("staff").EnumerateArray().Select(s => s.GetProperty("displayName").GetString()));
        Assert.Equal(2, week.GetProperty("workingHours").GetArrayLength());
        var appointment = Assert.Single(week.GetProperty("appointments").EnumerateArray());
        Assert.Equal("2027-03-02T10:00:00+01:00", appointment.GetProperty("start").GetString());
        Assert.Equal("2027-03-02T10:40:00+01:00", appointment.GetProperty("blockedUntil").GetString());
        Assert.Equal(shop.Customer.Email, appointment.GetProperty("customer").GetProperty("email").GetString());
        Assert.True(appointment.GetProperty("canMove").GetBoolean());
        Assert.False(appointment.GetProperty("canMark").GetBoolean());

        var withCancelled = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-03-02&to=2027-03-02&includeCancelled=true");
        Assert.Equal(2, withCancelled.GetProperty("appointments").GetArrayLength());

        using var tooLong = await session.Client.GetAsync("/api/admin/calendar?from=2027-03-01&to=2027-05-01");
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }

    [Fact]
    public async Task Owner_moves_an_appointment_and_the_customer_is_notified()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var moved = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "11:30", shop.B.Id);

        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        var body = await JsonAsync(moved);
        Assert.Equal("2027-03-02T11:30:00+01:00", body.GetProperty("start").GetString());
        Assert.Equal("2027-03-02T12:00:00+01:00", body.GetProperty("end").GetString());
        Assert.Equal(shop.B.Id, body.GetProperty("staffId").GetGuid());
        Assert.Equal(shop.Booked.Id, body.GetProperty("id").GetGuid());

        await using var db = database.CreateDbContext();
        var stored = await db.Appointments.IgnoreQueryFilters().SingleAsync(a => a.Id == shop.Booked.Id);
        Assert.Null(stored.ReminderSentAt);
        var email = Assert.Single(_factory.Emails.SentTo(shop.Customer.Email!));
        Assert.StartsWith("Appuntamento spostato", email.Subject, StringComparison.Ordinal);
        Assert.Contains("martedì 2 marzo 2027, 11:30", email.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Moves_are_validated_against_hours_time_off_other_appointments_and_the_clock()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext())
        {
            db.Appointments.Add(TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, shop.Customer.Id, TenAm.AddHours(1)));
            db.TimeOffs.Add(new TimeOff { Id = Guid.NewGuid(), TenantId = shop.Tenant.Id, StaffMemberId = shop.A.Id, StartUtc = TenAm.AddHours(2), EndUtc = TenAm.AddHours(3) });
            var other = await TestData.AddServiceAsync(db, shop.Tenant.Id, "Colore");
            await db.SaveChangesAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        // Bruno is busy 11:00–11:40.
        using var overlap = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "11:15", shop.B.Id);
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);
        Assert.Equal("booking.slot_unavailable", await CodeAsync(overlap));

        // 12:40 + 30 min + 10 min buffer ends after 13:00.
        using var afterHours = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "12:40");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, afterHours.StatusCode);
        Assert.Equal("admin.staff_unavailable", await CodeAsync(afterHours));

        using var timeOff = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "12:00");
        Assert.Equal("admin.staff_unavailable", await CodeAsync(timeOff));

        using var past = await MoveAsync(session, shop.Booked.Id, "2027-02-23", "10:00");
        Assert.Equal("admin.in_past", await CodeAsync(past));

        // Ending exactly where the next appointment starts is fine (half-open intervals).
        using var adjacent = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "10:20", shop.B.Id);
        Assert.Equal(HttpStatusCode.OK, adjacent.StatusCode);
    }

    [Fact]
    public async Task Staff_that_does_not_offer_the_service_cannot_receive_it()
    {
        var shop = await ArrangeShopAsync();
        await using (var db = database.CreateDbContext(shop.Tenant.Id))
        {
            await db.StaffServices.Where(s => s.StaffMemberId == shop.B.Id).ExecuteDeleteAsync();
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);
        using var response = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "11:00", shop.B.Id);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("admin.service_not_offered", await CodeAsync(response));
    }

    [Fact]
    public async Task Business_cancels_with_a_reason_and_final_states_do_not_change()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var cancelled = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/cancel", new { reason = "Chiusura straordinaria" });
        using var again = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/cancel", new { });
        using var move = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "11:00");

        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        Assert.Equal("CancelledByBusiness", (await JsonAsync(cancelled)).GetProperty("status").GetString());
        Assert.Equal("admin.invalid_status", await CodeAsync(again));
        Assert.Equal("admin.invalid_status", await CodeAsync(move));
        var email = Assert.Single(_factory.Emails.SentTo(shop.Customer.Email!));
        Assert.Contains("Motivo: Chiusura straordinaria", email.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Completed_and_no_show_only_after_the_start()
    {
        var shop = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var early = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/complete");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, early.StatusCode);
        Assert.Equal("admin.not_started", await CodeAsync(early));

        _factory.Clock.SetUtcNow(TenAm.AddMinutes(5));
        using var noShow = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/no-show");
        using var complete = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/complete");

        Assert.Equal(HttpStatusCode.OK, noShow.StatusCode);
        Assert.Equal("admin.invalid_status", await CodeAsync(complete));
        Assert.Equal(AppointmentStatus.NoShow, await StatusAsync(shop.Booked.Id));
    }

    [Fact]
    public async Task Staff_sees_and_manages_only_their_own_appointments()
    {
        var shop = await ArrangeShopAsync();
        Guid own;
        await using (var db = database.CreateDbContext())
        {
            var appointment = TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, shop.Customer.Id, TenAm.AddHours(1));
            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();
            own = appointment.Id;
        }

        using var session = await TestUsers.LoginAsync(_factory, shop.StaffUserB);
        var calendar = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-03-02&to=2027-03-02");
        var staff = Assert.Single(calendar.GetProperty("staff").EnumerateArray());
        Assert.True(staff.GetProperty("isMe").GetBoolean());
        Assert.Equal(own, Assert.Single(calendar.GetProperty("appointments").EnumerateArray()).GetProperty("id").GetGuid());

        using var colleague = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/cancel", new { });
        Assert.Equal(HttpStatusCode.Forbidden, colleague.StatusCode);
        Assert.Equal("admin.staff_scope", await CodeAsync(colleague));

        using var toColleague = await MoveAsync(session, own, "2027-03-02", "12:00", shop.A.Id);
        Assert.Equal(HttpStatusCode.Forbidden, toColleague.StatusCode);

        using var ownMove = await MoveAsync(session, own, "2027-03-02", "12:00");
        Assert.Equal(HttpStatusCode.OK, ownMove.StatusCode);
    }

    [Fact]
    public async Task Another_tenant_cannot_see_or_touch_the_appointments()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        using var session = await TestUsers.LoginAsync(_factory, other.Owner);

        var calendar = await session.Client.GetFromJsonAsync<JsonElement>("/api/admin/calendar?from=2027-03-02&to=2027-03-02");
        Assert.DoesNotContain(calendar.GetProperty("appointments").EnumerateArray(), a => a.GetProperty("id").GetGuid() == shop.Booked.Id);

        using var cancel = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/cancel", new { });
        using var move = await MoveAsync(session, shop.Booked.Id, "2027-03-02", "11:00");
        using var complete = await session.PostAsync($"/api/admin/appointments/{shop.Booked.Id}/complete");

        Assert.All([cancel, move, complete], r => Assert.Equal(HttpStatusCode.NotFound, r.StatusCode));
        Assert.Equal(AppointmentStatus.Confirmed, await StatusAsync(shop.Booked.Id));
    }

    [Fact]
    public async Task Owner_and_staff_are_told_when_a_customer_cancels_unless_disabled()
    {
        var shop = await ArrangeShopAsync();
        var customer = await TestUsers.CreateAsync(_factory);
        Guid first;
        Guid second;
        await using (var db = database.CreateDbContext())
        {
            var a = TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, customer.Id, TenAm.AddHours(1));
            var b = TestData.NewAppointment(shop.Tenant.Id, shop.B.Id, shop.Service, customer.Id, TenAm.AddHours(2));
            db.Appointments.AddRange(a, b);
            await db.SaveChangesAsync();
            (first, second) = (a.Id, b.Id);
        }

        using var session = await TestUsers.LoginAsync(_factory, customer);
        (await session.PostAsync($"/api/me/appointments/{first}/cancel")).Dispose();

        Assert.Single(_factory.Emails.SentTo(shop.Owner.Email!), m => m.Subject.StartsWith("Disdetta", StringComparison.Ordinal));
        Assert.Single(_factory.Emails.SentTo(shop.StaffUserB.Email!), m => m.Subject.StartsWith("Disdetta", StringComparison.Ordinal));

        await using (var db = database.CreateDbContext())
        {
            await db.Tenants.Where(t => t.Id == shop.Tenant.Id).ExecuteUpdateAsync(t => t.SetProperty(x => x.NotifyOnCustomerCancellation, false));
        }

        (await session.PostAsync($"/api/me/appointments/{second}/cancel")).Dispose();
        Assert.Single(_factory.Emails.SentTo(shop.Owner.Email!), m => m.Subject.StartsWith("Disdetta", StringComparison.Ordinal));
    }

    public void Dispose() => _factory.Dispose();
}
