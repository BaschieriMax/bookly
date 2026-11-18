namespace Bookly.Api.Entities;

/// <summary>Recurring weekly working interval in the tenant's local time. Several per day are allowed (lunch break).</summary>
public class WorkingHours : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid StaffMemberId { get; set; }

    public DayOfWeek DayOfWeek { get; set; }

    public TimeOnly StartLocal { get; set; }

    public TimeOnly EndLocal { get; set; }
}
