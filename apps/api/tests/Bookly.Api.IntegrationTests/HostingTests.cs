using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Bookly.Api.IntegrationTests;

public sealed class HostingTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Health_endpoint_returns_200()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_api_route_returns_problem_details_404()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
