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
    public const string NotFound = "admin.not_found";
    public const string InUse = "admin.in_use";
    public const string OverlappingHours = "admin.overlapping_hours";
    public const string InvalidTimeZone = "admin.invalid_time_zone";
    public const string InvalidLogo = "admin.invalid_logo";
    public const string StaffScope = "admin.staff_scope";
    public const string StaffUnavailable = "admin.staff_unavailable";
    public const string ServiceNotOffered = "admin.service_not_offered";
    public const string InvalidStatus = "admin.invalid_status";
    public const string NotStarted = "admin.not_started";
    public const string InPast = "admin.in_past";
    public const string OutsideWorkingHours = "admin.outside_working_hours";
    public const string CustomerRequired = "admin.customer_required";
    public const string CustomerNotFound = "admin.customer_not_found";
    public const string SlugTaken = "platform.slug_taken";
    public const string InvalidSlug = "platform.invalid_slug";
    public const string AlreadyOwner = "platform.already_owner";
    public const string CancelRequiresSuspension = "platform.cancel_requires_suspension";
    public const string OwnerOfTenant = "account.owner_of_tenant";
    public const string InvalidPassword = "account.invalid_password";
}
