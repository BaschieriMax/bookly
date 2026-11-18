using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.Data;

public sealed class DatabaseOptions
{
    /// <summary>ConnectionStrings:Default.</summary>
    [Required(ErrorMessage = "Connection string 'Default' is not configured.")]
    public string ConnectionString { get; set; } = string.Empty;
}
