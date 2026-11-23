using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>DEC-040: owners and the staff member's login are emailed when a customer books online.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class OnlineBookingNoticeTests(PostgresFixture database) : IDisposable
{
    // Clock: Monday 1 March 2027 08:00 Rome. Both staff work Tuesday 2 March 09:00–13:00.
    private readonly BooklyApiFactory _factory = new(database);

    private static readonly DateTimeOffset TenAm = new(2027, 3, 2, 10, 0, 0, TimeSpan.FromHours(1));

    private sealed record Shop(Tenant Tenant, StaffMember A, StaffMember B, Service Service, AppUser Owner, AppUser StaffUserB);

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

        var owner = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Owner));
        var staffUser = await TestUsers.CreateAsync(_factory, memberships: (tenant.Id, TenantRole.Staff));
        await LinkStaffAsync(b.Id, staffUser.Id);
        return new Shop(tenant, a, b, service, owner, staffUser);
    }

    private async Task LinkStaffAsync(Guid staffId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        await db.StaffMembers.IgnoreQueryFilters().Where(s => s.Id == staffId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, userId));
    }

    /// <summary>A confirmed customer called Mario Rossi, with or without a phone number.</summary>
    private async Task<AppUser> CustomerAsync(string? phone = "333 123 4567")
    {
        var customer = await TestUsers.CreateAsync(_factory);
        await using var db = database.CreateDbContext();
        await db.Users.Where(u => u.Id == customer.Id).ExecuteUpdateAsync(u => u
            .SetProperty(x => x.FirstName, "Mario")
            .SetProperty(x => x.LastName, "Rossi")
            .SetProperty(x => x.PhoneNumber, phone));
        return customer;
    }

    private static Task<HttpResponseMessage> BookAsync(ApiSession session, Shop shop, DateTimeOffset start, Guid staffId, string? note = null) =>
        session.PostAsync($"/api/tenants/{shop.Tenant.Slug}/appointments", new { serviceId = shop.Service.Id, staffId, start, note });

    private List<EmailMessage> Notices(AppUser user) =>
        [.. _factory.Emails.SentTo(user.Email!).Where(m => m.Kind == nameof(EmailTemplates.OnlineBookingNotice))];

    [Fact]
    public async Task Owner_and_staff_login_get_the_booking_with_the_customer_contacts_and_a_calendar_link()
    {
        var shop = await ArrangeShopAsync();
        var other = await ArrangeShopAsync();
        var customer = await CustomerAsync();
        using var session = await TestUsers.LoginAsync(_factory, customer);

        using var response = await BookAsync(session, shop, TenAm, shop.B.Id, "Arrivo in bici <ok?>");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var toOwner = Assert.Single(Notices(shop.Owner));
        var toStaff = Assert.Single(Notices(shop.StaffUserB));
        Assert.Equal("Nuova prenotazione: Mario Rossi, martedì 2 marzo 2027, 10:00", toOwner.Subject);
        Assert.Equal(toOwner.Subject, toStaff.Subject);
        Assert.Contains("Mario Rossi ha prenotato online da", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("Servizio: Taglio\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("Operatore: Bruno\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("Telefono: 333 123 4567\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains($"Email: {customer.Email}\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("Nota: «Arrivo in bici <ok?>»\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("Apri il calendario: https://app.bookly.test/admin?data=2027-03-02\n", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("apre il calendario su martedì 2 marzo.", toOwner.TextBody, StringComparison.Ordinal);
        Assert.Contains("href=\"tel:3331234567\"", toOwner.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("Arrivo in bici &lt;ok?&gt;", toOwner.HtmlBody, StringComparison.Ordinal);
        Assert.DoesNotContain("<ok?>", toOwner.HtmlBody, StringComparison.Ordinal);

        // The customer only gets the confirmation; nobody in another business hears of it.
        Assert.Equal(nameof(EmailTemplates.BookingConfirmed), Assert.Single(_factory.Emails.SentTo(customer.Email!)).Kind);
        Assert.Empty(Notices(other.Owner));
        Assert.Empty(Notices(other.StaffUserB));
    }

    [Fact]
    public async Task One_email_per_person_and_only_to_logins_that_are_still_members()
    {
        var shop = await ArrangeShopAsync();
        var formerStaff = await TestUsers.CreateAsync(_factory); // a login no longer in the business
        await LinkStaffAsync(shop.A.Id, formerStaff.Id);
        var customer = await CustomerAsync(phone: null);
        using var session = await TestUsers.LoginAsync(_factory, customer);

        using var first = await BookAsync(session, shop, TenAm, shop.A.Id);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var notice = Assert.Single(Notices(shop.Owner));
        Assert.Empty(Notices(formerStaff));
        Assert.Empty(Notices(shop.StaffUserB)); // not their appointment
        Assert.DoesNotContain("Telefono:", notice.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("Nota:", notice.TextBody, StringComparison.Ordinal);

        // The owner also works as staff A: still one email for them.
        await LinkStaffAsync(shop.A.Id, shop.Owner.Id);
        using var second = await BookAsync(session, shop, TenAm.AddHours(1), shop.A.Id);

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(2, Notices(shop.Owner).Count);
    }

    [Fact]
    public async Task No_email_for_appointments_entered_by_the_business_or_when_switched_off()
    {
        var shop = await ArrangeShopAsync();
        using var owner = await TestUsers.LoginAsync(_factory, shop.Owner);

        using var entered = await owner.PostAsync("/api/admin/appointments", new
        {
            serviceId = shop.Service.Id,
            staffId = shop.B.Id,
            date = "2027-03-02",
            time = "09:00",
            newCustomer = new { firstName = "Paolo", lastName = "Ferrari", phone = "339 123 4567", email = "paolo@example.test" },
            notifyCustomer = true,
        });

        Assert.Equal(HttpStatusCode.Created, entered.StatusCode);
        Assert.Empty(Notices(shop.Owner));
        Assert.Empty(Notices(shop.StaffUserB));

        // The owner turns the notice off; the cancellation notice stays on.
        var settings = (await owner.Client.GetFromJsonAsync<JsonObject>("/api/admin/settings"))!;
        Assert.True(settings["notifyOnOnlineBooking"]!.GetValue<bool>());
        settings["notifyOnOnlineBooking"] = false;
        using var saved = await owner.SendAsync(HttpMethod.Put, "/api/admin/settings", settings);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var savedBody = (await saved.Content.ReadFromJsonAsync<JsonObject>())!;
        Assert.False(savedBody["notifyOnOnlineBooking"]!.GetValue<bool>());
        Assert.True(savedBody["notifyOnCustomerCancellation"]!.GetValue<bool>());

        var customer = await CustomerAsync();
        using var session = await TestUsers.LoginAsync(_factory, customer);
        using var booked = await BookAsync(session, shop, TenAm, shop.B.Id);

        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
        Assert.Empty(Notices(shop.Owner));
        Assert.Empty(Notices(shop.StaffUserB));
        Assert.Single(_factory.Emails.SentTo(customer.Email!)); // the customer's confirmation still goes out
    }

    [Fact]
    public async Task The_booking_stands_when_the_notice_cannot_be_sent()
    {
        var shop = await ArrangeShopAsync();
        var customer = await CustomerAsync();
        using var session = await TestUsers.LoginAsync(_factory, customer);

        // The owner's mailbox fails: the booking is saved and the staff member still gets the email.
        _factory.Emails.FailWhen = m => m.To == shop.Owner.Email;
        using var first = await BookAsync(session, shop, TenAm, shop.B.Id);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Empty(Notices(shop.Owner));
        Assert.Single(Notices(shop.StaffUserB));

        // Every email fails (SMTP down): still booked.
        _factory.Emails.FailWhen = _ => true;
        using var second = await BookAsync(session, shop, TenAm.AddHours(1), shop.B.Id);

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        await using var db = database.CreateDbContext(shop.Tenant.Id);
        Assert.Equal(2, await db.Appointments.CountAsync(a => a.CustomerId == customer.Id && a.Status == AppointmentStatus.Confirmed));
    }

    public void Dispose() => _factory.Dispose();
}
