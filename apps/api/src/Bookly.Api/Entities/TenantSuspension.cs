namespace Bookly.Api.Entities;

/// <summary>
/// A suspension that also cancelled the tenant's future appointments (DEC-039). Groups the emails
/// sent about it. A platform record: not tenant-owned, so no tenant filter applies.
/// </summary>
public class TenantSuspension
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>Appointments moved to CancelledByBusiness by this suspension.</summary>
    public int CancelledAppointments { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<SuspensionNotice> Notices { get; } = [];
}

/// <summary>
/// One email to send about a <see cref="TenantSuspension"/>, sent in the background in batches
/// (DEC-039). It stores only ids: names, addresses and dates are read when the email goes out,
/// so data erased in the meantime is never sent.
/// </summary>
public class SuspensionNotice
{
    public Guid Id { get; set; }

    public Guid SuspensionId { get; set; }

    public SuspensionNoticeKind Kind { get; set; }

    /// <summary>Sending order within the suspension: owner summaries first, then customers by their earliest appointment.</summary>
    public int Position { get; set; }

    /// <summary>
    /// Customer: that customer's cancelled appointments (one email per customer).
    /// OwnerSummary: the cancelled appointments whose customer cannot be emailed.
    /// </summary>
    public List<Guid> AppointmentIds { get; set; } = [];

    /// <summary>OwnerSummary only: the owner to email.</summary>
    public Guid? OwnerUserId { get; set; }

    public SuspensionNoticeStatus Status { get; set; } = SuspensionNoticeStatus.Pending;

    /// <summary>Failed sends so far; the next one waits longer each time.</summary>
    public int Attempts { get; set; }

    /// <summary>Not sent before this instant (retry backoff).</summary>
    public DateTimeOffset NextAttemptAt { get; set; }

    /// <summary>Set by the run that is sending it, so overlapping runs never send twice.</summary>
    public DateTimeOffset? ClaimedAt { get; set; }

    public DateTimeOffset? SentAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public TenantSuspension Suspension { get; set; } = null!;
}

public enum SuspensionNoticeKind
{
    /// <summary>To a customer: their appointments were cancelled (neutral wording, no reason).</summary>
    Customer,

    /// <summary>To an owner: what was cancelled and which customers to call.</summary>
    OwnerSummary,
}

public enum SuspensionNoticeStatus
{
    Pending,
    Sent,

    /// <summary>Nobody to send it to any more (address erased, account deleted).</summary>
    Skipped,

    /// <summary>Gave up after too many failed attempts.</summary>
    Failed,
}
