using System.Reflection;

namespace Bookly.Api.Infrastructure;

internal static class BuildTime
{
    /// <summary>
    /// True when the app is started by the build-time OpenAPI generator (DEC-013). In that case
    /// runtime-only checks (connection string, SMTP settings) are skipped: no request is served.
    /// </summary>
    public static bool IsOpenApiGeneration { get; } =
        Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
}

internal static class OptionsBuilderExtensions
{
    /// <summary>ValidateOnStart, except during build-time OpenAPI generation.</summary>
    public static Microsoft.Extensions.Options.OptionsBuilder<T> ValidateOnStartUnlessBuildTime<T>(
        this Microsoft.Extensions.Options.OptionsBuilder<T> builder)
        where T : class =>
        BuildTime.IsOpenApiGeneration ? builder : builder.ValidateOnStart();
}
