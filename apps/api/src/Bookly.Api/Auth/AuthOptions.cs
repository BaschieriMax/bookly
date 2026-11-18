namespace Bookly.Api.Auth;

/// <summary>Cookie names and rate limits (DEC-005). Defaults are the production values.</summary>
public sealed class AuthOptions
{
    public const string Section = "Auth";

    /// <summary>"__Host-" requires HTTPS; Development overrides it to work on http://localhost.</summary>
    public string CookieName { get; set; } = "__Host-bookly.auth";

    public string AntiforgeryCookieName { get; set; } = "__Host-bookly.af";

    /// <summary>JS-readable cookie with the antiforgery request token (Axios sends it back as X-XSRF-TOKEN).</summary>
    public string XsrfCookieName { get; set; } = "XSRF-TOKEN";

    public bool RequireSecureCookies { get; set; } = true;

    public int LoginPermitPerMinute { get; set; } = 5;

    public int PasswordResetPermitPer15Minutes { get; set; } = 3;
}
