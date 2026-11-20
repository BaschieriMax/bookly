using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Entities;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>Admin calendar: appointments of the current tenant and their lifecycle actions.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = Policies.TenantMember)]
[Produces("application/json")]
public sealed class AdminAppointmentsController(CalendarService calendar) : ControllerBase
{
    /// <summary>Appointments, hours and time off for local days [from, to] (max 42 days).</summary>
    [HttpGet("calendar")]
    [ProducesResponseType<CalendarDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IResult> Get(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        [FromQuery] Guid? staffId,
        [FromQuery] bool includeCancelled,
        CancellationToken cancellationToken) =>
        (await calendar.GetAsync(from, to, staffId, includeCancelled, cancellationToken)).ToResult();

    /// <summary>Appointment entered by the business (phone, walk-in; DEC-037).</summary>
    [HttpPost("appointments")]
    [ProducesResponseType<AdminAppointmentDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Create(CreateBusinessAppointmentRequest request, CancellationToken cancellationToken) =>
        (await calendar.CreateAsync(request, cancellationToken)).ToResult();

    [HttpPost("appointments/{id:guid}/move")]
    [ProducesResponseType<AdminAppointmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Move(Guid id, MoveAppointmentRequest request, CancellationToken cancellationToken) =>
        (await calendar.MoveAsync(id, request, cancellationToken)).ToResult();

    [HttpPost("appointments/{id:guid}/cancel")]
    [ProducesResponseType<AdminAppointmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Cancel(Guid id, CancelAppointmentByBusinessRequest request, CancellationToken cancellationToken) =>
        (await calendar.CancelAsync(id, request.Reason, cancellationToken)).ToResult();

    [HttpPost("appointments/{id:guid}/complete")]
    [ProducesResponseType<AdminAppointmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Complete(Guid id, CancellationToken cancellationToken) =>
        (await calendar.MarkAsync(id, AppointmentStatus.Completed, cancellationToken)).ToResult();

    [HttpPost("appointments/{id:guid}/no-show")]
    [ProducesResponseType<AdminAppointmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> NoShow(Guid id, CancellationToken cancellationToken) =>
        (await calendar.MarkAsync(id, AppointmentStatus.NoShow, cancellationToken)).ToResult();
}
