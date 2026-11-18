using Bookly.Api.DTOs.Booking;
using Bookly.Api.Entities;
using Bookly.Api.Services.Booking;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>The signed-in customer's own appointments, across all businesses.</summary>
[ApiController]
[Route("api/me/appointments")]
[Authorize]
[Produces("application/json")]
public sealed class MyAppointmentsController(UserManager<AppUser> users, BookingService bookings) : ControllerBase
{
    /// <param name="scope">"upcoming" (default) or "past".</param>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<MyAppointmentDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] string scope = "upcoming", CancellationToken cancellationToken = default)
    {
        if (scope is not ("upcoming" or "past"))
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["scope"] = ["InvalidScope"] }));
        }

        var userId = Guid.Parse(users.GetUserId(User)!);
        Response.Headers.CacheControl = "no-store";
        return Ok(await bookings.ListMineAsync(userId, scope == "upcoming", cancellationToken));
    }

    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType<MyAppointmentDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var customer = await users.GetUserAsync(User);
        if (customer is null)
        {
            return Results.Unauthorized();
        }

        var result = await bookings.CancelAsync(customer, id, cancellationToken);
        return result.Succeeded ? Results.Ok(result.Value) : result.ToProblem();
    }
}
