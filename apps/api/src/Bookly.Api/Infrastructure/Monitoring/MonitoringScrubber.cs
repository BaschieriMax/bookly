using Sentry;

namespace Bookly.Api.Infrastructure.Monitoring;

/// <summary>
/// Last line of defence before an error leaves for Sentry: no user, no cookies or headers, and no
/// query strings (they can carry email-confirmation, reset or invitation tokens).
/// </summary>
public static class MonitoringScrubber
{
    public static SentryEvent? Scrub(SentryEvent sentryEvent, SentryHint hint)
    {
        sentryEvent.User = new SentryUser();
        sentryEvent.Request.Cookies = null;
        sentryEvent.Request.QueryString = null;
        sentryEvent.Request.Data = null;
        sentryEvent.Request.Headers.Clear();
        sentryEvent.Request.Url = StripQuery(sentryEvent.Request.Url);
        sentryEvent.ServerName = null;
        return sentryEvent;
    }

    public static string? StripQuery(string? url)
    {
        if (string.IsNullOrEmpty(url))
        {
            return url;
        }

        var index = url.IndexOfAny(['?', '#']);
        return index < 0 ? url : url[..index];
    }
}
