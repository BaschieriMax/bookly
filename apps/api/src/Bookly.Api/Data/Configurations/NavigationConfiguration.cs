using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

/// <summary>Sidebar entries in the dedicated "ui" schema (DEC-019).</summary>
internal sealed class NavigationItemConfiguration : IEntityTypeConfiguration<NavigationItem>
{
    public void Configure(EntityTypeBuilder<NavigationItem> builder)
    {
        builder.ToTable("NavigationItems", AppDbContext.UiSchema);

        builder.Property(n => n.Key).HasMaxLength(60);
        builder.Property(n => n.LabelKey).HasMaxLength(80);
        builder.Property(n => n.Icon).HasMaxLength(40);
        builder.Property(n => n.Route).HasMaxLength(120);
        builder.Property(n => n.Area).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(n => n.Key).IsUnique();
        builder.HasIndex(n => new { n.Area, n.SortOrder });

        builder.HasOne(n => n.Parent).WithMany().HasForeignKey(n => n.ParentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(n => n.Roles).WithOne().HasForeignKey(r => r.NavigationItemId).OnDelete(DeleteBehavior.Cascade);

        builder.HasData(NavigationSeed.Items);
    }
}

internal sealed class NavigationItemRoleConfiguration : IEntityTypeConfiguration<NavigationItemRole>
{
    public void Configure(EntityTypeBuilder<NavigationItemRole> builder)
    {
        builder.ToTable("NavigationItemRoles", AppDbContext.UiSchema, t =>
            t.HasCheckConstraint("CK_NavigationItemRoles_Role", "\"Role\" IN ('Owner', 'Staff', 'SuperAdmin')"));

        builder.HasKey(r => new { r.NavigationItemId, r.Role });
        builder.Property(r => r.Role).HasMaxLength(20);

        builder.HasData(NavigationSeed.Roles);
    }
}

/// <summary>Initial menu. Changes go through a new migration; SuperAdmin can toggle and reorder at runtime.</summary>
internal static class NavigationSeed
{
    private const string Owner = "Owner";
    private const string Staff = "Staff";
    private const string SuperAdmin = "SuperAdmin";

    public static readonly NavigationItem[] Items =
    [
        Item(1, "admin.calendar", "nav.calendar", "calendar-days", "/admin", NavigationArea.Admin, 10),
        Item(7, "admin.customers", "nav.customers", "contact-round", "/admin/clienti", NavigationArea.Admin, 15),
        Item(2, "admin.services", "nav.services", "scissors", "/admin/servizi", NavigationArea.Admin, 20),
        Item(3, "admin.staff", "nav.staff", "users", "/admin/staff", NavigationArea.Admin, 30),
        Item(4, "admin.schedule", "nav.schedule", "clock", "/admin/orari", NavigationArea.Admin, 40),
        Item(5, "admin.brand", "nav.brand", "palette", "/admin/brand", NavigationArea.Admin, 50),
        Item(6, "admin.settings", "nav.settings", "sliders-horizontal", "/admin/impostazioni", NavigationArea.Admin, 60),
        Item(101, "platform.tenants", "nav.tenants", "building-2", "/platform/tenant", NavigationArea.Platform, 10),
        Item(102, "platform.navigation", "nav.navigation", "panel-left", "/platform/navigazione", NavigationArea.Platform, 20),
    ];

    public static readonly NavigationItemRole[] Roles =
    [
        Role(1, Owner), Role(1, Staff),
        Role(2, Owner),
        Role(3, Owner),
        Role(4, Owner), Role(4, Staff),
        Role(5, Owner),
        Role(6, Owner),
        Role(7, Owner),
        Role(101, SuperAdmin),
        Role(102, SuperAdmin),
    ];

    private static NavigationItem Item(int id, string key, string labelKey, string icon, string route, NavigationArea area, int sortOrder) =>
        new() { Id = id, Key = key, LabelKey = labelKey, Icon = icon, Route = route, Area = area, SortOrder = sortOrder, IsEnabled = true };

    private static NavigationItemRole Role(int itemId, string role) => new() { NavigationItemId = itemId, Role = role };
}
