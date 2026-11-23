using Bookly.Api.Infrastructure.Email;

namespace Bookly.Api.UnitTests;

/// <summary>DEC-040: the email to the business for a new online booking.</summary>
public sealed class OnlineBookingNoticeTests
{
    private static EmailMessage Notice(string? phone, string? note, string? email = "mario@example.test") =>
        EmailTemplates.OnlineBookingNotice(
            "o@example.test",
            "Anna",
            "Sfumo <Barber>",
            "Mario Rossi",
            "Taglio + barba",
            "mercoledì 25 novembre 2026, 10:30",
            "Luca",
            phone,
            email,
            note,
            "mercoledì 25 novembre",
            "https://app.bookly.test/admin?data=2026-11-25");

    [Fact]
    public void Lists_every_detail_with_call_and_mail_links_and_a_calendar_button()
    {
        var message = Notice("+39 333 123 4567", "Arrivo in bici\nok?");

        Assert.Equal("OnlineBookingNotice", message.Kind);
        Assert.Equal("Nuova prenotazione: Mario Rossi, mercoledì 25 novembre 2026, 10:30", message.Subject);
        Assert.Equal(
            """
            Ciao Anna,

            Mario Rossi ha prenotato online da Sfumo <Barber>:

            Servizio: Taglio + barba
            Quando: mercoledì 25 novembre 2026, 10:30
            Operatore: Luca
            Telefono: +39 333 123 4567
            Email: mario@example.test
            Nota: «Arrivo in bici
            ok?»

            Apri il calendario: https://app.bookly.test/admin?data=2026-11-25

            Il pulsante apre il calendario su mercoledì 25 novembre. Puoi disattivare questi avvisi nelle impostazioni dell'attività.

            """.ReplaceLineEndings("\n"),
            message.TextBody);

        // HtmlEncoder writes "+" as an entity: mail clients decode it back to tel:+393331234567.
        Assert.Contains("href=\"tel:&#x2B;393331234567\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("href=\"mailto:mario@example.test\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("<th scope=\"row\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("Sfumo &lt;Barber&gt;", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("white-space:pre-line", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains(">Apri il calendario</a>", message.HtmlBody, StringComparison.Ordinal);
    }

    [Fact]
    public void Leaves_out_the_rows_the_customer_did_not_fill_in()
    {
        var message = Notice(phone: null, note: "   ", email: null);

        Assert.DoesNotContain("Telefono", message.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("Nota", message.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("Email:", message.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("tel:", message.HtmlBody, StringComparison.Ordinal);
        Assert.DoesNotContain("mailto:", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("Operatore: Luca\n", message.TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public void Customer_text_cannot_inject_markup_or_links()
    {
        var message = Notice("333\" onclick=\"x", "<a href=\"https://evil.test\">clic</a>", email: "a\"b@example.test");

        Assert.DoesNotContain("<a href=\"https://evil.test\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.DoesNotContain("onclick=\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("&lt;a href=", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("href=\"tel:333\"", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("href=\"mailto:a&quot;b@example.test\"", message.HtmlBody, StringComparison.Ordinal);
    }
}
