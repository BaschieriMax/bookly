namespace Bookly.Api.Entities;

/// <summary>Absolute interval in which a staff member is not available (holidays, leave).</summary>
public class TimeOff : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid StaffMemberId { get; set; }

    public DateTimeOffset StartUtc { get; set; }

    public DateTimeOffset EndUtc { get; set; }

    public string? Reason { get; set; }
}
