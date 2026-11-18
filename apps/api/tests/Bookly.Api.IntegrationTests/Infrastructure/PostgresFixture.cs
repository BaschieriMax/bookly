using Bookly.Api.Data;
using Bookly.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>
/// Real PostgreSQL for integration tests (DEC-014). Uses Testcontainers by default; set
/// BOOKLY_TEST_POSTGRES to an existing server connection string to skip Docker locally.
/// Each fixture creates its own throw-away database and applies the migrations.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private const string ExternalServerVariable = "BOOKLY_TEST_POSTGRES";

    private PostgreSqlContainer? _container;
    private string _serverConnectionString = string.Empty;
    private readonly string _databaseName = $"bookly_test_{Guid.NewGuid():N}";

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable(ExternalServerVariable);
        if (string.IsNullOrWhiteSpace(external))
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _container.StartAsync();
            _serverConnectionString = _container.GetConnectionString();
        }
        else
        {
            _serverConnectionString = external;
        }

        await using (var connection = new NpgsqlConnection(_serverConnectionString))
        {
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", connection);
            await command.ExecuteNonQueryAsync();
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(_serverConnectionString)
        {
            Database = _databaseName,
        }.ConnectionString;

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    /// <summary>Creates a context scoped to <paramref name="tenantId"/> (null = no tenant).</summary>
    public AppDbContext CreateDbContext(Guid? tenantId = null)
    {
        var tenantContext = new TenantContext();
        if (tenantId is { } id)
        {
            tenantContext.SetTenant(id);
        }

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        return new AppDbContext(options, tenantContext);
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();

        if (_container is not null)
        {
            await _container.DisposeAsync();
            return;
        }

        await using var connection = new NpgsqlConnection(_serverConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class DatabaseCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Database";
}
