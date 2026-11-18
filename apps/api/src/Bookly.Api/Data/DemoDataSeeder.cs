using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Data;

/// <summary>
/// Demo data for local development only (Database:SeedDemoData=true). Idempotent.
/// Accounts: admin@bookly.local (SuperAdmin), titolare@bookly.local (Owner),
/// staff@bookly.local (Staff), cliente@bookly.local (customer). Password: Database:DemoPassword.
/// </summary>
internal static class DemoDataSeeder
{
    public const string TenantSlug = "barberia-demo";

    public static async Task SeedAsync(IServiceProvider services, string password)
    {
        var db = services.GetRequiredService<AppDbContext>();
        if (await db.Tenants.AnyAsync(t => t.Slug == TenantSlug))
        {
            return;
        }

        var users = services.GetRequiredService<UserManager<AppUser>>();
        var now = DateTimeOffset.UtcNow;

        var tenant = new Tenant
        {
            Id = Guid.CreateVersion7(),
            Slug = TenantSlug,
            Name = "Barberia Demo",
            Phone = "059 000 0000",
            Address = "Via Esempio 1, Modena",
            BrandPrimaryColor = "#e8b05a",
            BrandGround = TenantGround.Dark,
            BrandHeadingFont = TenantHeadingFont.Script,
            CreatedAt = now,
        };
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        var admin = await CreateUserAsync(users, "admin@bookly.local", "Super", "Admin", password);
        await users.AddToRoleAsync(admin, AppRoleConfiguration.SuperAdmin);
        var owner = await CreateUserAsync(users, "titolare@bookly.local", "Titolare", "Demo", password);
        var staffUser = await CreateUserAsync(users, "staff@bookly.local", "Barbiere", "Uno", password);
        await CreateUserAsync(users, "cliente@bookly.local", "Cliente", "Demo", password);

        db.TenantMemberships.AddRange(
            new TenantMembership { TenantId = tenant.Id, UserId = owner.Id, Role = TenantRole.Owner, CreatedAt = now },
            new TenantMembership { TenantId = tenant.Id, UserId = staffUser.Id, Role = TenantRole.Staff, CreatedAt = now });

        Service NewService(string name, int duration, int buffer, int? priceCents, int order, bool from = false) => new()
        {
            Id = Guid.CreateVersion7(),
            TenantId = tenant.Id,
            Name = name,
            DurationMinutes = duration,
            BufferMinutes = buffer,
            PriceCents = priceCents,
            PriceIsFrom = from,
            SortOrder = order,
        };

        var services_ = new[]
        {
            NewService("Taglio", 30, 10, 2500, 10),
            NewService("Taglio + Barba", 45, 15, 3500, 20),
            NewService("Barba", 20, 10, 1500, 30),
            NewService("Decolorazione", 120, 15, 10000, 40, from: true),
        };
        db.Services.AddRange(services_);

        var staff = new[]
        {
            new StaffMember { Id = Guid.CreateVersion7(), TenantId = tenant.Id, DisplayName = "Barbiere 1", UserId = staffUser.Id, SortOrder = 10 },
            new StaffMember { Id = Guid.CreateVersion7(), TenantId = tenant.Id, DisplayName = "Barbiere 2", SortOrder = 20 },
        };
        db.StaffMembers.AddRange(staff);

        foreach (var member in staff)
        {
            foreach (var service in services_)
            {
                db.StaffServices.Add(new StaffService { TenantId = tenant.Id, StaffMemberId = member.Id, ServiceId = service.Id });
            }

            for (var day = DayOfWeek.Monday; day <= DayOfWeek.Saturday; day++)
            {
                db.WorkingHours.AddRange(
                    new WorkingHours { Id = Guid.CreateVersion7(), TenantId = tenant.Id, StaffMemberId = member.Id, DayOfWeek = day, StartLocal = new TimeOnly(9, 0), EndLocal = new TimeOnly(13, 0) },
                    new WorkingHours { Id = Guid.CreateVersion7(), TenantId = tenant.Id, StaffMemberId = member.Id, DayOfWeek = day, StartLocal = new TimeOnly(14, 30), EndLocal = new TimeOnly(19, 0) });
            }
        }

        await db.SaveChangesAsync();
    }

    private static async Task<AppUser> CreateUserAsync(UserManager<AppUser> users, string email, string firstName, string lastName, string password)
    {
        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = firstName,
            LastName = lastName,
            PrivacyAcceptedAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Demo user {email} not created: {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }

        return user;
    }
}
