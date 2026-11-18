using Bookly.Api.Infrastructure.Http;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Bookly.Api.Auth;

/// <summary>
/// Validates the antiforgery token (X-XSRF-TOKEN header + antiforgery cookie) on every unsafe
/// controller request. Opt out per action with [RequireAntiforgeryToken(false)], e.g. for the
/// reminder job endpoint that authenticates with its own secret (DEC-005, DEC-012).
/// </summary>
internal sealed class AntiforgeryValidationFilter(IAntiforgery antiforgery) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method))
        {
            return;
        }

        var policy = context.ActionDescriptor.EndpointMetadata.OfType<IAntiforgeryMetadata>().LastOrDefault();
        if (policy is { RequiresValidation: false })
        {
            return;
        }

        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new Controllers.ResultActionResult(ApiProblems.Create(
                StatusCodes.Status400BadRequest, ErrorCodes.InvalidAntiforgery, "Missing or invalid antiforgery token."));
        }
    }
}
