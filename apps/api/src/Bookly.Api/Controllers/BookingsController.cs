using Bookly.Api.Auth;
using Bookly.Api.DTOs.Booking;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Booking;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Bookly.Api.Controllers;

/// <summary>Customer bookings on a tenant (/b/{slug}).</summary>
[ApiController]
[Route("api/tenants/{slug}/appointments")]
[Authorize]
[Produces("application/json")]
public sealed class BookingsController(
    PublicTenantResolver tenants,
    UserManager<AppUser> users,
    BookingService bookings) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Booking)]
    [ProducesResponseType<MyAppointmentDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(string slug, CreateAppointmentRequest request, CancellationToken cancellationToken)
    {
        var tenant = await tenants.ResolveAsync(slug, cancellationToken);
        if (tenant is null)
        {
            return ApiProblems.Create(StatusCodes.Status404NotFound, ErrorCodes.TenantNotFound, "Business not found.");
        }

        var customer = await users.GetUserAsync(User);
        if (customer is null)
        {
            return Results.Unauthorized();
        }

        var result = await bookings.BookAsync(tenant, customer, request, cancellationToken);
        return result.Succeeded
            ? Results.Created($"/api/me/appointments/{result.Value!.Id}", result.Value)
            : result.ToProblem();
    }
}
