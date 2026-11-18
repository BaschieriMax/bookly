using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

internal sealed class StaffMemberConfiguration : IEntityTypeConfiguration<StaffMember>
{
    public void Configure(EntityTypeBuilder<StaffMember> builder)
    {
        builder.Property(s => s.DisplayName).HasMaxLength(80);
        builder.HasIndex(s => new { s.TenantId, s.SortOrder });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class ServiceConfiguration : IEntityTypeConfiguration<Service>
{
    public void Configure(EntityTypeBuilder<Service> builder)
    {
        builder.Property(s => s.Name).HasMaxLength(80);
        builder.Property(s => s.Description).HasMaxLength(300);
        builder.HasIndex(s => new { s.TenantId, s.SortOrder });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Services_Duration", "\"DurationMinutes\" BETWEEN 5 AND 600");
            t.HasCheckConstraint("CK_Services_Buffer", "\"BufferMinutes\" BETWEEN 0 AND 120");
            t.HasCheckConstraint("CK_Services_Price", "\"PriceCents\" IS NULL OR \"PriceCents\" >= 0");
        });
    }
}

internal sealed class StaffServiceConfiguration : IEntityTypeConfiguration<StaffService>
{
    public void Configure(EntityTypeBuilder<StaffService> builder)
    {
        builder.HasKey(s => new { s.StaffMemberId, s.ServiceId });
        builder.HasIndex(s => new { s.TenantId, s.ServiceId });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(s => s.StaffMember).WithMany(m => m.Services).HasForeignKey(s => s.StaffMemberId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(s => s.Service).WithMany(s => s.Staff).HasForeignKey(s => s.ServiceId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WorkingHoursConfiguration : IEntityTypeConfiguration<WorkingHours>
{
    public void Configure(EntityTypeBuilder<WorkingHours> builder)
    {
        builder.HasIndex(w => new { w.TenantId, w.StaffMemberId, w.DayOfWeek });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<StaffMember>().WithMany(s => s.WorkingHours).HasForeignKey(w => w.StaffMemberId).OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_WorkingHours_Range", "\"EndLocal\" > \"StartLocal\"");
            t.HasCheckConstraint("CK_WorkingHours_Day", "\"DayOfWeek\" BETWEEN 0 AND 6");
        });
    }
}

internal sealed class TimeOffConfiguration : IEntityTypeConfiguration<TimeOff>
{
    public void Configure(EntityTypeBuilder<TimeOff> builder)
    {
        builder.Property(t => t.Reason).HasMaxLength(200);
        builder.HasIndex(t => new { t.TenantId, t.StaffMemberId, t.StartUtc });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(t => t.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<StaffMember>().WithMany().HasForeignKey(t => t.StaffMemberId).OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("CK_TimeOffs_Range", "\"EndUtc\" > \"StartUtc\""));
    }
}
