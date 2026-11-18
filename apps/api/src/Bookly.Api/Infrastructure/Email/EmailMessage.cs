namespace Bookly.Api.Infrastructure.Email;

/// <param name="Kind">Template name (e.g. "BookingConfirmed"): safe to log, unlike subject and recipient.</param>
public sealed record EmailMessage(string To, string Subject, string HtmlBody, string TextBody, string Kind = "Email");

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
