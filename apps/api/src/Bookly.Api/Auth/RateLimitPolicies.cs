using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Auth;

internal static class RateLimitPolicies
{
    /// <summary>Login, registration, email confirmation resend.</summary>
    public const string Auth = "auth";

    /// <summary>Password reset requests.</summary>
    public const string PasswordReset = "password-reset";

    /// <summary>Anonymous public pages: tenant info, services, availability.</summary>
    public const string Public = "public";

    /// <summary>Creating appointments, per signed-in user.</summary>
    public const string Booking = "booking";

    public static IServiceCollection AddBooklyRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            limiter.AddPolicy(Auth, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(ClientKey(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = options.LoginPermitPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
            });

            limiter.AddPolicy(Public, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(ClientKey(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = options.PublicPermitPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
            });

            limiter.AddPolicy(Booking, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value;
                var user = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ClientKey(context);
                return RateLimitPartition.GetFixedWindowLimiter(user, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = options.BookingPermitPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
            });

            limiter.AddPolicy(PasswordReset, context =>
            {
                var options = context.RequestServices.GetRequiredService<IOptions<AuthOptions>>().Value;
                return RateLimitPartition.GetFixedWindowLimiter(ClientKey(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = options.PasswordResetPermitPer15Minutes,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0,
                });
            });
        });

        return services;
    }

    /// <summary>Client IP (after forwarded headers are applied behind the hosting proxy).</summary>
    private static string ClientKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
