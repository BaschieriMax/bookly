using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.Infrastructure;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Public URL of the web app, used to build links in emails (no trailing slash).</summary>
    [Required, Url]
    public string PublicBaseUrl { get; set; } = string.Empty;
}
