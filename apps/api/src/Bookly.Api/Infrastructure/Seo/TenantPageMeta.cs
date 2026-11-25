using System.Text.Encodings.Web;
using Bookly.Api.Data;
using Bookly.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Infrastructure.Seo;

/// <summary>The SPA shell (index.html), read once from wwwroot. Replaceable in tests.</summary>
public interface IIndexHtmlProvider
{
    Task<string?> GetAsync(CancellationToken cancellationToken);
}

public sealed class WebRootIndexHtmlProvider(IWebHostEnvironment environment) : IIndexHtmlProvider
{
    private string? _cached;

    public async Task<string?> GetAsync(CancellationToken cancellationToken)
    {
        if (_cached is not null)
        {
            return _cached;
        }

        IFileInfo file = environment.WebRootFileProvider.GetFileInfo("index.html");
        if (!file.Exists)
        {
            return null;
        }

        await using var stream = file.CreateReadStream();
        using var reader = new StreamReader(stream);
        _cached = await reader.ReadToEndAsync(cancellationToken);
        return _cached;
    }
}

/// <summary>
/// Q4 / DEC-031: the public page of a tenant (/b/{slug}/...) is served with its own title,
/// description and Open Graph tags, so shared links show a preview and search engines index the
/// business name. DEC-043: adding the page to the home screen shows the business name and its
/// icon (Turnora's when it has none). Everything else in the shell is unchanged; the SPA takes over
/// in the browser (useHomeScreenMeta keeps the same tags on client-side navigation).
/// </summary>
public static class TenantPageMeta
{
    /// <summary>Encodes markup characters (&lt; &gt; &amp; quotes) but keeps accented letters readable.</summary>
    private static readonly HtmlEncoder Encoder = HtmlEncoder.Create(System.Text.Unicode.UnicodeRanges.All);

    public static IEndpointRouteBuilder MapTenantPageMeta(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/b/{slug}/{**rest}", ServeAsync).ExcludeFromDescription();
        return endpoints;
    }

    private static async Task<IResult> ServeAsync(
        string slug,
        HttpContext context,
        IIndexHtmlProvider indexHtml,
        AppDbContext db,
        IOptions<AppOptions> appOptions,
        CancellationToken cancellationToken)
    {
        var html = await indexHtml.GetAsync(cancellationToken);
        if (html is null)
        {
            return Results.NotFound(); // no built SPA (development with Vite, tests)
        }

        var tenant = await db.Tenants.AsNoTracking()
            .Where(t => t.Slug == slug && t.Status == TenantStatus.Active)
            .Select(t => new { t.Slug, t.Name, t.Address, HasLogo = t.Logo != null, HasIcon = t.Logo != null && t.Logo.IconData != null })
            .SingleOrDefaultAsync(cancellationToken);

        context.Response.Headers.CacheControl = "no-cache";
        if (tenant is null)
        {
            // Unknown or suspended: the SPA shows its "not found" page; crawlers get a real 404.
            var notFound = html.Replace(ShellTags.Title, $"{ShellTags.Title}\n    <meta name=\"robots\" content=\"noindex\" />", StringComparison.Ordinal);
            return Results.Content(notFound, "text/html; charset=utf-8", statusCode: StatusCodes.Status404NotFound);
        }

        var baseUrl = appOptions.Value.PublicBaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/b/{Uri.EscapeDataString(tenant.Slug)}";
        var title = $"{tenant.Name} · Prenota online";
        var description = tenant.Address is null
            ? $"Prenota online da {tenant.Name}: scegli servizio, operatore e orario in pochi secondi."
            : $"Prenota online da {tenant.Name}, {tenant.Address}: scegli servizio, operatore e orario in pochi secondi.";
        var encoder = Encoder;

        var tags = new List<string>
        {
            $"<title>{encoder.Encode(title)}</title>",
            $"<meta name=\"description\" content=\"{encoder.Encode(description)}\" />",
            $"<link rel=\"canonical\" href=\"{encoder.Encode(url)}\" />",
            "<meta property=\"og:type\" content=\"website\" />",
            "<meta property=\"og:locale\" content=\"it_IT\" />",
            "<meta property=\"og:site_name\" content=\"Turnora\" />",
            $"<meta property=\"og:title\" content=\"{encoder.Encode(tenant.Name)}\" />",
            $"<meta property=\"og:description\" content=\"{encoder.Encode(description)}\" />",
            $"<meta property=\"og:url\" content=\"{encoder.Encode(url)}\" />",
            "<meta name=\"twitter:card\" content=\"summary\" />",
        };
        if (tenant.HasLogo)
        {
            tags.Add($"<meta property=\"og:image\" content=\"{encoder.Encode($"{baseUrl}/api/public/tenants/{Uri.EscapeDataString(tenant.Slug)}/logo")}\" />");
        }

        var page = html
            .Replace(ShellTags.Title, string.Join("\n    ", tags), StringComparison.Ordinal)
            .Replace(ShellTags.AppTitle, $"<meta name=\"apple-mobile-web-app-title\" content=\"{encoder.Encode(tenant.Name)}\" />", StringComparison.Ordinal)
            .Replace(ShellTags.Manifest, $"<link rel=\"manifest\" href=\"{encoder.Encode(ShellTags.TenantManifestUrl(tenant.Slug))}\" />", StringComparison.Ordinal);
        if (tenant.HasIcon)
        {
            page = page.Replace(ShellTags.AppleTouchIcon, $"<link rel=\"apple-touch-icon\" href=\"{encoder.Encode(ShellTags.TenantIconUrl(tenant.Slug))}\" />", StringComparison.Ordinal);
        }

        return Results.Content(page, "text/html; charset=utf-8");
    }
}
