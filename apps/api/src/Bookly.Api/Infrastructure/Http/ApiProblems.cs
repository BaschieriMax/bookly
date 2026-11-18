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
    public const string TenantNotFound = "tenant.not_found";
    public const string ServiceNotFound = "booking.service_not_found";
    public const string StaffNotFound = "booking.staff_not_found";
    public const string InvalidRange = "booking.invalid_range";
    public const string SlotUnavailable = "booking.slot_unavailable";
    public const string EmailNotConfirmed = "booking.email_not_confirmed";
    public const string AppointmentNotFound = "booking.appointment_not_found";
    public const string NotCancellable = "booking.not_cancellable";
    public const string CancellationWindowPassed = "booking.cancellation_window_passed";
    public const string ConcurrentUpdate = "booking.concurrent_update";
}
