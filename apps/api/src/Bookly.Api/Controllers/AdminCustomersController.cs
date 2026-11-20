using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>Customers of the current tenant, for entering appointments from the calendar (DEC-037).</summary>
[ApiController]
[Route("api/admin/customers")]
[Authorize(Policy = Policies.TenantMember)]
[Produces("application/json")]
public sealed class AdminCustomersController(CustomerDirectoryService directory) : ControllerBase
{
    /// <summary>Address-book entries and accounts that booked here, by name, email or phone (min 2 characters).</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CustomerSearchResultDto>>(StatusCodes.Status200OK)]
    public async Task<IReadOnlyList<CustomerSearchResultDto>> Search([FromQuery] string? q, CancellationToken cancellationToken) =>
        await directory.SearchAsync(q, cancellationToken);
}
