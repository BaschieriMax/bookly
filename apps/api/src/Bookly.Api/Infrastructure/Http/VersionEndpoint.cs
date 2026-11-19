namespace Bookly.Api.Infrastructure.Http;

/// <summary>
/// DEC-032: the deploy workflow polls this endpoint until the running instance reports the commit
/// it just deployed, so the smoke checks never run against the previous version. Render sets
/// RENDER_GIT_COMMIT at runtime; App:Version is a fallback for other hosts. The repository is
/// public, so the commit SHA reveals nothing new.
/// </summary>
public static class VersionEndpoint
{
    public const string Unknown = "dev";

    public static IEndpointRouteBuilder MapBooklyVersion(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/version", (IConfiguration configuration, HttpContext context) =>
            {
                context.Response.Headers.CacheControl = "no-store";
                return Results.Ok(new VersionResponse(ResolveCommit(configuration)));
            })
            .AllowAnonymous()
            .ExcludeFromDescription();

        return endpoints;
    }

    internal static string ResolveCommit(IConfiguration configuration)
    {
        var commit = configuration["RENDER_GIT_COMMIT"];
        if (string.IsNullOrWhiteSpace(commit))
        {
            commit = configuration["App:Version"];
        }

        return string.IsNullOrWhiteSpace(commit) ? Unknown : commit.Trim();
    }

    public sealed record VersionResponse(string Commit);
}
