using Bookly.Api.Infrastructure.Email;
using Bookly.Api.Infrastructure.Monitoring;
using Bookly.Api.Infrastructure.Security;
using Sentry;

namespace Bookly.Api.UnitTests;

public sealed class HardeningUnitTests
{
    [Fact]
    public void Csp_accepts_only_https_origins_from_configuration()
    {
        var csp = SecurityHeaders.BuildContentSecurityPolicy(
            new SecurityOptions
            {
                ExtraConnectSources =
                [
                    "https://o1.ingest.de.sentry.io/",
                    "http://insecure.example",
                    "https://*.example.com",
                    "https://evil.example; script-src *",
                    "https://x.example/path",
                ],
            },
            upgradeInsecureRequests: true);

        Assert.Contains("connect-src 'self' https://o1.ingest.de.sentry.io;", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("http://insecure.example", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("evil", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("x.example", csp, StringComparison.Ordinal);
        Assert.EndsWith("upgrade-insecure-requests", csp, StringComparison.Ordinal);
    }

    [Fact]
    public void Sentry_events_lose_user_cookies_headers_and_query_tokens()
    {
        var sentryEvent = new SentryEvent
        {
            User = new SentryUser { Email = "mario@example.test", IpAddress = "1.2.3.4" },
        };
        sentryEvent.Request.Url = "https://bookly.test/api/auth/invitation?userId=1&token=secret";
        sentryEvent.Request.QueryString = "userId=1&token=secret";
        sentryEvent.Request.Cookies = "__Host-bookly.auth=abc";
        sentryEvent.Request.Headers["Cookie"] = "__Host-bookly.auth=abc";

        var scrubbed = MonitoringScrubber.Scrub(sentryEvent, new SentryHint())!;

        Assert.Null(scrubbed.User.Email);
        Assert.Null(scrubbed.User.IpAddress);
        Assert.Equal("https://bookly.test/api/auth/invitation", scrubbed.Request.Url);
        Assert.Null(scrubbed.Request.QueryString);
        Assert.Null(scrubbed.Request.Cookies);
        Assert.Empty(scrubbed.Request.Headers);
    }

    [Fact]
    public void Emails_carry_a_loggable_kind_instead_of_personal_data()
    {
        var message = EmailTemplates.CustomerCancelledNotice("o@example.test", "Anna", "Mario Rossi", "Taglio", "Luca", "lunedì", "https://x");

        Assert.Equal("CustomerCancelledNotice", message.Kind);
    }
}
