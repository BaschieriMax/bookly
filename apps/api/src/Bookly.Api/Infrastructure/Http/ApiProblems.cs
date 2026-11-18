namespace Bookly.Api.Infrastructure.Http;

/// <summary>
/// ProblemDetails with a stable machine-readable "code" that the client translates (i18n, DEC-015).
/// </summary>
internal static class ApiProblems
{
    public static IResult Create(int status, string code, string title) =>
        Results.Problem(statusCode: status, title: title, extensions: new Dictionary<string, object?> { ["code"] = code });
}

internal static class ErrorCodes
{
    public const string InvalidCredentials = "auth.invalid_credentials";
    public const string InvalidToken = "auth.invalid_token";
    public const string InvalidAntiforgery = "auth.invalid_antiforgery";
    public const string ValidationFailed = "validation.failed";
}
