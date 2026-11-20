using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Bookly.Api.Data.Configurations;

internal sealed class TenantCustomerConfiguration : IEntityTypeConfiguration<TenantCustomer>
{
    public const int NameMaxLength = 100;
    public const int PhoneMaxLength = 30;
    public const int EmailMaxLength = 256;

    public void Configure(EntityTypeBuilder<TenantCustomer> builder)
    {
        builder.Property(c => c.FirstName).HasMaxLength(NameMaxLength);
        builder.Property(c => c.LastName).HasMaxLength(NameMaxLength);
        builder.Property(c => c.Phone).HasMaxLength(PhoneMaxLength);
        builder.Property(c => c.PhoneDigits).HasMaxLength(PhoneMaxLength);
        builder.Property(c => c.Email).HasMaxLength(EmailMaxLength);

        builder.HasIndex(c => new { c.TenantId, c.PhoneDigits });
        builder.HasIndex(c => new { c.TenantId, c.LastName, c.FirstName });

        builder.HasOne<Tenant>().WithMany().HasForeignKey(c => c.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}
