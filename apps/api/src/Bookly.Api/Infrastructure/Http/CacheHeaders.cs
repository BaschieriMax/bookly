namespace Bookly.Api.Infrastructure.Http;

/// <summary>
/// Overview §17: Vite bundles carry a content hash in /assets/, so they can be cached forever;
/// the HTML shell must always be revalidated so a deploy is picked up at once. MapStaticAssets
/// does not recognise Vite's hashes and would send "no-cache" for both.
/// </summary>
public static class CacheHeaders
{
    public const string Immutable = "public, max-age=31536000, immutable";

    public static IApplicationBuilder UseBooklyCacheHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var response = context.Response;
                if (response.StatusCode is StatusCodes.Status200OK or StatusCodes.Status304NotModified
                    && context.Request.Path.StartsWithSegments("/assets", StringComparison.Ordinal))
                {
                    response.Headers.CacheControl = Immutable;
                }
                else if (response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) == true)
                {
                    response.Headers.CacheControl = "no-cache";
                }

                return Task.CompletedTask;
            });
            await next();
        });
}
