using System.Linq.Expressions;
using Bookly.Api.Entities;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
    : IdentityDbContext<AppUser, AppRole, Guid>(options), IDataProtectionKeyContext
{
    /// <summary>Name of the named query filter that isolates tenant-owned data (DEC-006).</summary>
    public const string TenantFilter = "Tenant";

    public const string UiSchema = "ui";

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<TenantLogo> TenantLogos => Set<TenantLogo>();

    public DbSet<TenantMembership> TenantMemberships => Set<TenantMembership>();

    public DbSet<StaffMember> StaffMembers => Set<StaffMember>();

    public DbSet<Service> Services => Set<Service>();

    public DbSet<StaffService> StaffServices => Set<StaffService>();

    public DbSet<WorkingHours> WorkingHours => Set<WorkingHours>();

    public DbSet<TimeOff> TimeOffs => Set<TimeOff>();

    public DbSet<Appointment> Appointments => Set<Appointment>();

    public DbSet<TenantCustomer> TenantCustomers => Set<TenantCustomer>();

    public DbSet<NavigationItem> NavigationItems => Set<NavigationItem>();

    public DbSet<NavigationItemRole> NavigationItemRoles => Set<NavigationItemRole>();

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    /// <summary>
    /// Read by the tenant query filter. EF Core evaluates it per DbContext instance, so every
    /// request only sees the rows of its own tenant; no tenant means no rows.
    /// </summary>
    private Guid? CurrentTenantId => tenantContext.TenantId;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.HasPostgresExtension("btree_gist");
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(ITenantOwned).IsAssignableFrom(entityType.ClrType))
            {
                ApplyTenantFilterMethod
                    .MakeGenericMethod(entityType.ClrType)
                    .Invoke(this, [builder]);
            }
        }
    }

    private static readonly System.Reflection.MethodInfo ApplyTenantFilterMethod =
        typeof(AppDbContext).GetMethod(
            nameof(ApplyTenantFilter),
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!;

    private void ApplyTenantFilter<TEntity>(ModelBuilder builder)
        where TEntity : class, ITenantOwned
    {
        Expression<Func<TEntity, bool>> filter = e => e.TenantId == CurrentTenantId;
        builder.Entity<TEntity>().HasQueryFilter(TenantFilter, filter);
    }
}
