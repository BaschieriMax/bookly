using Bookly.Api.Entities;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>DEC-019: the migration seeds the server-driven sidebar.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class NavigationSeedTests(PostgresFixture database)
{
    [Theory]
    [InlineData(NavigationArea.Admin, "Owner", new[] { "/admin", "/admin/clienti", "/admin/servizi", "/admin/staff", "/admin/orari", "/admin/brand", "/admin/impostazioni" })]
    [InlineData(NavigationArea.Admin, "Staff", new[] { "/admin", "/admin/orari" })]
    [InlineData(NavigationArea.Platform, "SuperAdmin", new[] { "/platform/tenant", "/platform/navigazione" })]
    public async Task Seeded_items_per_role_are_ordered(NavigationArea area, string role, string[] expectedRoutes)
    {
        await using var db = database.CreateDbContext();

        var routes = await db.NavigationItems
            .Where(n => n.Area == area && n.IsEnabled && n.Roles.Any(r => r.Role == role))
            .OrderBy(n => n.SortOrder)
            .Select(n => n.Route)
            .ToListAsync();

        Assert.Equal(expectedRoutes, routes);
    }
}
