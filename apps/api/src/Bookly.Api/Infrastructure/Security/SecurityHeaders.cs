namespace Bookly.Api.Infrastructure.Security;

public sealed class SecurityOptions
{
    public const string Section = "Security";

    /// <summary>
    /// Extra origins the browser may call (CSP connect-src), e.g. the Sentry ingest origin
    /// "https://o123.ingest.de.sentry.io". Everything else stays same-origin (DEC-010).
    /// </summary>
    public string[] ExtraConnectSources { get; set; } = [];
}

/// <summary>
/// Security headers on every response (overview §OWASP A02, DEC-031). The SPA is served from the
/// same origin with no inline scripts, so scripts are limited to 'self'. Inline styles are allowed:
/// the tenant theme sets CSS variables in style attributes and the toast library injects a style
/// element; neither can execute code.
/// </summary>
public static class SecurityHeaders
{
    public static string BuildContentSecurityPolicy(SecurityOptions options, bool upgradeInsecureRequests)
    {
        var extra = options.ExtraConnectSources.Where(IsOrigin).Select(v => new Uri(v).GetLeftPart(UriPartial.Authority));
        var connect = string.Join(' ', new[] { "'self'" }.Concat(extra));
        var directives = new List<string>
        {
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            $"connect-src {connect}",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "manifest-src 'self'",
        };
        if (upgradeInsecureRequests)
        {
            directives.Add("upgrade-insecure-requests");
        }

        return string.Join("; ", directives);
    }

    public static IApplicationBuilder UseBooklySecurityHeaders(this IApplicationBuilder app, SecurityOptions options, bool isDevelopment)
    {
        var csp = BuildContentSecurityPolicy(options, upgradeInsecureRequests: !isDevelopment);
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.ContentSecurityPolicy = csp;
                headers.XContentTypeOptions = "nosniff";
                headers.XFrameOptions = "DENY";
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()";
                headers["Cross-Origin-Opener-Policy"] = "same-origin";
                headers["Cross-Origin-Resource-Policy"] = "same-origin";
                return Task.CompletedTask;
            });
            await next();
        });
    }

    /// <summary>Only plain https origins are accepted from configuration (no wildcards or paths).</summary>
    private static bool IsOrigin(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.AbsolutePath == "/"
        && !value.Contains('*', StringComparison.Ordinal)
        && !value.Contains(';', StringComparison.Ordinal);
}
