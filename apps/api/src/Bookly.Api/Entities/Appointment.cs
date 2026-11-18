namespace Bookly.Api.Entities;

public class Appointment : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid StaffMemberId { get; set; }

    public Guid ServiceId { get; set; }

    public Guid CustomerId { get; set; }

    public DateTimeOffset StartUtc { get; set; }

    public DateTimeOffset EndUtc { get; set; }

    /// <summary>EndUtc plus the service buffer at booking time; used by the overlap constraint (DEC-009).</summary>
    public DateTimeOffset BlockedUntilUtc { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Confirmed;

    public string? CustomerNote { get; set; }

    public DateTimeOffset? ReminderSentAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Optimistic concurrency token mapped to PostgreSQL xmin.</summary>
    public uint Version { get; set; }

    public StaffMember StaffMember { get; set; } = null!;

    public Service Service { get; set; } = null!;

    public AppUser Customer { get; set; } = null!;
}
