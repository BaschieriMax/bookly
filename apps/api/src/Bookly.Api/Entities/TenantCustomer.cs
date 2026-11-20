namespace Bookly.Api.Entities;

/// <summary>
/// A customer in a business's own address book: people booked by phone or in person who have no
/// Bookly account (DEC-037). The business is the data controller; the platform only stores it.
/// </summary>
public class TenantCustomer : ITenantOwned
{
    public Guid Id { get; set; }

    public Guid TenantId { get; set; }

    public required string FirstName { get; set; }

    public required string LastName { get; set; }

    /// <summary>As typed by the business; null once anonymised.</summary>
    public string? Phone { get; set; }

    /// <summary>Digits of <see cref="Phone"/>, used to search and to avoid duplicates.</summary>
    public string? PhoneDigits { get; set; }

    /// <summary>Optional: only used for confirmations and reminders.</summary>
    public string? Email { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>Set by the retention job: the row stays for the history, without personal data.</summary>
    public DateTimeOffset? AnonymizedAt { get; set; }

    public static string Digits(string phone) => new([.. phone.Where(char.IsAsciiDigit)]);
}
