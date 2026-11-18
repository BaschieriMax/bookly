using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Auth;

internal static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddBooklyAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AuthOptions>().Bind(configuration.GetSection(AuthOptions.Section));
        services.AddOptions<EmailConfirmationTokenProviderOptions>();

        services
            .AddIdentityCore<AppUser>(options =>
            {
                // Length over composition rules (NIST SP 800-63B).
                options.Password.RequiredLength = 10;
                options.Password.RequiredUniqueChars = 4;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;

                options.User.RequireUniqueEmail = true;

                // Login is allowed before confirmation; booking requires a confirmed email (overview §10).
                options.SignIn.RequireConfirmedEmail = false;

                options.Tokens.EmailConfirmationTokenProvider = EmailConfirmationTokenProvider<AppUser>.ProviderName;
            })
            .AddRoles<AppRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddTokenProvider<EmailConfirmationTokenProvider<AppUser>>(EmailConfirmationTokenProvider<AppUser>.ProviderName);

        // Password reset tokens: 1 hour.
        services.Configure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromHours(1));

        // Revocation: the security stamp (changed on password reset / logout everywhere) is re-checked every 5 minutes.
        services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.FromMinutes(5));

        services
            .AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();

        services.AddOptions<Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationOptions>(IdentityConstants.ApplicationScheme)
            .Configure<IOptions<AuthOptions>>((cookie, auth) =>
            {
                cookie.Cookie.Name = auth.Value.CookieName;
                cookie.Cookie.HttpOnly = true;
                cookie.Cookie.SameSite = SameSiteMode.Lax;
                cookie.Cookie.SecurePolicy = auth.Value.RequireSecureCookies
                    ? CookieSecurePolicy.Always
                    : CookieSecurePolicy.SameAsRequest;
                cookie.Cookie.Path = "/";
                cookie.ExpireTimeSpan = TimeSpan.FromDays(14);
                cookie.SlidingExpiration = true;

                // An SPA needs status codes, never redirects to a login page.
                cookie.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                cookie.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        services.AddAuthorization();

        services.AddAntiforgery();
        services.AddOptions<AntiforgeryOptions>()
            .Configure<IOptions<AuthOptions>>((antiforgery, auth) =>
            {
                antiforgery.HeaderName = "X-XSRF-TOKEN";
                antiforgery.Cookie.Name = auth.Value.AntiforgeryCookieName;
                antiforgery.Cookie.HttpOnly = true;
                antiforgery.Cookie.SameSite = SameSiteMode.Strict;
                antiforgery.Cookie.SecurePolicy = auth.Value.RequireSecureCookies
                    ? CookieSecurePolicy.Always
                    : CookieSecurePolicy.SameAsRequest;
            });

        services.AddBooklyRateLimiting();

        return services;
    }

    /// <summary>Every unsafe controller action (POST/PUT/PATCH/DELETE) requires a valid antiforgery token.</summary>
    public static void AddGlobalAntiforgeryValidation(this MvcOptions options) =>
        options.Filters.Add<AntiforgeryValidationFilter>();
}
