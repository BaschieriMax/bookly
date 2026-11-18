namespace Bookly.Api.Entities;

public class StaffMember : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public required string DisplayName { get; set; }

    /// <summary>Optional login of the staff member (null when the owner manages their agenda).</summary>
    public Guid? UserId { get; set; }

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public AppUser? User { get; set; }

    public ICollection<StaffService> Services { get; } = [];

    public ICollection<WorkingHours> WorkingHours { get; } = [];
}
