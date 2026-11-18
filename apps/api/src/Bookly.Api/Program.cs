using System.Text.Json.Serialization;
using Bookly.Api.Auth;
using Bookly.Api.Data;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Services;
using Bookly.Api.Services.Admin;
using Bookly.Api.Services.Availability;
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

// Client-side routes (/admin, /b/{slug}, ...) are served by the SPA.
app.MapFallbackToFile("index.html");

await app.RunAsync();

/// <summary>Entry point, public for WebApplicationFactory in integration tests.</summary>
public partial class Program;
