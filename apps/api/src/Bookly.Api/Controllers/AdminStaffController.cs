using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>
/// Staff of the current tenant, with weekly hours and time off. The owner manages everyone;
/// a Staff member can read the list and manage only their own schedule.
/// </summary>
[ApiController]
[Route("api/admin/staff")]
[Authorize(Policy = Policies.TenantMember)]
[Produces("application/json")]
public sealed class AdminStaffController(CatalogService catalog, ScheduleService schedule) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<AdminStaffDto>> List(CancellationToken cancellationToken) => catalog.ListStaffAsync(cancellationToken);

    [HttpPost]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<AdminStaffDto>(StatusCodes.Status201Created)]
    public async Task<IResult> Create(SaveStaffRequest request, CancellationToken cancellationToken)
    {
        var result = await catalog.CreateStaffAsync(request, cancellationToken);
        return result.Succeeded ? Results.Json(result.Value, statusCode: StatusCodes.Status201Created) : result.ToProblem();
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<AdminStaffDto>(StatusCodes.Status200OK)]
    public async Task<IResult> Update(Guid id, SaveStaffRequest request, CancellationToken cancellationToken) =>
        (await catalog.UpdateStaffAsync(id, request, cancellationToken)).ToResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken) =>
        (await catalog.DeleteStaffAsync(id, cancellationToken)).ToResult();

    [HttpGet("{id:guid}/working-hours")]
    [ProducesResponseType<IReadOnlyList<WorkingIntervalDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<IResult> GetHours(Guid id, CancellationToken cancellationToken) =>
        (await schedule.GetHoursAsync(id, cancellationToken)).ToResult();

    [HttpPut("{id:guid}/working-hours")]
    [ProducesResponseType<IReadOnlyList<WorkingIntervalDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<IResult> ReplaceHours(Guid id, SaveWorkingHoursRequest request, CancellationToken cancellationToken) =>
        (await schedule.ReplaceHoursAsync(id, request, cancellationToken)).ToResult();

    [HttpGet("{id:guid}/time-off")]
    [ProducesResponseType<IReadOnlyList<TimeOffDto>>(StatusCodes.Status200OK)]
    public async Task<IResult> ListTimeOff(Guid id, CancellationToken cancellationToken) =>
        (await schedule.ListTimeOffAsync(id, cancellationToken)).ToResult();

    [HttpPost("{id:guid}/time-off")]
    [ProducesResponseType<CreatedTimeOffDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> AddTimeOff(Guid id, CreateTimeOffRequest request, CancellationToken cancellationToken) =>
        (await schedule.AddTimeOffAsync(id, request, cancellationToken)).ToResult();

    [HttpDelete("{id:guid}/time-off/{timeOffId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IResult> DeleteTimeOff(Guid id, Guid timeOffId, CancellationToken cancellationToken) =>
        (await schedule.DeleteTimeOffAsync(id, timeOffId, cancellationToken)).ToResult();
}
