namespace Bookly.Api.Entities;

public class Appointment : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public Guid StaffMemberId { get; set; }

    public Guid ServiceId { get; set; }

    /// <summary>The customer's Bookly account; null when the customer is in the business's address book.</summary>
    public Guid? CustomerId { get; set; }

    /// <summary>Address-book customer (no account). Exactly one of the two customer ids is set (DEC-037).</summary>
    public Guid? TenantCustomerId { get; set; }

    public AppointmentOrigin Origin { get; set; } = AppointmentOrigin.Online;

    /// <summary>Owner or staff member who entered a <see cref="AppointmentOrigin.Business"/> appointment.</summary>
    public Guid? CreatedByUserId { get; set; }

    /// <summary>
    /// Whether the customer gets emails about this appointment (confirmation, reminder, changes).
    /// Always true online; the business can turn it off when it enters the appointment.
    /// </summary>
    public bool NotifyCustomer { get; set; } = true;

    public DateTimeOffset StartUtc { get; set; }

    public DateTimeOffset EndUtc { get; set; }

    /// <summary>EndUtc plus the service buffer at booking time; used by the overlap constraint (DEC-009).</summary>
    public DateTimeOffset BlockedUntilUtc { get; set; }

    public AppointmentStatus Status { get; set; } = AppointmentStatus.Confirmed;

    public string? CustomerNote { get; set; }

    /// <summary>Optional reason given by the business when it cancels (shown to the customer).</summary>
    public string? CancellationReason { get; set; }

    public DateTimeOffset? ReminderSentAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Optimistic concurrency token mapped to PostgreSQL xmin.</summary>
    public uint Version { get; set; }

    public StaffMember StaffMember { get; set; } = null!;

    public Service Service { get; set; } = null!;

    public AppUser? Customer { get; set; }

    public TenantCustomer? TenantCustomer { get; set; }
}
