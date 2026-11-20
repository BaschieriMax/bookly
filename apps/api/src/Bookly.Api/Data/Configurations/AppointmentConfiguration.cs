using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

internal sealed class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    /// <summary>Exclusion constraint created in the migration with raw SQL (DEC-009).</summary>
    public const string NoOverlapConstraint = "EX_Appointments_NoOverlap";

    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(a => a.CustomerNote).HasMaxLength(500);
        builder.Property(a => a.CancellationReason).HasMaxLength(200);
        builder.Property(a => a.Origin).HasConversion<string>().HasMaxLength(20);

        // Npgsql maps a uint row version to the PostgreSQL xmin system column.
        builder.Property(a => a.Version).IsRowVersion();

        builder.HasIndex(a => new { a.TenantId, a.StaffMemberId, a.StartUtc });
        builder.HasIndex(a => new { a.CustomerId, a.StartUtc });
        builder.HasIndex(a => new { a.TenantCustomerId, a.StartUtc });
        builder.HasIndex(a => new { a.Status, a.StartUtc })
            .HasFilter("\"ReminderSentAt\" IS NULL")
            .HasDatabaseName("IX_Appointments_PendingReminders");

        builder.HasOne<Tenant>().WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(a => a.StaffMember).WithMany().HasForeignKey(a => a.StaffMemberId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(a => a.Service).WithMany().HasForeignKey(a => a.ServiceId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(a => a.Customer).WithMany().HasForeignKey(a => a.CustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(a => a.TenantCustomer).WithMany().HasForeignKey(a => a.TenantCustomerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<AppUser>().WithMany().HasForeignKey(a => a.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Appointments_Range", "\"EndUtc\" > \"StartUtc\"");
            t.HasCheckConstraint("CK_Appointments_Blocked", "\"BlockedUntilUtc\" >= \"EndUtc\"");
            // An account customer or an address-book customer, never both, never neither (DEC-037).
            t.HasCheckConstraint("CK_Appointments_OneCustomer", "num_nonnulls(\"CustomerId\", \"TenantCustomerId\") = 1");
        });
    }
}
