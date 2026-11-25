using System.Net;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure.Seo;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bookly.Api.IntegrationTests;

/// <summary>Step 13: security headers on every response and server-side meta tags for tenant pages.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class HardeningTests(PostgresFixture database) : IDisposable
{
    private const string Shell = """
        <!doctype html>
        <html lang="it">
          <head>
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            <link rel="manifest" href="/manifest.webmanifest" />
            <meta name="apple-mobile-web-app-title" content="Turnora" />
            <title>Turnora</title>
            <script type="module" src="/assets/index.js"></script>
          </head>
          <body><div id="root"></div></body>
        </html>
        """;

    private readonly BooklyApiFactory _factory = new(database);

    private sealed class FakeIndexHtml : IIndexHtmlProvider
    {
        public Task<string?> GetAsync(CancellationToken cancellationToken) => Task.FromResult<string?>(Shell);
    }

    private HttpClient ClientWithShell() =>
        _factory.WithWebHostBuilder(b => b.ConfigureTestServices(services =>
        {
            services.RemoveAll<IIndexHtmlProvider>();
            services.AddSingleton<IIndexHtmlProvider, FakeIndexHtml>();
        })).CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    [Fact]
    public async Task Every_response_carries_the_security_headers()
    {
        using var client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        foreach (var path in new[] { "/api/health", "/api/does-not-exist", "/api/auth/me" })
        {
            using var response = await client.GetAsync(path);
            var csp = Assert.Single(response.Headers.GetValues("Content-Security-Policy"));
            Assert.Contains("script-src 'self'", csp, StringComparison.Ordinal);
            Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
            Assert.DoesNotContain("unsafe-eval", csp, StringComparison.Ordinal);
            Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
            Assert.Equal("DENY", Assert.Single(response.Headers.GetValues("X-Frame-Options")));
            Assert.Equal("strict-origin-when-cross-origin", Assert.Single(response.Headers.GetValues("Referrer-Policy")));
            Assert.Contains("camera=()", Assert.Single(response.Headers.GetValues("Permissions-Policy")), StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Tenant_pages_get_their_own_title_and_open_graph_tags()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == tenant.Id).ExecuteUpdateAsync(t => t
            .SetProperty(x => x.Name, "Barber & <Co>")
            .SetProperty(x => x.Address, "Via Emilia 1, Modena"));
        db.TenantLogos.Add(new TenantLogo { TenantId = tenant.Id, ContentType = "image/png", Data = [0x89, 0x50], UpdatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        using var client = ClientWithShell();

        using var response = await client.GetAsync($"/b/{tenant.Slug}/prenota");
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("<title>Barber &amp; &lt;Co&gt; · Prenota online</title>", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<Co>", html, StringComparison.Ordinal);
        Assert.Contains("<meta property=\"og:title\" content=\"Barber &amp; &lt;Co&gt;\" />", html, StringComparison.Ordinal);
        Assert.Contains("Via Emilia 1, Modena", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"canonical\" href=\"https://app.bookly.test/b/{tenant.Slug}\" />", html, StringComparison.Ordinal);
        Assert.Contains($"content=\"https://app.bookly.test/api/public/tenants/{tenant.Slug}/logo\"", html, StringComparison.Ordinal);
        // DEC-043: home screen. The logo has no icon yet, so the Turnora icon stays.
        Assert.Contains("<meta name=\"apple-mobile-web-app-title\" content=\"Barber &amp; &lt;Co&gt;\" />", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"manifest\" href=\"/api/public/tenants/{tenant.Slug}/manifest.webmanifest\" />", html, StringComparison.Ordinal);
        Assert.Contains("<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\" />", html, StringComparison.Ordinal);
        Assert.Contains("<script type=\"module\" src=\"/assets/index.js\"></script>", html, StringComparison.Ordinal);
        Assert.Contains("Content-Security-Policy", response.Headers.Select(h => h.Key));
    }

    [Fact]
    public async Task Tenant_pages_point_the_home_screen_icon_to_the_business_icon()
    {
        await using var db = database.CreateDbContext();
        var tenant = await TestData.AddTenantAsync(db);
        db.TenantLogos.Add(new TenantLogo { TenantId = tenant.Id, ContentType = "image/png", Data = [0x89, 0x50], IconData = [0x89, 0x50], UpdatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        using var client = ClientWithShell();

        var html = await client.GetStringAsync($"/b/{tenant.Slug}");

        Assert.Contains($"<link rel=\"apple-touch-icon\" href=\"/api/public/tenants/{tenant.Slug}/icon\" />", html, StringComparison.Ordinal);
        Assert.DoesNotContain("/apple-touch-icon.png", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Unknown_or_suspended_tenants_are_404_and_not_indexed()
    {
        await using var db = database.CreateDbContext();
        var suspended = await TestData.AddTenantAsync(db);
        await db.Tenants.Where(t => t.Id == suspended.Id).ExecuteUpdateAsync(t => t.SetProperty(x => x.Status, TenantStatus.Suspended));
        using var client = ClientWithShell();

        foreach (var slug in new[] { "non-esiste", suspended.Slug })
        {
            using var response = await client.GetAsync($"/b/{slug}");
            var html = await response.Content.ReadAsStringAsync();
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Contains("<meta name=\"robots\" content=\"noindex\" />", html, StringComparison.Ordinal);
            Assert.Contains("<div id=\"root\"></div>", html, StringComparison.Ordinal);
        }
    }

    public void Dispose() => _factory.Dispose();
}
