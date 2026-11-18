using Bookly.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Runs the real API against the fixture database, with production cookie settings and a fake mailbox.</summary>
public sealed class BooklyApiFactory(PostgresFixture database, int loginPermitPerMinute = 1000) : WebApplicationFactory<Program>
{
    public FakeEmailSender Emails { get; } = new();

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

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
        });
    }

    /// <summary>HTTPS client with its own cookie jar (auth cookies are Secure, like in production).</summary>
    public ApiSession CreateSession() => new(this);
}
