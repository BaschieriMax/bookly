using System.Text.Encodings.Web;

namespace Bookly.Api.Infrastructure.Email;

/// <summary>Italian transactional email templates. All user-provided values are HTML-encoded.</summary>
internal static class EmailTemplates
{
    public static EmailMessage ConfirmEmail(string to, string firstName, string link) => Build(
        to,
        subject: "Conferma il tuo indirizzo email",
        greeting: firstName,
        paragraph: "Grazie per esserti registrato su Turnora. Conferma la tua email per poter prenotare.",
        actionLabel: "Conferma email",
        link: link,
        footer: "Il link scade tra 48 ore. Se non hai creato tu l'account, ignora questa email.");

    public static EmailMessage AlreadyRegistered(string to, string firstName, string resetLink) => Build(
        to,
        subject: "Hai già un account Turnora",
        greeting: firstName,
        paragraph: "Qualcuno ha provato a registrarsi con questa email, ma esiste già un account. Se hai dimenticato la password puoi reimpostarla.",
        actionLabel: "Reimposta la password",
        link: resetLink,
        footer: "Se non sei stato tu, ignora questa email: il tuo account è al sicuro.");

    public static EmailMessage ResetPassword(string to, string firstName, string link) => Build(
        to,
        subject: "Reimposta la tua password",
        greeting: firstName,
        paragraph: "Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account Turnora.",
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
        subject: "Il tuo account Turnora è stato eliminato",
        greeting: firstName,
        paragraph: "Come richiesto, abbiamo eliminato il tuo account: i tuoi dati personali sono stati cancellati e gli appuntamenti futuri annullati. Lo storico degli appuntamenti passati resta alle attività in forma anonima.",
        actionLabel: "Torna su Turnora",
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
        string manageLink,
        bool hasAccount = true) => Build(
        to,
        subject: $"Promemoria: {serviceName} da {tenantName}",
        greeting: firstName,
        paragraph: $"Ti ricordiamo il tuo appuntamento da {tenantName}: {serviceName} con {staffName}, {when}"
            + (address is null ? "." : $", {address}."),
        // Without an account (address book, DEC-037) the link is the business's page.
        actionLabel: hasAccount ? "Gestisci la prenotazione" : "Vedi l'attività",
        link: manageLink,
        footer: cancelDeadline is not null
            ? $"Se non puoi venire, disdici online entro {cancelDeadline}: libererai il posto per un altro cliente."
            : "Se non puoi venire, avvisa l'attività" + (tenantPhone is null ? "." : $" al numero {tenantPhone}."));

    public static EmailMessage OwnerInvitation(string to, string firstName, string tenantName, string link) => Build(
        to,
        subject: $"Sei stato invitato a gestire {tenantName} su Turnora",
        greeting: firstName,
        paragraph: $"Sei il titolare di {tenantName} su Turnora. Scegli una password per attivare l'account e configurare servizi, staff e orari.",
        actionLabel: "Attiva l'account",
        link: link,
        footer: "Il link scade tra 7 giorni. Se non ti aspettavi questo invito, ignora questa email.");

    public static EmailMessage OwnerAdded(string to, string firstName, string tenantName, string link) => Build(
        to,
        subject: $"Ora gestisci {tenantName} su Turnora",
        greeting: firstName,
        paragraph: $"Il tuo account Turnora è stato aggiunto come titolare di {tenantName}. Accedi con le tue solite credenziali.",
        actionLabel: "Apri l'area dell'attività",
        link: link,
        footer: "Se non ti aspettavi questa email, contatta il supporto di Turnora.");

    public static EmailMessage AppointmentMovedByBusiness(
        string to,
        string firstName,
        string tenantName,
        string serviceName,
        string oldWhen,
        string newWhen,
        string manageLink,
        bool hasAccount = true,
        string? tenantPhone = null) => Build(
        to,
        subject: $"Appuntamento spostato: {tenantName}",
        greeting: firstName,
        paragraph: $"{tenantName} ha spostato il tuo appuntamento ({serviceName}) da {oldWhen} a {newWhen}.",
        actionLabel: hasAccount ? "Vedi le tue prenotazioni" : "Vedi l'attività",
        link: manageLink,
        footer: hasAccount
            ? "Se il nuovo orario non ti va bene, disdici dal link o contatta l'attività."
            : "Se il nuovo orario non ti va bene, contatta l'attività" + (tenantPhone is null ? "." : $" al numero {tenantPhone}."));

    /// <summary>The business entered the appointment from its calendar (phone, walk-in; DEC-037).</summary>
    public static EmailMessage AppointmentBookedByBusiness(
        string to,
        string firstName,
        string tenantName,
        string serviceName,
        string staffName,
        string when,
        string? address,
        string? tenantPhone,
        string link,
        bool hasAccount) => Build(
        to,
        subject: $"Appuntamento confermato da {tenantName}",
        greeting: firstName,
        paragraph: $"{tenantName} ha registrato il tuo appuntamento: {serviceName} con {staffName}, {when}"
            + (address is null ? "." : $", {address}."),
        actionLabel: hasAccount ? "Vedi le tue prenotazioni" : "Vedi l'attività",
        link: link,
        footer: (hasAccount
                ? "Se non puoi venire, disdici dal link o avvisa l'attività."
                : "Se non puoi venire, avvisa l'attività" + (tenantPhone is null ? "." : $" al numero {tenantPhone}."))
            + $" Ricevi questa email perché hai lasciato il tuo indirizzo a {tenantName}.");

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

    /// <summary>A row of a details table: the value is HTML-encoded, the optional link (tel:, mailto:) wraps it.</summary>
    public sealed record EmailDetail(string Label, string Value, string? Link = null, bool Strong = false);

    /// <summary>
    /// To the owners and the staff member's own login when a customer books online (DEC-040).
    /// Phone and note rows appear only when the customer gave them.
    /// </summary>
    public static EmailMessage OnlineBookingNotice(
        string to,
        string firstName,
        string tenantName,
        string customerName,
        string serviceName,
        string when,
        string staffName,
        string? customerPhone,
        string? customerEmail,
        string? note,
        string calendarDay,
        string calendarLink)
    {
        List<EmailDetail> details =
        [
            new("Servizio", serviceName, Strong: true),
            new("Quando", when, Strong: true),
            new("Operatore", staffName),
        ];
        if (!string.IsNullOrWhiteSpace(customerPhone))
        {
            details.Add(new("Telefono", customerPhone, TelLink(customerPhone)));
        }

        if (!string.IsNullOrWhiteSpace(customerEmail))
        {
            details.Add(new("Email", customerEmail, $"mailto:{customerEmail}"));
        }

        if (!string.IsNullOrWhiteSpace(note))
        {
            details.Add(new("Nota", $"«{note}»"));
        }

        return BuildDetailed(
            to,
            subject: $"Nuova prenotazione: {customerName}, {when}",
            greeting: firstName,
            intro: $"{customerName} ha prenotato online da {tenantName}:",
            items: [],
            outro: [],
            table: null,
            action: ("Apri il calendario", calendarLink),
            footer: $"Il pulsante apre il calendario su {calendarDay}. Puoi disattivare questi avvisi nelle impostazioni dell'attività.",
            details: details);
    }

    /// <summary>
    /// The business was suspended and its future appointments cancelled (DEC-039). Neutral on
    /// purpose: no "suspended", no reason, and no link to the public page (it is gone).
    /// </summary>
    public static EmailMessage AppointmentsCancelledNotice(
        string to, string firstName, string tenantName, IReadOnlyList<string> appointments, string? tenantPhone)
    {
        var single = appointments.Count == 1;
        return BuildDetailed(
            to,
            subject: single ? $"Appuntamento annullato: {tenantName}" : $"Appuntamenti annullati: {tenantName}",
            greeting: firstName,
            intro: single
                ? $"Il tuo appuntamento da {tenantName} è stato annullato:"
                : $"I tuoi appuntamenti da {tenantName} sono stati annullati:",
            items: appointments,
            outro: ["Per un nuovo appuntamento contatta direttamente l'attività."],
            table: null,
            action: string.IsNullOrWhiteSpace(tenantPhone) ? null : ($"Chiama {tenantPhone}", TelLink(tenantPhone)),
            footer: $"Ci scusiamo per il disagio. Ricevi questa email perché avevi un appuntamento con {tenantName}.");
    }

    /// <summary>A customer the owner should call: no email address, or no emails wanted.</summary>
    public sealed record CustomerToCall(string Name, string? Phone, string When);

    /// <summary>To each owner when the business is suspended with its future appointments cancelled (DEC-039).</summary>
    public static EmailMessage TenantSuspendedSummary(
        string to,
        string firstName,
        string tenantName,
        int cancelledAppointments,
        int notifiedCustomers,
        int customersToCall,
        IReadOnlyList<CustomerToCall> toCall)
    {
        var cancelled = Count(cancelledAppointments, "appuntamento futuro", "appuntamenti futuri");
        List<string> outro = [];
        if (toCall.Count > 0)
        {
            outro.Add(customersToCall == 1
                ? "1 cliente non può essere avvisato via email (non ha lasciato un indirizzo o non vuole ricevere email). Ti consigliamo di chiamarlo:"
                : $"{customersToCall} clienti non possono essere avvisati via email (non hanno lasciato un indirizzo o non vogliono ricevere email). Ti consigliamo di chiamarli:");
        }

        return BuildDetailed(
            to,
            subject: $"Attività sospesa: {tenantName}, {Count(cancelledAppointments, "appuntamento annullato", "appuntamenti annullati")}",
            greeting: firstName,
            intro: $"L'attività {tenantName} è stata sospesa su Turnora: la pagina pubblica non è più raggiungibile e non si può prenotare. I dati restano conservati.",
            items: [],
            outro:
            [
                notifiedCustomers > 0
                    ? $"Abbiamo annullato {cancelled} e stiamo avvisando via email {Count(notifiedCustomers, "cliente", "clienti")}, senza indicare il motivo."
                    : $"Abbiamo annullato {cancelled}.",
                .. outro,
            ],
            table: toCall.Count == 0
                ? null
                : (["Cliente", "Telefono", "Appuntamento"], [.. toCall.Select(c => (IReadOnlyList<string>)[c.Name, c.Phone ?? "—", c.When])]),
            action: null,
            footer: "Per riattivare l'attività o per qualsiasi domanda, contatta il supporto di Turnora.");
    }

    /// <summary>"1 cliente" / "3 clienti": counts without an article, which in Italian depends on the number.</summary>
    private static string Count(int count, string one, string many) => count == 1 ? $"1 {one}" : $"{count} {many}";

    private static string TelLink(string phone) => "tel:" + new string([.. phone.Where(c => char.IsAsciiDigit(c) || c == '+')]);

    /// <summary>
    /// Like <see cref="Build"/>, with a bulleted list, more paragraphs, an optional table and an
    /// optional button. Kept separate so the existing emails stay byte-for-byte the same.
    /// </summary>
    private static EmailMessage BuildDetailed(
        string to,
        string subject,
        string greeting,
        string intro,
        IReadOnlyList<string> items,
        IReadOnlyList<string> outro,
        (IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows)? table,
        (string Label, string Link)? action,
        string footer,
        IReadOnlyList<EmailDetail>? details = null,
        [System.Runtime.CompilerServices.CallerMemberName] string kind = "")
    {
        var html = HtmlEncoder.Default;
        var body = new System.Text.StringBuilder();
        var text = new System.Text.StringBuilder();
        var hasDetails = details is { Count: > 0 };

        body.Append($"""<p style="margin:0 0 16px;font-size:18px;font-weight:bold">Ciao {html.Encode(greeting)},</p>""");
        body.Append($"""<p style="margin:0 0 {(items.Count > 0 || hasDetails ? 12 : 16)}px;font-size:15px;line-height:1.5">{html.Encode(intro)}</p>""");
        text.Append($"Ciao {greeting},\n\n{intro}\n");

        if (hasDetails)
        {
            const string label = "width:96px;padding:8px 12px 8px 0;border-bottom:1px solid #e4e4e7;text-align:left;vertical-align:top;font-size:14px;font-weight:normal;color:#52525b";
            body.Append("""<table role="presentation" style="width:100%;margin:0 0 16px;border-collapse:collapse;font-size:15px;line-height:1.45"><tbody>""");
            text.Append('\n');
            foreach (var detail in details!)
            {
                var value = html.Encode(detail.Value);
                if (detail.Link is not null)
                {
                    value = $"""<a href="{html.Encode(detail.Link)}" style="color:#0f766e">{value}</a>""";
                }

                var weight = detail.Strong ? "font-weight:bold;" : string.Empty;
                body.Append($"""<tr><th scope="row" style="{label}">{html.Encode(detail.Label)}</th><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;{weight}white-space:pre-line;overflow-wrap:anywhere">{value}</td></tr>""");
                text.Append($"{detail.Label}: {detail.Value}\n");
            }

            body.Append("</tbody></table>");
        }

        if (items.Count > 0)
        {
            body.Append("""<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6">""");
            foreach (var item in items)
            {
                body.Append($"<li>{html.Encode(item)}</li>");
                text.Append($"- {item}\n");
            }

            body.Append("</ul>");
        }

        foreach (var paragraph in outro)
        {
            body.Append($"""<p style="margin:0 0 16px;font-size:15px;line-height:1.5">{html.Encode(paragraph)}</p>""");
            text.Append($"\n{paragraph}\n");
        }

        if (table is { } t)
        {
            const string cell = "padding:10px 8px 10px 0;border-bottom:1px solid #e4e4e7;text-align:left";
            body.Append("""<table style="width:100%;margin:0 0 24px;border-collapse:collapse;font-size:14px;line-height:1.4"><thead><tr>""");
            foreach (var header in t.Headers)
            {
                body.Append($"""<th scope="col" style="{cell};color:#52525b">{html.Encode(header)}</th>""");
            }

            body.Append("</tr></thead><tbody>");
            text.Append('\n');
            foreach (var row in t.Rows)
            {
                body.Append("<tr>");
                foreach (var value in row)
                {
                    body.Append($"""<td style="{cell}">{html.Encode(value)}</td>""");
                }

                body.Append("</tr>");
                text.Append($"- {string.Join(", ", row)}\n");
            }

            body.Append("</tbody></table>");
        }

        if (action is { } a)
        {
            body.Append($"""<p style="margin:8px 0 24px"><a href="{html.Encode(a.Link)}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">{html.Encode(a.Label)}</a></p>""");
            text.Append($"\n{a.Label}: {a.Link}\n");
        }

        body.Append($"""<p style="margin:0;font-size:13px;line-height:1.5;color:#52525b">{html.Encode(footer)}</p>""");
        text.Append($"\n{footer}\n");

        var htmlBody = $"""
            <!doctype html>
            <html lang="it">
            <body style="margin:0;padding:24px;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#18181b">
              <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px">
                <tr><td style="padding:28px">{body}</td></tr>
              </table>
            </body>
            </html>
            """;

        return new EmailMessage(to, subject, htmlBody, text.ToString(), kind);
    }

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
