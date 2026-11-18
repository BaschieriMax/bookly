using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>Services of the current tenant. Staff can read, only the owner can change.</summary>
[ApiController]
[Route("api/admin/services")]
[Authorize(Policy = Policies.TenantMember)]
[Produces("application/json")]
public sealed class AdminServicesController(CatalogService catalog) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<AdminServiceDto>> List(CancellationToken cancellationToken) => catalog.ListServicesAsync(cancellationToken);

    [HttpPost]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<AdminServiceDto>(StatusCodes.Status201Created)]
    public async Task<IResult> Create(SaveServiceRequest request, CancellationToken cancellationToken) =>
        Results.Json(await catalog.CreateServiceAsync(request, cancellationToken), statusCode: StatusCodes.Status201Created);

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<AdminServiceDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> Update(Guid id, SaveServiceRequest request, CancellationToken cancellationToken) =>
        (await catalog.UpdateServiceAsync(id, request, cancellationToken)).ToResult();

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken) =>
        (await catalog.DeleteServiceAsync(id, cancellationToken)).ToResult();
}
