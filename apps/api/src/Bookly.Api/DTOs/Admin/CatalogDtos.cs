using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.DTOs.Admin;

public sealed record AdminServiceDto(
    Guid Id,
    string Name,
    string? Description,
    int DurationMinutes,
    int BufferMinutes,
    int? PriceCents,
    bool PriceIsFrom,
    bool IsActive,
    int SortOrder,
    IReadOnlyList<Guid> StaffIds);

public sealed record SaveServiceRequest(
    [Required, MaxLength(80)] string Name,
    [MaxLength(300)] string? Description,
    [Range(5, 600)] int DurationMinutes,
    [Range(0, 120)] int BufferMinutes,
    [Range(0, 10_000_000)] int? PriceCents,
    bool PriceIsFrom,
    bool IsActive,
    [Range(0, 10_000)] int SortOrder);

public sealed record AdminStaffDto(
    Guid Id,
    string DisplayName,
    bool IsActive,
    int SortOrder,
    bool HasLogin,
    bool IsMe,
    IReadOnlyList<Guid> ServiceIds);

public sealed record SaveStaffRequest(
    [Required, MaxLength(80)] string DisplayName,
    bool IsActive,
    [Range(0, 10_000)] int SortOrder,
    [Required] IReadOnlyList<Guid> ServiceIds);

/// <summary>One working interval in the tenant's local time, e.g. Monday 09:00–13:00.</summary>
public sealed record WorkingIntervalDto(
    [Range(0, 6)] int DayOfWeek,
    [Required] TimeOnly Start,
    [Required] TimeOnly End);

public sealed record SaveWorkingHoursRequest([Required, MaxLength(70)] IReadOnlyList<WorkingIntervalDto> Intervals);

public sealed record TimeOffDto(Guid Id, DateTimeOffset Start, DateTimeOffset End, string? Reason);

public sealed record CreateTimeOffRequest(
    [Required] DateTimeOffset Start,
    [Required] DateTimeOffset End,
    [MaxLength(200)] string? Reason);

/// <summary>Created time off plus how many confirmed appointments it overlaps (the owner should move them).</summary>
public sealed record CreatedTimeOffDto(TimeOffDto TimeOff, int ConflictingAppointments);
