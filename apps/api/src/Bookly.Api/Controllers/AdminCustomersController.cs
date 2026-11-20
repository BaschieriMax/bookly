using System.ComponentModel.DataAnnotations;
using Bookly.Api.Auth.Policies;
using Bookly.Api.DTOs.Admin;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Bookly.Api.Controllers;

/// <summary>
/// Customers of the current tenant (DEC-037, DEC-038): search for the calendar (every member) and
/// the "Clienti" page (owners), where address-book entries are corrected, exported and erased.
/// </summary>
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

    /// <summary>The "Clienti" page: both kinds sorted by last name; kind = Account | AddressBook to filter.</summary>
    [HttpGet("list")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerListDto>(StatusCodes.Status200OK)]
    public async Task<CustomerListDto> List(
        [FromQuery] string? q,
        [FromQuery] string? kind,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default) =>
        await directory.ListAsync(q, kind, page, pageSize, cancellationToken);

    [HttpGet("address-book/{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> GetAddressBook(Guid id, CancellationToken cancellationToken) =>
        await directory.GetAddressBookAsync(id, cancellationToken) is { } customer
            ? Results.Ok(customer)
            : NotFoundProblem();

    /// <summary>An account that booked here (read-only); 404 for any other account.</summary>
    [HttpGet("account/{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> GetAccount(Guid id, CancellationToken cancellationToken) =>
        await directory.GetAccountAsync(id, cancellationToken) is { } customer
            ? Results.Ok(customer)
            : NotFoundProblem();

    /// <summary>Appointments of an address-book entry: when = upcoming (soonest first) | past (newest first).</summary>
    [HttpGet("address-book/{id:guid}/appointments")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerAppointmentPageDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public Task<IResult> AddressBookAppointments(
        Guid id,
        [FromQuery, RegularExpression(WhenPattern)] string when = CustomerDirectoryService.Past,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = CustomerDirectoryService.AppointmentPageSize,
        CancellationToken cancellationToken = default) =>
        AppointmentsAsync(CustomerDirectoryService.AddressBookKind, id, when, page, pageSize, cancellationToken);

    /// <summary>Appointments here of an account that booked here; 404 for any other account.</summary>
    [HttpGet("account/{id:guid}/appointments")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerAppointmentPageDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public Task<IResult> AccountAppointments(
        Guid id,
        [FromQuery, RegularExpression(WhenPattern)] string when = CustomerDirectoryService.Past,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = CustomerDirectoryService.AppointmentPageSize,
        CancellationToken cancellationToken = default) =>
        AppointmentsAsync(CustomerDirectoryService.AccountKind, id, when, page, pageSize, cancellationToken);

    [HttpPut("address-book/{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<CustomerDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> UpdateAddressBook(Guid id, UpdateCustomerRequest request, CancellationToken cancellationToken) =>
        (await directory.UpdateAddressBookAsync(id, request, cancellationToken)).ToResult();

    /// <summary>GDPR access request: the customer's data at this business as a JSON file.</summary>
    [HttpGet("address-book/{id:guid}/export")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> ExportAddressBook(Guid id, CancellationToken cancellationToken)
    {
        if (await directory.ExportAddressBookAsync(id, cancellationToken) is not { } export)
        {
            return NotFoundProblem();
        }

        Response.Headers.CacheControl = "no-store";
        return Results.File(export.Content, "application/json", export.FileName);
    }

    /// <summary>GDPR erasure: anonymises the entry and cancels its future appointments (no email).</summary>
    [HttpDelete("address-book/{id:guid}")]
    [Authorize(Policy = Policies.TenantOwner)]
    [ProducesResponseType<EraseCustomerResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IResult> EraseAddressBook(Guid id, CancellationToken cancellationToken) =>
        (await directory.EraseAddressBookAsync(id, cancellationToken)).ToResult();

    private const string WhenPattern = "^(upcoming|past)$";

    private async Task<IResult> AppointmentsAsync(
        string kind, Guid id, string when, int page, int pageSize, CancellationToken cancellationToken) =>
        await directory.AppointmentsAsync(kind, id, when, page, pageSize, cancellationToken) is { } appointments
            ? Results.Ok(appointments)
            : NotFoundProblem();

    private static IResult NotFoundProblem() =>
        ApiProblems.Create(StatusCodes.Status404NotFound, ErrorCodes.CustomerNotFound, "Customer not found.");
}
