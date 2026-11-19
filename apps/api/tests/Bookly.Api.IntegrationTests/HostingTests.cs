using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Bookly.Api.IntegrationTests.Infrastructure;

namespace Bookly.Api.IntegrationTests;

[Collection(DatabaseCollection.Name)]
public sealed class HostingTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database);

    [Fact]
    public async Task Liveness_returns_200()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Readiness_returns_200_when_database_is_reachable()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_api_route_returns_problem_details_404()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Version_reports_the_deployed_commit_without_caching()
    {
        using var factory = _factory.WithWebHostBuilder(builder =>
            builder.UseSetting("RENDER_GIT_COMMIT", "0123456789abcdef0123456789abcdef01234567"));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/version");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("0123456789abcdef0123456789abcdef01234567", body.RootElement.GetProperty("commit").GetString());
    }

    [Fact]
    public async Task Version_falls_back_to_dev_when_no_commit_is_configured()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/version");

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("dev", body.RootElement.GetProperty("commit").GetString());
    }

    public void Dispose() => _factory.Dispose();
}
