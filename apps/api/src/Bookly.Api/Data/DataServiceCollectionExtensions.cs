using Bookly.Api.Tenancy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.Data;

internal static class DataServiceCollectionExtensions
{
    public static IServiceCollection AddBooklyData(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(
            connectionString,
            npgsql => npgsql.EnableRetryOnFailure(maxRetryCount: 3)));

        // Keys survive container restarts: auth cookies and antiforgery tokens stay valid (DEC-005).
        services.AddDataProtection()
            .SetApplicationName("Bookly")
            .PersistKeysToDbContext<AppDbContext>();

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>("database", tags: ["ready"]);

        return services;
    }
}
