using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.HasIndex(t => t.Slug).IsUnique();
        builder.Property(t => t.Slug).HasMaxLength(60);
        builder.Property(t => t.Name).HasMaxLength(120);
        builder.Property(t => t.TimeZone).HasMaxLength(64);
        builder.Property(t => t.Phone).HasMaxLength(30);
        builder.Property(t => t.Address).HasMaxLength(200);
        builder.Property(t => t.BrandPrimaryColor).HasMaxLength(7);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(t => t.BrandGround).HasConversion<string>().HasMaxLength(10);
        builder.Property(t => t.BrandHeadingFont).HasConversion<string>().HasMaxLength(10);

        builder.HasOne(t => t.Logo)
            .WithOne()
            .HasForeignKey<TenantLogo>(l => l.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Tenants_Slug", "\"Slug\" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
            t.HasCheckConstraint("CK_Tenants_CancellationWindowHours", "\"CancellationWindowHours\" BETWEEN 0 AND 168");
            t.HasCheckConstraint("CK_Tenants_SlotIntervalMinutes", "\"SlotIntervalMinutes\" BETWEEN 5 AND 120");
            t.HasCheckConstraint("CK_Tenants_MinNoticeMinutes", "\"MinNoticeMinutes\" BETWEEN 0 AND 10080");
            t.HasCheckConstraint("CK_Tenants_BookingHorizonDays", "\"BookingHorizonDays\" BETWEEN 1 AND 365");
            t.HasCheckConstraint("CK_Tenants_BrandPrimaryColor", "\"BrandPrimaryColor\" IS NULL OR \"BrandPrimaryColor\" ~ '^#[0-9a-fA-F]{6}$'");
        });
    }
}

internal sealed class TenantLogoConfiguration : IEntityTypeConfiguration<TenantLogo>
{
    public void Configure(EntityTypeBuilder<TenantLogo> builder)
    {
        builder.HasKey(l => l.TenantId);
        builder.Property(l => l.ContentType).HasMaxLength(20);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_TenantLogos_ContentType", "\"ContentType\" IN ('image/png', 'image/webp')");
            t.HasCheckConstraint("CK_TenantLogos_Size", "octet_length(\"Data\") <= 204800");
        });
    }
}

internal sealed class TenantMembershipConfiguration : IEntityTypeConfiguration<TenantMembership>
{
    public void Configure(EntityTypeBuilder<TenantMembership> builder)
    {
        builder.HasKey(m => new { m.TenantId, m.UserId });
        builder.HasIndex(m => m.UserId);
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);

        builder.HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(m => m.User).WithMany(u => u.Memberships).HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.FirstName).HasMaxLength(100);
        builder.Property(u => u.LastName).HasMaxLength(100);
    }
}

internal sealed class AppRoleConfiguration : IEntityTypeConfiguration<AppRole>
{
    public static readonly Guid SuperAdminRoleId = new("6f1c3a52-6a2e-4c43-9a43-2b9f6c0f1a01");

    public const string SuperAdmin = "SuperAdmin";

    public void Configure(EntityTypeBuilder<AppRole> builder)
    {
        builder.HasData(new AppRole
        {
            Id = SuperAdminRoleId,
            Name = SuperAdmin,
            NormalizedName = "SUPERADMIN",
            ConcurrencyStamp = "a4b7c1d2-0000-4000-8000-000000000001",
        });
    }
}
