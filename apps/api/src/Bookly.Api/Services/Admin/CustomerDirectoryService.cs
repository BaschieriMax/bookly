using System.Globalization;
using System.Linq.Expressions;
using System.Text;
using System.Text.Json;
using Bookly.Api.Data;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Availability;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// The customers of the current tenant (DEC-037, DEC-038): its address book plus the accounts that
/// already booked with it. Accounts that never booked here stay invisible, so the business learns
/// nothing new about the platform's users. Address-book entries belong to the business, which can
/// correct, export and erase them; accounts are read-only here (their owners manage them).
/// </summary>
public sealed class CustomerDirectoryService(AppDbContext db, AdminContext admin, TimeProvider timeProvider)
{
    public const int MinQueryLength = 2;
    public const int Limit = 10;
    public const int MaxPageSize = 100;
    public const int AppointmentPageSize = 10;
    public const int MaxAppointmentPageSize = 50;
    public const string Upcoming = "upcoming";
    public const string Past = "past";

    public const string AccountKind = "Account";
    public const string AddressBookKind = "AddressBook";

    /// <summary>Internal reason on appointments cancelled because the customer's data was erased.</summary>
    public const string ErasedReason = "Dati del cliente cancellati";

    /// <summary>Search for the "new appointment" dialog: at most <see cref="Limit"/> results.</summary>
    public async Task<IReadOnlyList<CustomerSearchResultDto>> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var text = query?.Trim() ?? string.Empty;
        if (text.Length < MinQueryLength)
        {
            return [];
        }

        var addressBook = await AddressBook(text)
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName).ThenBy(c => c.Id)
            .Take(Limit)
            .Select(c => new CustomerSearchResultDto(AddressBookKind, c.Id, c.FirstName, c.LastName, c.Phone, c.Email))
            .ToListAsync(cancellationToken);

        var accounts = await Accounts(text)
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ThenBy(u => u.Id)
            .Take(Limit)
            .Select(u => new CustomerSearchResultDto(AccountKind, u.Id, u.FirstName, u.LastName, u.PhoneNumber, u.Email))
            .ToListAsync(cancellationToken);

        return [.. accounts.Concat(addressBook)
            .OrderBy(c => c.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(c => c.FirstName, StringComparer.OrdinalIgnoreCase)
            .Take(Limit)];
    }

    /// <summary>
    /// The "Clienti" page: both kinds, optionally filtered, sorted by last name, with a few numbers
    /// per customer. A local business has hundreds or a few thousand customers, so the two lists are
    /// merged in memory and then paged.
    /// </summary>
    public async Task<CustomerListDto> ListAsync(string? query, string? kind, int page, int pageSize, CancellationToken cancellationToken)
    {
        var text = query?.Trim();
        var now = timeProvider.GetUtcNow();
        var timeZone = await TimeZoneAsync(cancellationToken);
        var rows = new List<CustomerListItemDto>();

        if (kind is null || kind == AddressBookKind)
        {
            rows.AddRange((await AddressBook(text)
                .Select(c => new
                {
                    c.Id,
                    c.FirstName,
                    c.LastName,
                    c.Phone,
                    c.Email,
                    Count = db.Appointments.Count(a => a.TenantCustomerId == c.Id),
                    LastVisit = db.Appointments
                        .Where(a => a.TenantCustomerId == c.Id && a.StartUtc < now
                            && (a.Status == AppointmentStatus.Completed || a.Status == AppointmentStatus.Confirmed))
                        .Max(a => (DateTimeOffset?)a.StartUtc),
                    Next = db.Appointments
                        .Where(a => a.TenantCustomerId == c.Id && a.StartUtc >= now && a.Status == AppointmentStatus.Confirmed)
                        .Min(a => (DateTimeOffset?)a.StartUtc),
                })
                .ToListAsync(cancellationToken))
                .Select(c => new CustomerListItemDto(
                    AddressBookKind, c.Id, c.FirstName, c.LastName, c.Phone, c.Email, c.Count, Local(c.LastVisit, timeZone), Local(c.Next, timeZone))));
        }

        if (kind is null || kind == AccountKind)
        {
            rows.AddRange((await Accounts(text)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.PhoneNumber,
                    u.Email,
                    Count = db.Appointments.Count(a => a.CustomerId == u.Id),
                    LastVisit = db.Appointments
                        .Where(a => a.CustomerId == u.Id && a.StartUtc < now
                            && (a.Status == AppointmentStatus.Completed || a.Status == AppointmentStatus.Confirmed))
                        .Max(a => (DateTimeOffset?)a.StartUtc),
                    Next = db.Appointments
                        .Where(a => a.CustomerId == u.Id && a.StartUtc >= now && a.Status == AppointmentStatus.Confirmed)
                        .Min(a => (DateTimeOffset?)a.StartUtc),
                })
                .ToListAsync(cancellationToken))
                .Select(u => new CustomerListItemDto(
                    AccountKind, u.Id, u.FirstName, u.LastName, u.PhoneNumber, u.Email, u.Count, Local(u.LastVisit, timeZone), Local(u.Next, timeZone))));
        }

        var size = Math.Clamp(pageSize, 1, MaxPageSize);
        var number = Math.Max(page, 1);
        var sorted = rows
            .OrderBy(c => c.LastName, StringComparer.Create(CultureInfo.GetCultureInfo("it-IT"), ignoreCase: true))
            .ThenBy(c => c.FirstName, StringComparer.Create(CultureInfo.GetCultureInfo("it-IT"), ignoreCase: true))
            .ThenBy(c => c.Id);
        return new CustomerListDto(rows.Count, number, size, [.. sorted.Skip((number - 1) * size).Take(size)]);
    }

    /// <summary>An address-book entry with its appointments here; null when unknown or anonymised.</summary>
    public async Task<CustomerDetailDto?> GetAddressBookAsync(Guid id, CancellationToken cancellationToken)
    {
        var entry = await db.TenantCustomers.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == id && c.AnonymizedAt == null, cancellationToken);
        if (entry is null)
        {
            return null;
        }

        var timeZone = await TimeZoneAsync(cancellationToken);
        return new CustomerDetailDto(
            AddressBookKind,
            entry.Id,
            entry.FirstName,
            entry.LastName,
            entry.Phone,
            entry.Email,
            entry.CreatedAt,
            await StatsAsync(a => a.TenantCustomerId == entry.Id, timeZone, cancellationToken));
    }

    /// <summary>An account that booked here, read-only; null otherwise (no account is revealed).</summary>
    public async Task<CustomerDetailDto?> GetAccountAsync(Guid id, CancellationToken cancellationToken)
    {
        var user = await Accounts(null).AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user is null)
        {
            return null;
        }

        var timeZone = await TimeZoneAsync(cancellationToken);
        return new CustomerDetailDto(
            AccountKind,
            user.Id,
            user.FirstName,
            user.LastName,
            user.PhoneNumber,
            user.Email,
            null,
            await StatsAsync(a => a.CustomerId == user.Id, timeZone, cancellationToken));
    }

    /// <summary>
    /// A page of the appointments of an address-book entry (kind AddressBook) or of an account that
    /// booked here (kind Account); null when the customer is not one of this business.
    /// </summary>
    public async Task<CustomerAppointmentPageDto?> AppointmentsAsync(
        string kind, Guid id, string when, int page, int pageSize, CancellationToken cancellationToken)
    {
        Expression<Func<Appointment, bool>> ofCustomer;
        if (kind == AddressBookKind)
        {
            if (!await db.TenantCustomers.AnyAsync(c => c.Id == id && c.AnonymizedAt == null, cancellationToken))
            {
                return null;
            }

            ofCustomer = a => a.TenantCustomerId == id;
        }
        else
        {
            if (!await Accounts(null).AnyAsync(u => u.Id == id, cancellationToken))
            {
                return null;
            }

            ofCustomer = a => a.CustomerId == id;
        }

        var now = timeProvider.GetUtcNow();
        var size = Math.Clamp(pageSize, 1, MaxAppointmentPageSize);
        var number = Math.Max(page, 1);
        var query = db.Appointments.AsNoTracking().Where(ofCustomer);
        query = when == Upcoming
            ? query.Where(a => a.StartUtc >= now).OrderBy(a => a.StartUtc).ThenBy(a => a.Id)
            : query.Where(a => a.StartUtc < now).OrderByDescending(a => a.StartUtc).ThenBy(a => a.Id);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .Skip((number - 1) * size)
            .Take(size)
            .Select(a => new { a.Id, a.StartUtc, Service = a.Service.Name, Staff = a.StaffMember.DisplayName, a.Status, a.Origin })
            .ToListAsync(cancellationToken);
        var timeZone = await TimeZoneAsync(cancellationToken);
        return new CustomerAppointmentPageDto(total, number, size, [.. rows.Select(a => new CustomerAppointmentDto(
            a.Id, TimeZoneInfo.ConvertTime(a.StartUtc, timeZone), a.Service, a.Staff, a.Status.ToString(), a.Origin.ToString()))]);
    }

    /// <summary>Corrects an address-book entry (a wrong number, a typo in the name).</summary>
    public async Task<ServiceResult<CustomerDetailDto>> UpdateAddressBookAsync(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken)
    {
        var entry = await db.TenantCustomers.SingleOrDefaultAsync(c => c.Id == id && c.AnonymizedAt == null, cancellationToken);
        if (entry is null)
        {
            return NotFound<CustomerDetailDto>();
        }

        entry.FirstName = request.FirstName.Trim();
        entry.LastName = request.LastName.Trim();
        entry.Phone = request.Phone.Trim();
        entry.PhoneDigits = TenantCustomer.Digits(entry.Phone);
        entry.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        entry.UpdatedAt = timeProvider.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<CustomerDetailDto>.Ok((await GetAddressBookAsync(id, cancellationToken))!);
    }

    /// <summary>
    /// GDPR access request of a customer without an account: their data at this business, as a
    /// JSON file the owner hands over. Null when unknown or anonymised.
    /// </summary>
    public async Task<CustomerExport?> ExportAddressBookAsync(Guid id, CancellationToken cancellationToken)
    {
        var entry = await db.TenantCustomers.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == id && c.AnonymizedAt == null, cancellationToken);
        if (entry is null)
        {
            return null;
        }

        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var timeZone = AvailabilityService.TimeZoneOf(tenant);
        var appointments = await db.Appointments.AsNoTracking()
            .Where(a => a.TenantCustomerId == entry.Id)
            .OrderBy(a => a.StartUtc)
            .Select(a => new
            {
                a.StartUtc,
                Service = a.Service.Name,
                Staff = a.StaffMember.DisplayName,
                a.Status,
                a.CustomerNote,
            })
            .ToListAsync(cancellationToken);

        var document = new
        {
            exportedAt = timeProvider.GetUtcNow(),
            business = tenant.Name,
            customer = new
            {
                firstName = entry.FirstName,
                lastName = entry.LastName,
                phone = entry.Phone,
                email = entry.Email,
                inAddressBookSince = entry.CreatedAt,
            },
            appointments = appointments.Select(a => new
            {
                start = TimeZoneInfo.ConvertTime(a.StartUtc, timeZone),
                service = a.Service,
                staff = a.Staff,
                status = a.Status.ToString(),
                note = a.CustomerNote,
            }),
        };

        var json = JsonSerializer.SerializeToUtf8Bytes(document, ExportJson);
        return new CustomerExport($"cliente-{Slug(entry.LastName)}-{Slug(entry.FirstName)}.json", json);
    }

    /// <summary>
    /// GDPR erasure of an address-book entry: name and contacts are anonymised, the notes of its
    /// appointments cleared and its future appointments cancelled (no email: the data is gone).
    /// Past appointments stay for the business's history, as "Cliente anonimo".
    /// </summary>
    public async Task<ServiceResult<EraseCustomerResultDto>> EraseAddressBookAsync(Guid id, CancellationToken cancellationToken)
    {
        var entry = await db.TenantCustomers.SingleOrDefaultAsync(c => c.Id == id && c.AnonymizedAt == null, cancellationToken);
        if (entry is null)
        {
            return NotFound<EraseCustomerResultDto>();
        }

        var now = timeProvider.GetUtcNow();
        var cancelled = 0;
        // The retrying execution strategy needs the whole transaction as one retriable unit.
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            cancelled = await db.Appointments
                .Where(a => a.TenantCustomerId == entry.Id && a.Status == AppointmentStatus.Confirmed && a.StartUtc > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.Status, AppointmentStatus.CancelledByBusiness)
                    .SetProperty(a => a.CancellationReason, ErasedReason)
                    .SetProperty(a => a.UpdatedAt, now), cancellationToken);

            await db.Appointments
                .Where(a => a.TenantCustomerId == entry.Id && a.CustomerNote != null)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.CustomerNote, (string?)null), cancellationToken);

            entry.FirstName = "Cliente";
            entry.LastName = "anonimo";
            entry.Phone = null;
            entry.PhoneDigits = null;
            entry.Email = null;
            entry.AnonymizedAt = now;
            entry.UpdatedAt = now;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

        return ServiceResult<EraseCustomerResultDto>.Ok(new EraseCustomerResultDto(cancelled));
    }

    /// <summary>Address-book entries, optionally matching the text (name, email, phone digits).</summary>
    private IQueryable<TenantCustomer> AddressBook(string? text)
    {
        // The tenant filter scopes the address book.
        var entries = db.TenantCustomers.AsNoTracking().Where(c => c.AnonymizedAt == null);
        if (string.IsNullOrEmpty(text))
        {
            return entries;
        }

        var (pattern, phonePattern) = Patterns(text);
        return entries.Where(c => EF.Functions.ILike(c.FirstName + " " + c.LastName, pattern, @"\")
            || EF.Functions.ILike(c.LastName + " " + c.FirstName, pattern, @"\")
            || (c.Email != null && EF.Functions.ILike(c.Email, pattern, @"\"))
            || (phonePattern != null && c.PhoneDigits != null && EF.Functions.Like(c.PhoneDigits, phonePattern)));
    }

    /// <summary>Accounts that booked with this business (the tenant filter scopes the appointments).</summary>
    private IQueryable<AppUser> Accounts(string? text)
    {
        var users = db.Users.Where(u => u.DeletedAt == null && db.Appointments.Any(a => a.CustomerId == u.Id));
        if (string.IsNullOrEmpty(text))
        {
            return users;
        }

        var (pattern, phonePattern) = Patterns(text);
        return users.Where(u => EF.Functions.ILike(u.FirstName + " " + u.LastName, pattern, @"\")
            || EF.Functions.ILike(u.LastName + " " + u.FirstName, pattern, @"\")
            || EF.Functions.ILike(u.Email!, pattern, @"\")
            || (phonePattern != null && u.PhoneNumber != null && EF.Functions.Like(u.PhoneNumber.Replace(" ", string.Empty), phonePattern)));
    }

    private static (string Pattern, string? PhonePattern) Patterns(string text)
    {
        var digits = TenantCustomer.Digits(text);
        // Phone matching needs a few digits, so "Ro" does not match every number.
        return ($"%{EscapeLike(text)}%", digits.Length >= 3 ? $"%{digits}%" : null);
    }

    // A customer has at most a few hundred appointments here: two columns each, counted in memory.
    private async Task<CustomerStatsDto> StatsAsync(
        Expression<Func<Appointment, bool>> ofCustomer, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var rows = await db.Appointments.AsNoTracking()
            .Where(ofCustomer)
            .Select(a => new { a.StartUtc, a.Status })
            .ToListAsync(cancellationToken);
        var upcoming = rows.Where(a => a.StartUtc >= now).ToList();
        var past = rows.Where(a => a.StartUtc < now).ToList();
        return new CustomerStatsDto(
            rows.Count,
            upcoming.Count,
            past.Count,
            rows.Count(a => a.Status == AppointmentStatus.Completed),
            rows.Count(a => a.Status == AppointmentStatus.NoShow),
            rows.Count(a => a.Status is AppointmentStatus.CancelledByCustomer or AppointmentStatus.CancelledByBusiness),
            Local(past.Where(a => a.Status is AppointmentStatus.Completed or AppointmentStatus.Confirmed)
                .Max(a => (DateTimeOffset?)a.StartUtc), timeZone),
            Local(upcoming.Where(a => a.Status == AppointmentStatus.Confirmed)
                .Min(a => (DateTimeOffset?)a.StartUtc), timeZone));
    }

    private async Task<TimeZoneInfo> TimeZoneAsync(CancellationToken cancellationToken) =>
        AvailabilityService.TimeZoneOf(await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken));

    private static DateTimeOffset? Local(DateTimeOffset? utc, TimeZoneInfo timeZone) =>
        utc is { } value ? TimeZoneInfo.ConvertTime(value, timeZone) : null;

    private static ServiceResult<T> NotFound<T>() =>
        ServiceResult<T>.Fail(StatusCodes.Status404NotFound, ErrorCodes.CustomerNotFound, "Customer not found.");

    private static string EscapeLike(string value) =>
        value.Replace(@"\", @"\\", StringComparison.Ordinal)
            .Replace("%", @"\%", StringComparison.Ordinal)
            .Replace("_", @"\_", StringComparison.Ordinal);

    /// <summary>"De Rossi" → "de-rossi", accents dropped, for the file name.</summary>
    private static string Slug(string value)
    {
        var builder = new StringBuilder();
        foreach (var ch in value.Normalize(NormalizationForm.FormD))
        {
            if (char.IsAsciiLetterOrDigit(ch))
            {
                builder.Append(char.ToLowerInvariant(ch));
            }
            else if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark && builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        var slug = builder.ToString().Trim('-');
        return slug.Length == 0 ? "cliente" : slug;
    }

    private static readonly JsonSerializerOptions ExportJson = new(JsonSerializerDefaults.Web) { WriteIndented = true };
}

/// <summary>A customer's data as a downloadable JSON file.</summary>
public sealed record CustomerExport(string FileName, byte[] Content);
