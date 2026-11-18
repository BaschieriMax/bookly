using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bookly.Api.IntegrationTests;

/// <summary>DEC-009: the database itself rejects overlapping confirmed appointments.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class AppointmentOverlapTests(PostgresFixture database)
{
    private static readonly DateTimeOffset TenAm = new(2026, 11, 26, 9, 0, 0, TimeSpan.Zero); // 10:00 Europe/Rome

    private sealed record Scenario(Tenant Tenant, StaffMember Staff, StaffMember OtherStaff, Service Service, AppUser Customer);

    private async Task<Scenario> ArrangeAsync()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        var staff = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere 1");
        var other = await TestData.AddStaffAsync(db, tenant.Id, "Barbiere 2");
        var service = await TestData.AddServiceAsync(db, tenant.Id, duration: 30, buffer: 15);
        var customer = await TestData.AddCustomerAsync(db);
        return new Scenario(tenant, staff, other, service, customer);
    }

    private async Task InsertAsync(Appointment appointment)
    {
        await using var db = database.CreateDbContext(appointment.TenantId);
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();
    }

    private static void AssertOverlapViolation(DbUpdateException exception)
    {
        var postgres = Assert.IsType<PostgresException>(exception.InnerException);
        Assert.Equal(PostgresErrorCodes.ExclusionViolation, postgres.SqlState);
        Assert.Equal(AppointmentConfiguration.NoOverlapConstraint, postgres.ConstraintName);
    }

    [Fact]
    public async Task Overlapping_confirmed_appointment_for_same_staff_is_rejected()
    {
        var s = await ArrangeAsync();
        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm));

        // 10:30 starts inside the 15 minute buffer of the 10:00 appointment (blocked until 10:45).
        var exception = await Assert.ThrowsAsync<DbUpdateException>(() =>
            InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm.AddMinutes(30))));

        AssertOverlapViolation(exception);
    }

    [Fact]
    public async Task Appointment_starting_exactly_when_the_previous_block_ends_is_allowed()
    {
        var s = await ArrangeAsync();
        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm));

        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm.AddMinutes(45)));
    }

    [Fact]
    public async Task Same_slot_with_a_different_staff_member_is_allowed()
    {
        var s = await ArrangeAsync();
        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm));

        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.OtherStaff.Id, s.Service, s.Customer.Id, TenAm));
    }

    [Fact]
    public async Task Cancelled_appointments_do_not_block_the_slot()
    {
        var s = await ArrangeAsync();
        await InsertAsync(TestData.NewAppointment(
            s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm, AppointmentStatus.CancelledByCustomer));

        await InsertAsync(TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm));
    }

    [Fact]
    public async Task Concurrent_bookings_of_the_same_slot_only_one_succeeds()
    {
        var s = await ArrangeAsync();
        var attempts = Enumerable.Range(0, 5)
            .Select(_ => TestData.NewAppointment(s.Tenant.Id, s.Staff.Id, s.Service, s.Customer.Id, TenAm.AddHours(2)))
            .Select(async appointment =>
            {
                try
                {
                    await InsertAsync(appointment);
                    return true;
                }
                catch (DbUpdateException exception)
                {
                    AssertOverlapViolation(exception);
                    return false;
                }
            });

        var results = await Task.WhenAll(attempts);

        Assert.Single(results, succeeded => succeeded);
    }
}
