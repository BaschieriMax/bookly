namespace Bookly.Api.Entities;

/// <summary>Which services a staff member can perform.</summary>
public class StaffService : ITenantOwned
{
    public Guid TenantId { get; set; }

    public Guid StaffMemberId { get; set; }

    public Guid ServiceId { get; set; }

    public StaffMember StaffMember { get; set; } = null!;

    public Service Service { get; set; } = null!;
}
