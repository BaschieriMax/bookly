using System.Text.Encodings.Web;

namespace Bookly.Api.Infrastructure.Email;

/// <summary>Italian transactional email templates. All user-provided values are HTML-encoded.</summary>
internal static class EmailTemplates
{
    public static EmailMessage ConfirmEmail(string to, string firstName, string link) => Build(
        to,
        subject: "Conferma il tuo indirizzo email",
        greeting: firstName,
        paragraph: "Grazie per esserti registrato su Bookly. Conferma la tua email per poter prenotare.",
        actionLabel: "Conferma email",
        link: link,
        footer: "Il link scade tra 48 ore. Se non hai creato tu l'account, ignora questa email.");

    public static EmailMessage AlreadyRegistered(string to, string firstName, string resetLink) => Build(
        to,
        subject: "Hai già un account Bookly",
        greeting: firstName,
        paragraph: "Qualcuno ha provato a registrarsi con questa email, ma esiste già un account. Se hai dimenticato la password puoi reimpostarla.",
        actionLabel: "Reimposta la password",
        link: resetLink,
        footer: "Se non sei stato tu, ignora questa email: il tuo account è al sicuro.");

    public static EmailMessage ResetPassword(string to, string firstName, string link) => Build(
        to,
        subject: "Reimposta la tua password",
        greeting: firstName,
        paragraph: "Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account Bookly.",
        actionLabel: "Scegli una nuova password",
        link: link,
        footer: "Il link scade tra 1 ora. Se non hai chiesto tu il cambio password, ignora questa email.");

    private static EmailMessage Build(
        string to, string subject, string greeting, string paragraph, string actionLabel, string link, string footer)
    {
        var html = HtmlEncoder.Default;
        var htmlBody = $"""
            <!doctype html>
            <html lang="it">
            <body style="margin:0;padding:24px;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#18181b">
              <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">
                <tr><td style="padding:28px">
                  <p style="margin:0 0 16px;font-size:18px;font-weight:bold">Ciao {html.Encode(greeting)},</p>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.5">{html.Encode(paragraph)}</p>
                  <p style="margin:0 0 24px"><a href="{html.Encode(link)}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">{html.Encode(actionLabel)}</a></p>
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#52525b">{html.Encode(footer)}</p>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        var textBody = $"""
            Ciao {greeting},

            {paragraph}

            {actionLabel}: {link}

            {footer}
            """;

        return new EmailMessage(to, subject, htmlBody, textBody);
    }
}
