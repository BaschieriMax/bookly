using Bookly.Api.Data;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// Services and staff of the current tenant (the tenant filter scopes every query, DEC-006).
/// Rows referenced by appointments are never deleted: they can be deactivated instead.
/// </summary>
public sealed class CatalogService(AppDbContext db, AdminContext admin)
{
    public async Task<IReadOnlyList<AdminServiceDto>> ListServicesAsync(CancellationToken cancellationToken) =>
        await db.Services
            .AsNoTracking()
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new AdminServiceDto(
                s.Id, s.Name, s.Description, s.DurationMinutes, s.BufferMinutes, s.PriceCents, s.PriceIsFrom,
                s.IsActive, s.SortOrder, s.Staff.Select(x => x.StaffMemberId).ToList()))
            .ToListAsync(cancellationToken);

    public async Task<AdminServiceDto> CreateServiceAsync(SaveServiceRequest request, CancellationToken cancellationToken)
    {
        var service = new Service { Id = Guid.CreateVersion7(), TenantId = admin.TenantId, Name = request.Name.Trim() };
        Apply(service, request);
        db.Services.Add(service);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(service, []);
    }

    public async Task<ServiceResult<AdminServiceDto>> UpdateServiceAsync(Guid id, SaveServiceRequest request, CancellationToken cancellationToken)
    {
        var service = await db.Services.Include(s => s.Staff).SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (service is null)
        {
            return NotFound<AdminServiceDto>();
        }

        Apply(service, request);
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<AdminServiceDto>.Ok(ToDto(service, [.. service.Staff.Select(s => s.StaffMemberId)]));
    }

    public async Task<ServiceResult<bool>> DeleteServiceAsync(Guid id, CancellationToken cancellationToken)
    {
        var service = await db.Services.SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (service is null)
        {
            return NotFound<bool>();
        }

        if (await db.Appointments.AnyAsync(a => a.ServiceId == id, cancellationToken))
        {
            return InUse<bool>();
        }

        db.Services.Remove(service);
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Ok(true);
    }

    public async Task<IReadOnlyList<AdminStaffDto>> ListStaffAsync(CancellationToken cancellationToken) =>
        await db.StaffMembers
            .AsNoTracking()
            .OrderBy(s => s.SortOrder).ThenBy(s => s.DisplayName)
            .Select(s => new AdminStaffDto(
                s.Id, s.DisplayName, s.IsActive, s.SortOrder, s.UserId != null, s.UserId == admin.UserId,
                s.Services.Select(x => x.ServiceId).ToList()))
            .ToListAsync(cancellationToken);

    public async Task<ServiceResult<AdminStaffDto>> CreateStaffAsync(SaveStaffRequest request, CancellationToken cancellationToken)
    {
        var staff = new StaffMember { Id = Guid.CreateVersion7(), TenantId = admin.TenantId, DisplayName = request.DisplayName.Trim() };
        db.StaffMembers.Add(staff);
        return await SaveStaffAsync(staff, request, cancellationToken);
    }

    public async Task<ServiceResult<AdminStaffDto>> UpdateStaffAsync(Guid id, SaveStaffRequest request, CancellationToken cancellationToken)
    {
        var staff = await db.StaffMembers.Include(s => s.Services).SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        return staff is null ? NotFound<AdminStaffDto>() : await SaveStaffAsync(staff, request, cancellationToken);
    }

    public async Task<ServiceResult<bool>> DeleteStaffAsync(Guid id, CancellationToken cancellationToken)
    {
        var staff = await db.StaffMembers.SingleOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (staff is null)
        {
            return NotFound<bool>();
        }

        if (await db.Appointments.AnyAsync(a => a.StaffMemberId == id, cancellationToken))
        {
            return InUse<bool>();
        }

        db.StaffMembers.Remove(staff);
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<bool>.Ok(true);
    }

    private async Task<ServiceResult<AdminStaffDto>> SaveStaffAsync(StaffMember staff, SaveStaffRequest request, CancellationToken cancellationToken)
    {
        // Only services of this tenant can be linked (the filter hides the others).
        var wanted = request.ServiceIds.Distinct().ToList();
        var valid = await db.Services.Where(s => wanted.Contains(s.Id)).Select(s => s.Id).ToListAsync(cancellationToken);
        if (valid.Count != wanted.Count)
        {
            return NotFound<AdminStaffDto>();
        }

        staff.DisplayName = request.DisplayName.Trim();
        staff.IsActive = request.IsActive;
        staff.SortOrder = request.SortOrder;

        foreach (var link in staff.Services.Where(l => !valid.Contains(l.ServiceId)).ToList())
        {
            staff.Services.Remove(link);
        }

        foreach (var serviceId in valid.Where(id => staff.Services.All(l => l.ServiceId != id)))
        {
            staff.Services.Add(new StaffService { TenantId = admin.TenantId, StaffMemberId = staff.Id, ServiceId = serviceId });
        }

        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<AdminStaffDto>.Ok(new AdminStaffDto(
            staff.Id, staff.DisplayName, staff.IsActive, staff.SortOrder, staff.UserId != null, staff.UserId == admin.UserId, valid));
    }

    private static void Apply(Service service, SaveServiceRequest request)
    {
        service.Name = request.Name.Trim();
        service.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        service.DurationMinutes = request.DurationMinutes;
        service.BufferMinutes = request.BufferMinutes;
        service.PriceCents = request.PriceCents;
        service.PriceIsFrom = request.PriceCents is not null && request.PriceIsFrom;
        service.IsActive = request.IsActive;
        service.SortOrder = request.SortOrder;
    }

    private static AdminServiceDto ToDto(Service s, IReadOnlyList<Guid> staffIds) =>
        new(s.Id, s.Name, s.Description, s.DurationMinutes, s.BufferMinutes, s.PriceCents, s.PriceIsFrom, s.IsActive, s.SortOrder, staffIds);

    private static ServiceResult<T> NotFound<T>() =>
        ServiceResult<T>.Fail(StatusCodes.Status404NotFound, ErrorCodes.NotFound, "Not found.");

    private static ServiceResult<T> InUse<T>() =>
        ServiceResult<T>.Fail(StatusCodes.Status409Conflict, ErrorCodes.InUse, "It has appointments: deactivate it instead of deleting it.");
}
