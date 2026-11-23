using Bookly.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Runs the real API against the fixture database, with production cookie settings and a fake mailbox.</summary>
/// <param name="settings">Extra configuration, applied last (e.g. "SuspensionNotices:DailyLimit").</param>
public sealed class BooklyApiFactory(
    PostgresFixture database,
    int loginPermitPerMinute = 1000,
    IReadOnlyDictionary<string, string>? settings = null) : WebApplicationFactory<Program>
{
    public const string JobSecret = "test-job-secret-0123456789abcdef0123";

    public FakeEmailSender Emails { get; } = new();

    /// <summary>Controllable clock. Default: Monday 1 March 2027, 08:00 in Rome.</summary>
    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2027, 3, 1, 7, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", database.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("App:PublicBaseUrl", "https://app.bookly.test");
        builder.UseSetting("Email:Host", "smtp.invalid");
        builder.UseSetting("Email:From", "Bookly <no-reply@bookly.test>");
        builder.UseSetting("Auth:LoginPermitPerMinute", loginPermitPerMinute.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.UseSetting("Auth:PasswordResetPermitPer15Minutes", "1000");
        builder.UseSetting("Auth:PublicPermitPerMinute", "100000");
        builder.UseSetting("Auth:BookingPermitPerMinute", "100000");
        builder.UseSetting("Jobs:Secret", JobSecret);
        // Suspension notices are sent only when a test calls the job: no background worker, no pauses.
        builder.UseSetting("SuspensionNotices:RunInBackground", "false");
        builder.UseSetting("SuspensionNotices:SendIntervalMilliseconds", "0");
        foreach (var (key, value) in settings ?? new Dictionary<string, string>())
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    /// <summary>HTTPS client with its own cookie jar (auth cookies are Secure, like in production).</summary>
    public ApiSession CreateSession() => new(this);
}
