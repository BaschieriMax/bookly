using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Platform;
using Bookly.Api.Entities;
using Bookly.Api.Services.Platform;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>Super-admin management of the businesses on the platform.</summary>
[ApiController]
[Route("api/platform/tenants")]
[Authorize(Policy = Policies.PlatformAdmin)]
[Produces("application/json")]
public sealed class PlatformTenantsController(TenantProvisioningService provisioning) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PlatformTenantDto>> List(CancellationToken cancellationToken) => provisioning.ListAsync(cancellationToken);

    /// <summary>Creates a tenant and invites its first owner.</summary>
    [HttpPost]
    [ProducesResponseType<PlatformTenantDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(CreateTenantRequest request, CancellationToken cancellationToken) =>
        (await provisioning.CreateAsync(request, cancellationToken)).ToResult();

    /// <summary>How many future confirmed appointments the tenant has: the number only, for the suspension dialog.</summary>
    [HttpGet("{id:guid}/future-appointments")]
    [ProducesResponseType<FutureAppointmentsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> FutureAppointments(Guid id, CancellationToken cancellationToken) =>
        (await provisioning.CountFutureAppointmentsAsync(id, cancellationToken)).ToResult();

    [HttpPut("{id:guid}/status")]
    [ProducesResponseType<PlatformTenantDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> SetStatus(Guid id, SetTenantStatusRequest request, CancellationToken cancellationToken) =>
        (await provisioning.SetStatusAsync(
            id, Enum.Parse<TenantStatus>(request.Status), request.CancelFutureAppointments, cancellationToken)).ToResult();

    /// <summary>Adds an owner (or re-sends a pending invitation).</summary>
    [HttpPost("{id:guid}/owners")]
    [ProducesResponseType<PlatformTenantDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> InviteOwner(Guid id, InviteOwnerRequest request, CancellationToken cancellationToken) =>
        (await provisioning.InviteOwnerAsync(id, request, cancellationToken)).ToResult();
}
