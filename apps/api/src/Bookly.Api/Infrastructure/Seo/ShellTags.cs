using Bookly.Api.DTOs.Public;

namespace Bookly.Api.Infrastructure.Seo;

/// <summary>
/// Tags of the SPA shell (apps/web/index.html) that tenant pages replace on the server
/// (DEC-031, DEC-043). The strings must match index.html exactly: IndexHtmlContractTests checks it.
/// </summary>
public static class ShellTags
{
    public const string Title = "<title>Turnora</title>";

    /// <summary>Home-screen icon on iOS: a full-bleed PNG, because iOS paints transparent pixels black.</summary>
    public const string AppleTouchIcon = "<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\" />";

    public const string Manifest = "<link rel=\"manifest\" href=\"/manifest.webmanifest\" />";

    /// <summary>Name proposed under the icon when a page is added to the iOS home screen.</summary>
    public const string AppTitle = "<meta name=\"apple-mobile-web-app-title\" content=\"Turnora\" />";

    /// <summary>Turnora icons in public/, used when a tenant has no home-screen icon of its own.</summary>
    public static readonly IReadOnlyList<WebAppManifestIconDto> DefaultIcons =
    [
        new("/icon-192.png", "192x192", "image/png", null),
        new("/icon-512.png", "512x512", "image/png", null),
        new("/icon-512.png", "512x512", "image/png", "maskable"),
    ];

    public static string TenantPath(string slug) => $"/b/{Uri.EscapeDataString(slug)}";

    public static string TenantIconUrl(string slug) => $"/api/public/tenants/{Uri.EscapeDataString(slug)}/icon";

    public static string TenantManifestUrl(string slug) => $"/api/public/tenants/{Uri.EscapeDataString(slug)}/manifest.webmanifest";
}
