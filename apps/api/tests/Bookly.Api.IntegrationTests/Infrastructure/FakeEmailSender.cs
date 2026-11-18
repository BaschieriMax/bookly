using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Bookly.Api.Infrastructure.Email;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>Captures emails instead of sending them.</summary>
public sealed partial class FakeEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _messages = new();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        _messages.Enqueue(message);
        return Task.CompletedTask;
    }

    public IReadOnlyList<EmailMessage> SentTo(string email) =>
        [.. _messages.Where(m => string.Equals(m.To, email, StringComparison.OrdinalIgnoreCase))];

    /// <summary>The single link in the last email sent to <paramref name="email"/> with the given subject.</summary>
    public Uri LastLink(string email, string subject)
    {
        var message = SentTo(email).Last(m => m.Subject == subject);
        return new Uri(LinkPattern().Match(message.TextBody).Value);
    }

    [GeneratedRegex(@"https?://\S+")]
    private static partial Regex LinkPattern();
}
