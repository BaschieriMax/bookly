using Bookly.Api.Data;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Services.Admin;

/// <summary>
/// Weekly hours and time off of a staff member. Owners manage everyone; a Staff member only
/// their own schedule (booking-domain: roles).
/// </summary>
public sealed class ScheduleService(AppDbContext db, AdminContext admin, TimeProvider timeProvider)
{
    public async Task<ServiceResult<IReadOnlyList<WorkingIntervalDto>>> GetHoursAsync(Guid staffId, CancellationToken cancellationToken)
    {
        var access = await CheckAccessAsync<IReadOnlyList<WorkingIntervalDto>>(staffId, cancellationToken);
        if (access is not null)
        {
            return access;
        }

        var hours = await db.WorkingHours
            .AsNoTracking()
            .Where(w => w.StaffMemberId == staffId)
            .OrderBy(w => w.DayOfWeek).ThenBy(w => w.StartLocal)
            .Select(w => new WorkingIntervalDto((int)w.DayOfWeek, w.StartLocal, w.EndLocal))
            .ToListAsync(cancellationToken);
        return ServiceResult<IReadOnlyList<WorkingIntervalDto>>.Ok(hours);
    }

    /// <summary>Replaces the whole week. Intervals must not overlap on the same day.</summary>
    public async Task<ServiceResult<IReadOnlyList<WorkingIntervalDto>>> ReplaceHoursAsync(
        Guid staffId, SaveWorkingHoursRequest request, CancellationToken cancellationToken)
    {
        var access = await CheckAccessAsync<IReadOnlyList<WorkingIntervalDto>>(staffId, cancellationToken);
        if (access is not null)
        {
            return access;
        }

        var ordered = request.Intervals.OrderBy(i => i.DayOfWeek).ThenBy(i => i.Start).ToList();
        for (var i = 0; i < ordered.Count; i++)
        {
            var current = ordered[i];
            var overlapsPrevious = i > 0 && ordered[i - 1].DayOfWeek == current.DayOfWeek && ordered[i - 1].End > current.Start;
            if (current.End <= current.Start || overlapsPrevious)
            {
                return ServiceResult<IReadOnlyList<WorkingIntervalDto>>.Fail(
                    StatusCodes.Status400BadRequest, ErrorCodes.OverlappingHours, "Intervals must end after they start and must not overlap.");
            }
        }

        // Delete + insert atomically. With a retrying execution strategy the transaction must run inside it.
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            await db.WorkingHours.Where(w => w.StaffMemberId == staffId).ExecuteDeleteAsync(cancellationToken);
            db.WorkingHours.AddRange(ordered.Select(i => new WorkingHours
            {
                Id = Guid.CreateVersion7(),
                TenantId = admin.TenantId,
                StaffMemberId = staffId,
                DayOfWeek = (DayOfWeek)i.DayOfWeek,
                StartLocal = i.Start,
                EndLocal = i.End,
            }));
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        });

        return ServiceResult<IReadOnlyList<WorkingIntervalDto>>.Ok(ordered);
    }

    public async Task<ServiceResult<IReadOnlyList<TimeOffDto>>> ListTimeOffAsync(Guid staffId, CancellationToken cancellationToken)
    {
        var access = await CheckAccessAsync<IReadOnlyList<TimeOffDto>>(staffId, cancellationToken);
        if (access is not null)
        {
            return access;
        }

        var since = timeProvider.GetUtcNow().AddDays(-30);
        var items = await db.TimeOffs
            .AsNoTracking()
            .Where(t => t.StaffMemberId == staffId && t.EndUtc >= since)
            .OrderBy(t => t.StartUtc)
            .Select(t => new TimeOffDto(t.Id, t.StartUtc, t.EndUtc, t.Reason))
            .ToListAsync(cancellationToken);
        return ServiceResult<IReadOnlyList<TimeOffDto>>.Ok(items);
    }

    public async Task<ServiceResult<CreatedTimeOffDto>> AddTimeOffAsync(Guid staffId, CreateTimeOffRequest request, CancellationToken cancellationToken)
    {
        var access = await CheckAccessAsync<CreatedTimeOffDto>(staffId, cancellationToken);
        if (access is not null)
        {
            return access;
        }

        var start = request.Start.ToUniversalTime();
        var end = request.End.ToUniversalTime();
        if (end <= start || end - start > TimeSpan.FromDays(366))
        {
            return ServiceResult<CreatedTimeOffDto>.Fail(StatusCodes.Status400BadRequest, ErrorCodes.InvalidRange, "The end must be after the start (max one year).");
        }

        var timeOff = new TimeOff
        {
            Id = Guid.CreateVersion7(),
            TenantId = admin.TenantId,
            StaffMemberId = staffId,
            StartUtc = start,
            EndUtc = end,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
        };
        db.TimeOffs.Add(timeOff);
        await db.SaveChangesAsync(cancellationToken);

        // Existing appointments are not cancelled automatically: the owner decides (calendar, Step 9).
        var conflicts = await db.Appointments.CountAsync(
            a => a.StaffMemberId == staffId && a.Status == AppointmentStatus.Confirmed && a.StartUtc < end && a.BlockedUntilUtc > start,
            cancellationToken);

        return ServiceResult<CreatedTimeOffDto>.Ok(
            new CreatedTimeOffDto(new TimeOffDto(timeOff.Id, start, end, timeOff.Reason), conflicts),
            StatusCodes.Status201Created);
    }

    public async Task<ServiceResult<bool>> DeleteTimeOffAsync(Guid staffId, Guid timeOffId, CancellationToken cancellationToken)
    {
        var access = await CheckAccessAsync<bool>(staffId, cancellationToken);
        if (access is not null)
        {
            return access;
        }

        var deleted = await db.TimeOffs.Where(t => t.Id == timeOffId && t.StaffMemberId == staffId).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0
            ? ServiceResult<bool>.Fail(StatusCodes.Status404NotFound, ErrorCodes.NotFound, "Not found.")
            : ServiceResult<bool>.Ok(true);
    }

    /// <summary>Null when allowed; otherwise the failure to return (404 other tenant, 403 other staff).</summary>
    private async Task<ServiceResult<T>?> CheckAccessAsync<T>(Guid staffId, CancellationToken cancellationToken)
    {
        var staff = await db.StaffMembers.AsNoTracking()
            .Where(s => s.Id == staffId)
            .Select(s => new { s.UserId })
            .SingleOrDefaultAsync(cancellationToken);

        if (staff is null)
        {
            return ServiceResult<T>.Fail(StatusCodes.Status404NotFound, ErrorCodes.NotFound, "Not found.");
        }

        return admin.IsOwner || staff.UserId == admin.UserId
            ? null
            : ServiceResult<T>.Fail(StatusCodes.Status403Forbidden, ErrorCodes.StaffScope, "Staff members can only manage their own schedule.");
    }
}
