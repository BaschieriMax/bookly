using Bookly.Api.Entities;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// The person an appointment is for: a Bookly account or an entry of the business's address book
/// (DEC-037). Emails and the calendar go through this, never through one of the two directly.
/// </summary>
public sealed record CustomerContact(string FirstName, string LastName, string? Email, string? Phone, bool HasAccount)
{
    /// <summary>Requires <see cref="Appointment.Customer"/> and <see cref="Appointment.TenantCustomer"/> loaded.</summary>
    public static CustomerContact Of(Appointment appointment)
    {
        if (appointment.Customer is { } user)
        {
            // A deleted account keeps only its anonymised name (DEC-030).
            return user.DeletedAt is null
                ? new CustomerContact(user.FirstName, user.LastName, user.Email, user.PhoneNumber, HasAccount: true)
                : new CustomerContact(user.FirstName, user.LastName, null, null, HasAccount: true);
        }

        var entry = appointment.TenantCustomer
            ?? throw new InvalidOperationException($"Appointment {appointment.Id} has no customer loaded.");
        return new CustomerContact(entry.FirstName, entry.LastName, entry.Email, entry.Phone, HasAccount: false);
    }

    /// <summary>Where to email about the appointment, or null: no address, or the business chose not to notify.</summary>
    public string? NotifyEmail(Appointment appointment) =>
        appointment.NotifyCustomer && !string.IsNullOrWhiteSpace(Email) ? Email : null;
}
