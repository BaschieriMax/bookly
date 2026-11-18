using Bookly.Api.Data;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

/// <summary>DEC-006: tenant-owned rows are only visible to their own tenant.</summary>
[Collection(DatabaseCollection.Name)]
public sealed class TenantIsolationTests(PostgresFixture database)
{
    [Fact]
    public async Task Tenant_only_sees_its_own_services()
    {
        Guid tenantA, tenantB;
        await using (var setup = database.CreateDbContext())
        {
            tenantA = (await TestData.AddTenantAsync(setup)).Id;
            tenantB = (await TestData.AddTenantAsync(setup)).Id;
            await TestData.AddServiceAsync(setup, tenantA, "Servizio A");
            await TestData.AddServiceAsync(setup, tenantB, "Servizio B");
        }

        await using var db = database.CreateDbContext(tenantA);
        var names = await db.Services.Select(s => s.Name).ToListAsync();

        Assert.Equal(["Servizio A"], names);
    }

    [Fact]
    public async Task Without_a_tenant_no_tenant_owned_rows_are_visible()
    {
        await using (var setup = database.CreateDbContext())
        {
            var tenant = await TestData.AddTenantAsync(setup);
            await TestData.AddStaffAsync(setup, tenant.Id);
        }

        await using var db = database.CreateDbContext(tenantId: null);

        Assert.Empty(await db.StaffMembers.ToListAsync());
    }

    [Fact]
    public async Task Platform_queries_must_opt_out_of_the_tenant_filter_explicitly()
    {
        Guid tenantId;
        await using (var setup = database.CreateDbContext())
        {
            tenantId = (await TestData.AddTenantAsync(setup)).Id;
            await TestData.AddStaffAsync(setup, tenantId);
        }

        await using var db = database.CreateDbContext(tenantId: null);
        var count = await db.StaffMembers
            .IgnoreQueryFilters([AppDbContext.TenantFilter])
            .CountAsync(s => s.TenantId == tenantId);

        Assert.Equal(1, count);
    }
}
