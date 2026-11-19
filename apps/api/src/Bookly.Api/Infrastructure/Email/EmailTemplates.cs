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

    public static EmailMessage BookingConfirmed(
        string to, string firstName, string tenantName, string serviceName, string when, string? address, string manageLink) => Build(
        to,
        subject: $"Prenotazione confermata da {tenantName}",
        greeting: firstName,
        paragraph: $"La tua prenotazione è confermata: {serviceName}, {when}{(address is null ? string.Empty : $", {address}")}.",
        actionLabel: "Gestisci la prenotazione",
        link: manageLink,
        footer: "Se non puoi venire, disdici dal link: libererai il posto per un altro cliente.");

    public static EmailMessage BookingCancelledByCustomer(
        string to, string firstName, string tenantName, string serviceName, string when, string bookLink) => Build(
        to,
        subject: $"Prenotazione disdetta: {tenantName}",
        greeting: firstName,
        paragraph: $"Abbiamo registrato la disdetta di {serviceName}, {when}.",
        actionLabel: "Prenota un altro orario",
        link: bookLink,
        footer: "Se non sei stato tu, contatta subito l'attività.");

    public static EmailMessage AccountDeleted(string to, string firstName, string homeLink) => Build(
        to,
        subject: "Il tuo account Bookly è stato eliminato",
        greeting: firstName,
        paragraph: "Come richiesto, abbiamo eliminato il tuo account: i tuoi dati personali sono stati cancellati e gli appuntamenti futuri annullati. Lo storico degli appuntamenti passati resta alle attività in forma anonima.",
        actionLabel: "Torna su Bookly",
        link: homeLink,
        footer: "Se non hai chiesto tu l'eliminazione, rispondi a questa email o contatta subito il supporto.");

    public static EmailMessage AppointmentReminder(
        string to,
        string firstName,
        string tenantName,
        string serviceName,
        string staffName,
        string when,
        string? address,
        string? cancelDeadline,
        string? tenantPhone,
        string manageLink) => Build(
        to,
        subject: $"Promemoria: {serviceName} da {tenantName}",
        greeting: firstName,
        paragraph: $"Ti ricordiamo il tuo appuntamento da {tenantName}: {serviceName} con {staffName}, {when}"
            + (address is null ? "." : $", {address}."),
        actionLabel: "Gestisci la prenotazione",
        link: manageLink,
        footer: cancelDeadline is not null
            ? $"Se non puoi venire, disdici online entro {cancelDeadline}: libererai il posto per un altro cliente."
            : "Se non puoi venire, avvisa l'attività" + (tenantPhone is null ? "." : $" al numero {tenantPhone}."));

    public static EmailMessage OwnerInvitation(string to, string firstName, string tenantName, string link) => Build(
        to,
        subject: $"Sei stato invitato a gestire {tenantName} su Bookly",
        greeting: firstName,
        paragraph: $"Sei il titolare di {tenantName} su Bookly. Scegli una password per attivare l'account e configurare servizi, staff e orari.",
        actionLabel: "Attiva l'account",
        link: link,
        footer: "Il link scade tra 7 giorni. Se non ti aspettavi questo invito, ignora questa email.");

    public static EmailMessage OwnerAdded(string to, string firstName, string tenantName, string link) => Build(
        to,
        subject: $"Ora gestisci {tenantName} su Bookly",
        greeting: firstName,
        paragraph: $"Il tuo account Bookly è stato aggiunto come titolare di {tenantName}. Accedi con le tue solite credenziali.",
        actionLabel: "Apri l'area dell'attività",
        link: link,
        footer: "Se non ti aspettavi questa email, contatta il supporto di Bookly.");

    public static EmailMessage AppointmentMovedByBusiness(
        string to, string firstName, string tenantName, string serviceName, string oldWhen, string newWhen, string manageLink) => Build(
        to,
        subject: $"Appuntamento spostato: {tenantName}",
        greeting: firstName,
        paragraph: $"{tenantName} ha spostato il tuo appuntamento ({serviceName}) da {oldWhen} a {newWhen}.",
        actionLabel: "Vedi le tue prenotazioni",
        link: manageLink,
        footer: "Se il nuovo orario non ti va bene, disdici dal link o contatta l'attività.");

    public static EmailMessage AppointmentCancelledByBusiness(
        string to, string firstName, string tenantName, string serviceName, string when, string? reason, string bookLink) => Build(
        to,
        subject: $"Appuntamento annullato: {tenantName}",
        greeting: firstName,
        paragraph: $"{tenantName} ha annullato il tuo appuntamento ({serviceName}, {when})"
            + (string.IsNullOrWhiteSpace(reason) ? "." : $". Motivo: {reason}"),
        actionLabel: "Prenota un altro orario",
        link: bookLink,
        footer: "Ci scusiamo per il disagio.");

    public static EmailMessage CustomerCancelledNotice(
        string to, string firstName, string customerName, string serviceName, string staffName, string when, string calendarLink) => Build(
        to,
        subject: $"Disdetta: {customerName}, {when}",
        greeting: firstName,
        paragraph: $"{customerName} ha disdetto online {serviceName} con {staffName}, {when}. L'orario è di nuovo prenotabile.",
        actionLabel: "Apri il calendario",
        link: calendarLink,
        footer: "Puoi disattivare questi avvisi nelle impostazioni dell'attività.");

    private static EmailMessage Build(
        string to,
        string subject,
        string greeting,
        string paragraph,
        string actionLabel,
        string link,
        string footer,
        [System.Runtime.CompilerServices.CallerMemberName] string kind = "")
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

        return new EmailMessage(to, subject, htmlBody, textBody, kind);
    }
}
