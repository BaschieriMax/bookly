using Bookly.Api.Data;
using Bookly.Api.Entities;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Minimal builders for test rows. Each call creates new, unique data.</summary>
public static class TestData
{
    public static async Task<Tenant> AddTenantAsync(AppDbContext db, string? slug = null)
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Slug = slug ?? $"tenant-{Guid.NewGuid():N}"[..20],
            Name = "Test tenant",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        return tenant;
    }

    public static async Task<StaffMember> AddStaffAsync(AppDbContext db, Guid tenantId, string name = "Staff")
    {
        var staff = new StaffMember { Id = Guid.NewGuid(), TenantId = tenantId, DisplayName = name };
        db.StaffMembers.Add(staff);
        await db.SaveChangesAsync();
        return staff;
    }

    public static async Task<Service> AddServiceAsync(AppDbContext db, Guid tenantId, string name = "Taglio", int duration = 30, int buffer = 15)
    {
        var service = new Service
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            DurationMinutes = duration,
            BufferMinutes = buffer,
        };
        db.Services.Add(service);
        await db.SaveChangesAsync();
        return service;
    }

    public static async Task AddWorkingHoursAsync(AppDbContext db, Guid tenantId, Guid staffId, DayOfWeek day, TimeOnly start, TimeOnly end)
    {
        db.WorkingHours.Add(new WorkingHours
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StaffMemberId = staffId,
            DayOfWeek = day,
            StartLocal = start,
            EndLocal = end,
        });
        await db.SaveChangesAsync();
    }

    public static async Task EnableServiceAsync(AppDbContext db, Guid tenantId, Guid staffId, Guid serviceId)
    {
        db.StaffServices.Add(new StaffService { TenantId = tenantId, StaffMemberId = staffId, ServiceId = serviceId });
        await db.SaveChangesAsync();
    }

    public static async Task<AppUser> AddCustomerAsync(AppDbContext db)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            FirstName = "Mario",
            LastName = "Rossi",
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public static Appointment NewAppointment(
        Guid tenantId,
        Guid staffId,
        Service service,
        Guid customerId,
        DateTimeOffset startUtc,
        AppointmentStatus status = AppointmentStatus.Confirmed)
    {
        var end = startUtc.AddMinutes(service.DurationMinutes);
        return new Appointment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            StaffMemberId = staffId,
            ServiceId = service.Id,
            CustomerId = customerId,
            StartUtc = startUtc,
            EndUtc = end,
            BlockedUntilUtc = end.AddMinutes(service.BufferMinutes),
            Status = status,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }
}
