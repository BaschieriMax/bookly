using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Services.Jobs;

namespace Bookly.Api.UnitTests;

/// <summary>DEC-039: the emails sent when a suspension cancels appointments, and the retry backoff.</summary>
public sealed class SuspensionEmailTests
{
    [Fact]
    public void Customer_email_without_business_phone_has_no_button_and_no_link()
    {
        var message = EmailTemplates.AppointmentsCancelledNotice(
            "c@example.test", "Giulia", "Sfumo <Barber>", ["Taglio con Luca, venerdì 27 novembre 2026, 10:30"], tenantPhone: null);

        Assert.Equal("Appuntamento annullato: Sfumo <Barber>", message.Subject);
        Assert.Equal("AppointmentsCancelledNotice", message.Kind);
        Assert.DoesNotContain("<a ", message.HtmlBody, StringComparison.Ordinal);
        Assert.DoesNotContain("http", message.TextBody, StringComparison.Ordinal);
        Assert.Contains("Sfumo &lt;Barber&gt;", message.HtmlBody, StringComparison.Ordinal);
        Assert.Contains("<li>Taglio con Luca, venerd", message.HtmlBody, StringComparison.Ordinal);
    }

    [Fact]
    public void Owner_summary_uses_singular_forms_and_skips_the_table_when_everyone_is_emailed()
    {
        var one = EmailTemplates.TenantSuspendedSummary(
            "o@example.test", "Mario", "Sfumo Barber", 1, 0, 1, [new("Luca Ferri", null, "sabato 28 novembre 2026, 09:00")]);
        var all = EmailTemplates.TenantSuspendedSummary("o@example.test", "Mario", "Sfumo Barber", 3, 2, 0, []);

        Assert.Equal("Attività sospesa: Sfumo Barber, 1 appuntamento annullato", one.Subject);
        Assert.Contains("Abbiamo annullato 1 appuntamento futuro.", one.TextBody, StringComparison.Ordinal);
        Assert.Contains("1 cliente non può essere avvisato via email", one.TextBody, StringComparison.Ordinal);
        Assert.Contains("- Luca Ferri, —, sabato", one.TextBody, StringComparison.Ordinal);
        Assert.Contains("<th scope=\"col\"", one.HtmlBody, StringComparison.Ordinal);

        Assert.Contains("stiamo avvisando via email 2 clienti", all.TextBody, StringComparison.Ordinal);
        Assert.DoesNotContain("<table style", all.HtmlBody, StringComparison.Ordinal);
        Assert.DoesNotContain("Ti consigliamo", all.TextBody, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 30)]
    [InlineData(3, 120)]
    [InlineData(7, 360)]
    public void Retries_wait_longer_each_time(int attempts, int minutes) =>
        Assert.Equal(TimeSpan.FromMinutes(minutes), SuspensionNoticeService.Backoff(attempts));
}
