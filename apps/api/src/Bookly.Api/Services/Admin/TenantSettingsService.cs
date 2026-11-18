using Bookly.Api.Data;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Admin;

/// <summary>Business settings, brand and logo of the current tenant (owner only).</summary>
public sealed class TenantSettingsService(AppDbContext db, AdminContext admin, TimeProvider timeProvider)
{
    public const int MaxLogoBytes = 200 * 1024;

    public async Task<TenantSettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        return ToDto(tenant);
    }

    public async Task<ServiceResult<TenantSettingsDto>> SaveSettingsAsync(SaveTenantSettingsRequest request, CancellationToken cancellationToken)
    {
        if (!TimeZoneInfo.TryFindSystemTimeZoneById(request.TimeZone, out _) || !request.TimeZone.Contains('/', StringComparison.Ordinal))
        {
            return ServiceResult<TenantSettingsDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidTimeZone, "Unknown IANA time zone.");
        }

        var tenant = await db.Tenants.SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        tenant.Name = request.Name.Trim();
        tenant.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        tenant.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        tenant.TimeZone = request.TimeZone;
        tenant.CancellationWindowHours = request.CancellationWindowHours;
        tenant.SlotIntervalMinutes = request.SlotIntervalMinutes;
        tenant.MinNoticeMinutes = request.MinNoticeMinutes;
        tenant.BookingHorizonDays = request.BookingHorizonDays;
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<TenantSettingsDto>.Ok(ToDto(tenant));
    }

    public async Task<TenantBrandSettingsDto> GetBrandAsync(CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        var hasLogo = await db.TenantLogos.AnyAsync(l => l.TenantId == tenant.Id, cancellationToken);
        return new TenantBrandSettingsDto(tenant.BrandPrimaryColor, tenant.BrandGround.ToString(), tenant.BrandHeadingFont.ToString(), hasLogo);
    }

    public async Task<TenantBrandSettingsDto> SaveBrandAsync(SaveTenantBrandRequest request, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.SingleAsync(t => t.Id == admin.TenantId, cancellationToken);
        tenant.BrandPrimaryColor = request.PrimaryColor?.ToLowerInvariant();
        tenant.BrandGround = Enum.Parse<TenantGround>(request.Ground);
        tenant.BrandHeadingFont = Enum.Parse<TenantHeadingFont>(request.HeadingFont);
        await db.SaveChangesAsync(cancellationToken);
        return await GetBrandAsync(cancellationToken);
    }

    /// <summary>
    /// Stores the logo after checking size and the real file signature (not just the declared
    /// content type): only PNG and WebP, never SVG (script injection), max 200 KB (assumption A9).
    /// </summary>
    public async Task<ServiceResult<TenantBrandSettingsDto>> SaveLogoAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length is 0 or > MaxLogoBytes)
        {
            return InvalidLogo();
        }

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        var contentType = DetectImageType(bytes);
        if (contentType is null)
        {
            return InvalidLogo();
        }

        var logo = await db.TenantLogos.SingleOrDefaultAsync(l => l.TenantId == admin.TenantId, cancellationToken);
        if (logo is null)
        {
            db.TenantLogos.Add(new TenantLogo { TenantId = admin.TenantId, ContentType = contentType, Data = bytes, UpdatedAt = timeProvider.GetUtcNow() });
        }
        else
        {
            logo.ContentType = contentType;
            logo.Data = bytes;
            logo.UpdatedAt = timeProvider.GetUtcNow();
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<TenantBrandSettingsDto>.Ok(await GetBrandAsync(cancellationToken));
    }

    public async Task DeleteLogoAsync(CancellationToken cancellationToken) =>
        await db.TenantLogos.Where(l => l.TenantId == admin.TenantId).ExecuteDeleteAsync(cancellationToken);

    internal static string? DetectImageType(ReadOnlySpan<byte> bytes)
    {
        ReadOnlySpan<byte> png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        if (bytes.StartsWith(png))
        {
            return "image/png";
        }

        var isWebp = bytes.Length >= 12
            && bytes[..4].SequenceEqual("RIFF"u8)
            && bytes.Slice(8, 4).SequenceEqual("WEBP"u8);
        return isWebp ? "image/webp" : null;
    }

    private static ServiceResult<TenantBrandSettingsDto> InvalidLogo() =>
        ServiceResult<TenantBrandSettingsDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidLogo, "The logo must be a PNG or WebP image up to 200 KB.");

    private static TenantSettingsDto ToDto(Tenant t) => new(
        t.Slug, t.Name, t.Phone, t.Address, t.TimeZone, t.CancellationWindowHours, t.SlotIntervalMinutes, t.MinNoticeMinutes, t.BookingHorizonDays);
}
