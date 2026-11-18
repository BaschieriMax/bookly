using System.Net;
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

    public void Dispose() => _factory.Dispose();
}
