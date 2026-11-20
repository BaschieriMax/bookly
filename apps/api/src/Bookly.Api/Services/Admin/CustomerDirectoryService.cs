using Bookly.Api.Data;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// Customer search for the "new appointment" dialog (DEC-037): the business's address book plus
/// the accounts that already booked with it. Accounts that never booked here stay invisible, so the
/// business learns nothing new about the platform's users.
/// </summary>
public sealed class CustomerDirectoryService(AppDbContext db)
{
    public const int MinQueryLength = 2;
    public const int Limit = 10;

    public const string AccountKind = "Account";
    public const string AddressBookKind = "AddressBook";

    public async Task<IReadOnlyList<CustomerSearchResultDto>> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var text = query?.Trim() ?? string.Empty;
        if (text.Length < MinQueryLength)
        {
            return [];
        }

        var pattern = $"%{EscapeLike(text)}%";
        var digits = TenantCustomer.Digits(text);
        // Phone matching needs a few digits, so "Ro" does not match every number.
        var phonePattern = digits.Length >= 3 ? $"%{digits}%" : null;

        // The tenant filter scopes both the address book and the appointments below.
        var addressBook = await db.TenantCustomers.AsNoTracking()
            .Where(c => c.AnonymizedAt == null
                && (EF.Functions.ILike(c.FirstName + " " + c.LastName, pattern, @"\")
                    || EF.Functions.ILike(c.LastName + " " + c.FirstName, pattern, @"\")
                    || (c.Email != null && EF.Functions.ILike(c.Email, pattern, @"\"))
                    || (phonePattern != null && c.PhoneDigits != null && EF.Functions.Like(c.PhoneDigits, phonePattern))))
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName).ThenBy(c => c.Id)
            .Take(Limit)
            .Select(c => new CustomerSearchResultDto(AddressBookKind, c.Id, c.FirstName, c.LastName, c.Phone, c.Email))
            .ToListAsync(cancellationToken);

        var accounts = await db.Users.AsNoTracking()
            .Where(u => u.DeletedAt == null
                && db.Appointments.Any(a => a.CustomerId == u.Id)
                && (EF.Functions.ILike(u.FirstName + " " + u.LastName, pattern, @"\")
                    || EF.Functions.ILike(u.LastName + " " + u.FirstName, pattern, @"\")
                    || EF.Functions.ILike(u.Email!, pattern, @"\")
                    || (phonePattern != null && u.PhoneNumber != null && EF.Functions.Like(u.PhoneNumber.Replace(" ", string.Empty), phonePattern))))
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ThenBy(u => u.Id)
            .Take(Limit)
            .Select(u => new CustomerSearchResultDto(AccountKind, u.Id, u.FirstName, u.LastName, u.PhoneNumber, u.Email))
            .ToListAsync(cancellationToken);

        return [.. accounts.Concat(addressBook)
            .OrderBy(c => c.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.FirstName, StringComparer.OrdinalIgnoreCase)
            .Take(Limit)];
    }

    private static string EscapeLike(string value) =>
        value.Replace(@"\", @"\\", StringComparison.Ordinal)
            .Replace("%", @"\%", StringComparison.Ordinal)
            .Replace("_", @"\_", StringComparison.Ordinal);
}
