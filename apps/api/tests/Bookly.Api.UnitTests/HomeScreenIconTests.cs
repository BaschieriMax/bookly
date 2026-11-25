using Bookly.Api.Infrastructure.Seo;
using Bookly.Api.Services.Admin;

namespace Bookly.Api.UnitTests;

/// <summary>DEC-043: home-screen icon checks and the shell tags the server replaces.</summary>
public sealed class HomeScreenIconTests
{
    [Fact]
    public void Icon_must_be_a_png_of_the_expected_size()
    {
        Assert.True(TenantSettingsService.IsPngOfSize(Png(256, 256), 256));
        Assert.False(TenantSettingsService.IsPngOfSize(Png(256, 255), 256));
        Assert.False(TenantSettingsService.IsPngOfSize(Png(512, 512), 256));
        Assert.False(TenantSettingsService.IsPngOfSize(Png(256, 256)[..20], 256));

        var notPng = Png(256, 256);
        notPng[1] = (byte)'X';
        Assert.False(TenantSettingsService.IsPngOfSize(notPng, 256));

        var noHeader = Png(256, 256);
        "IDAT"u8.CopyTo(noHeader.AsSpan(12));
        Assert.False(TenantSettingsService.IsPngOfSize(noHeader, 256));
    }

    /// <summary>
    /// TenantPageMeta replaces these tags by exact match: if index.html changes them, tenant pages
    /// would silently keep Turnora's title, icon and manifest.
    /// </summary>
    [Fact]
    public void Index_html_contains_the_tags_tenant_pages_replace()
    {
        var html = File.ReadAllText(FindIndexHtml());

        Assert.Contains(ShellTags.Title, html, StringComparison.Ordinal);
        Assert.Contains(ShellTags.AppleTouchIcon, html, StringComparison.Ordinal);
        Assert.Contains(ShellTags.Manifest, html, StringComparison.Ordinal);
        Assert.Contains(ShellTags.AppTitle, html, StringComparison.Ordinal);
    }

    internal static byte[] Png(uint width, uint height)
    {
        var bytes = new byte[33];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13 }.CopyTo(bytes, 0);
        "IHDR"u8.CopyTo(bytes.AsSpan(12));
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(16), width);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(20), height);
        return bytes;
    }

    private static string FindIndexHtml()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "apps", "web", "index.html");
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("apps/web/index.html not found above the test directory.");
    }
}
