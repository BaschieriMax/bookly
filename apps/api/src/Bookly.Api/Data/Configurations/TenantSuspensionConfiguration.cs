using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

internal sealed class TenantSuspensionConfiguration : IEntityTypeConfiguration<TenantSuspension>
{
    public void Configure(EntityTypeBuilder<TenantSuspension> builder)
    {
        builder.HasIndex(s => new { s.TenantId, s.CreatedAt });
        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(s => s.Notices).WithOne(n => n.Suspension).HasForeignKey(n => n.SuspensionId).OnDelete(DeleteBehavior.Cascade);

        builder.ToTable(t => t.HasCheckConstraint("CK_TenantSuspensions_Cancelled", "\"CancelledAppointments\" >= 0"));
    }
}

internal sealed class SuspensionNoticeConfiguration : IEntityTypeConfiguration<SuspensionNotice>
{
    public void Configure(EntityTypeBuilder<SuspensionNotice> builder)
    {
        builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(n => n.Status).HasConversion<string>().HasMaxLength(20);

        // The sender only looks at pending notices that are due.
        builder.HasIndex(n => n.NextAttemptAt)
            .HasFilter("\"Status\" = 'Pending'")
            .HasDatabaseName("IX_SuspensionNotices_Due");
        builder.HasIndex(n => new { n.SuspensionId, n.Kind, n.Status });
        // Daily sending limit: notices sent since midnight UTC.
        builder.HasIndex(n => n.SentAt).HasFilter("\"SentAt\" IS NOT NULL");

        // A deleted owner leaves the notice without recipient: the sender skips it.
        builder.HasOne<AppUser>().WithMany().HasForeignKey(n => n.OwnerUserId).OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t => t.HasCheckConstraint("CK_SuspensionNotices_Attempts", "\"Attempts\" >= 0"));
    }
}
