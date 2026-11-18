using System.ComponentModel.DataAnnotations;

namespace Bookly.Api.Infrastructure.Email;

/// <summary>
/// SMTP settings. Development: Mailpit (localhost:1025, no TLS). Production: Resend SMTP
/// (smtp.resend.com, port 465, user "resend", password = API key) — DEC-022.
/// </summary>
public sealed class EmailOptions
{
    public const string Section = "Email";

    [Required]
    public string Host { get; set; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; set; } = 1025;

    /// <summary>None (Mailpit), SslOnConnect (port 465) or StartTls (port 587).</summary>
    public SmtpSecurity Security { get; set; } = SmtpSecurity.None;

    public string? Username { get; set; }

    public string? Password { get; set; }

    /// <summary>Sender, e.g. "Bookly &lt;no-reply@tuodominio.it&gt;".</summary>
    [Required]
    public string From { get; set; } = string.Empty;

    [Range(1, 120)]
    public int TimeoutSeconds { get; set; } = 15;
}

public enum SmtpSecurity
{
    None,
    SslOnConnect,
    StartTls,
}
