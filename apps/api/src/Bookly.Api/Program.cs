using Microsoft.Extensions.Options;
using System.Text.Json.Serialization;
using Bookly.Api.Auth;
using Bookly.Api.Data;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Services;
using Bookly.Api.Infrastructure.Http;
using Bookly.Api.Infrastructure.Monitoring;
using Bookly.Api.Infrastructure.Security;
using Bookly.Api.Infrastructure.Seo;
using Bookly.Api.Services.Account;
using Bookly.Api.Services.Admin;
using Bookly.Api.Services.Availability;
using Bookly.Api.Services.Jobs;
using Bookly.Api.Services.Platform;
using Bookly.Api.Services.Booking;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddOptions<AppOptions>()
    .Bind(builder.Configuration.GetSection(AppOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStartUnlessBuildTime();
builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStartUnlessBuildTime();
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();

// Strict numbers: no "123" strings accepted for numbers, and the OpenAPI schema stays "integer" (DEC-013).
builder.Services.AddControllers(options => options.AddGlobalAntiforgeryValidation())
    .AddJsonOptions(options => options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict);
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddBooklyData(builder.Configuration);
builder.Services.AddBooklyAuth(builder.Configuration);
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<PublicTenantResolver>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddScoped<AdminContext>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddScoped<ScheduleService>();
builder.Services.AddScoped<TenantSettingsService>();
builder.Services.AddScoped<CalendarService>();
builder.Services.AddScoped<TenantProvisioningService>();
builder.Services.AddScoped<ReminderService>();
builder.Services.AddScoped<RetentionService>();
builder.Services.AddScoped<PrivacyService>();
builder.Services.AddSingleton<IIndexHtmlProvider, WebRootIndexHtmlProvider>();
builder.Services.AddOptions<SecurityOptions>().Bind(builder.Configuration.GetSection(SecurityOptions.Section));
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});

// Error tracking (overview §20, DEC-031): only when a DSN is configured; no personal data sent.
if (!string.IsNullOrWhiteSpace(builder.Configuration["Sentry:Dsn"]))
{
    builder.WebHost.UseSentry(options =>
    {
        options.SendDefaultPii = false;
        options.MaxRequestBodySize = Sentry.Extensibility.RequestSize.None;
        options.TracesSampleRate = 0;
        options.SetBeforeSend(MonitoringScrubber.Scrub);
    });
}
builder.Services.AddOptions<JobsOptions>()
    .Bind(builder.Configuration.GetSection(JobsOptions.Section))
    .Validate(o => o.Secret.Length is 0 or >= 32, "Jobs:Secret must be empty (disabled) or at least 32 characters.")
    .ValidateOnStartUnlessBuildTime();
builder.Services.AddOptions<PlatformOptions>().Bind(builder.Configuration.GetSection(PlatformOptions.Section));

// Behind the hosting proxy (Render): trust only the last hop, so clients cannot spoof their IP
// to dodge rate limits. Enabled with ReverseProxy__Enabled=true in production.
var behindProxy = builder.Configuration.GetValue<bool>("ReverseProxy:Enabled");
if (behindProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

var app = builder.Build();

if (behindProxy)
{
    app.UseForwardedHeaders();
}
else if (!app.Environment.IsDevelopment() && !BuildTime.IsOpenApiGeneration)
{
    // Behind a TLS-terminating proxy (Render) requests look like plain HTTP without this, and the
    // Secure-only auth/antiforgery cookies fail: see the deploy checklist in README (QA finding F4).
    app.Logger.LogWarning("ReverseProxy:Enabled is false outside Development: cookies require HTTPS as seen by the app");
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

// Local convenience only: production applies migrations with a migration bundle before the deploy (overview §23).
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();

    if (app.Environment.IsDevelopment() && app.Configuration.GetValue<bool>("Database:SeedDemoData"))
    {
        var password = app.Configuration["Database:DemoPassword"]
            ?? throw new InvalidOperationException("Database:DemoPassword is required to seed demo data.");
        await DemoDataSeeder.SeedAsync(scope.ServiceProvider, password);
    }
}

if (!BuildTime.IsOpenApiGeneration)
{
    await using var scope = app.Services.CreateAsyncScope();
    await SuperAdminBootstrapper.RunAsync(
        scope.ServiceProvider,
        app.Services.GetRequiredService<IOptions<PlatformOptions>>().Value,
        app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(SuperAdminBootstrapper)));
}

app.UseBooklySecurityHeaders(
    app.Services.GetRequiredService<IOptions<SecurityOptions>>().Value,
    app.Environment.IsDevelopment());

app.UseBooklyCacheHeaders();

app.UseStatusCodePages();

// The React build is copied into wwwroot at image build time (DEC-010).
app.MapStaticAssets();

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Liveness: the process is up (used by the hosting platform). Readiness: the database answers.
app.MapHealthChecks("/api/health", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/api/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

app.MapControllers();

// Unknown API routes must return a JSON 404, never the SPA shell.
app.MapFallback("/api/{**rest}", () => Results.Problem(
    statusCode: StatusCodes.Status404NotFound,
    title: "Not Found"));

// Public tenant pages get their own title and Open Graph tags (Q4, DEC-031).
app.MapTenantPageMeta();

// Client-side routes (/admin, /b/{slug}, ...) are served by the SPA.
app.MapFallbackToFile("index.html");

await app.RunAsync();

/// <summary>Entry point, public for WebApplicationFactory in integration tests.</summary>
public partial class Program;
