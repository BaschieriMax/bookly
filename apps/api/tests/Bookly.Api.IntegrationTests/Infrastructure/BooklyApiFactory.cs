using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Runs the real API against the fixture database.</summary>
public sealed class BooklyApiFactory(PostgresFixture database) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", database.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
    }
}
