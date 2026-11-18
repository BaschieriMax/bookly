using Bookly.Api.Infrastructure;
using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Data;

internal static class DataServiceCollectionExtensions
{
    public static IServiceCollection AddBooklyData(this IServiceCollection services, IConfiguration configuration)
    {
        // Validated when the host starts (not at registration), so build-time tools such as the
        // OpenAPI document generator can build the service collection without a database.
        services.AddOptions<DatabaseOptions>()
            .Configure(o => o.ConnectionString = configuration.GetConnectionString("Default") ?? string.Empty)
            .ValidateDataAnnotations()
            .ValidateOnStartUnlessBuildTime();
        var connectionString = configuration.GetConnectionString("Default") ?? string.Empty;

        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3)));

        // Keys survive container restarts: auth cookies and antiforgery tokens stay valid (DEC-005).
        var dataProtection = services.AddDataProtection().SetApplicationName("Bookly");
        if (!BuildTime.IsOpenApiGeneration)
        {
            dataProtection.PersistKeysToDbContext<AppDbContext>();
        }

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>("database", tags: ["ready"]);

        return services;
    }
}
