using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Web;
using Bookly.Api.IntegrationTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Bookly.Api.IntegrationTests;

[Collection(DatabaseCollection.Name)]
public sealed class AuthTests(PostgresFixture database) : IDisposable
{
    private const string Password = "una-password-lunga";
    private const string ConfirmSubject = "Conferma il tuo indirizzo email";
    private const string ResetSubject = "Reimposta la tua password";

    private readonly BooklyApiFactory _factory = new(database);

    private static string NewEmail() => $"{Guid.NewGuid():N}@example.test";

    private static object RegisterBody(string email, string password = Password) => new
    {
        email,
        password,
        firstName = "Mario",
        lastName = "Rossi",
        acceptPrivacy = true,
    };

    private async Task<string> RegisterAndConfirmAsync(ApiSession session)
    {
        var email = NewEmail();
        using var register = await session.PostAsync("/api/auth/register", RegisterBody(email));
        Assert.Equal(HttpStatusCode.Accepted, register.StatusCode);

        var query = HttpUtility.ParseQueryString(_factory.Emails.LastLink(email, ConfirmSubject).Query);
        using var confirm = await session.PostAsync("/api/auth/confirm-email", new { userId = query["userId"], token = query["token"] });
        Assert.Equal(HttpStatusCode.NoContent, confirm.StatusCode);
        return email;
    }

    private static async Task<string?> ProblemCodeAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    [Fact]
    public async Task Register_sends_a_confirmation_link_that_confirms_the_email()
    {
        using var session = _factory.CreateSession();

        var email = await RegisterAndConfirmAsync(session);

        await using var db = database.CreateDbContext();
        var user = await db.Users.SingleAsync(u => u.Email == email);
        Assert.True(user.EmailConfirmed);
        Assert.NotNull(user.PrivacyAcceptedAt);
        Assert.Contains("https://app.bookly.test/conferma-email?", _factory.Emails.SentTo(email)[0].TextBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Registering_an_existing_email_looks_the_same_and_creates_no_account()
    {
        using var session = _factory.CreateSession();
        var email = NewEmail();

        using var first = await session.PostAsync("/api/auth/register", RegisterBody(email));
        using var second = await session.PostAsync("/api/auth/register", RegisterBody(email, "altra-password-lunga"));

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, second.StatusCode);
        Assert.Contains(_factory.Emails.SentTo(email), m => m.Subject == "Hai già un account Bookly");
        await using var db = database.CreateDbContext();
        Assert.Equal(1, await db.Users.CountAsync(u => u.Email == email));
    }

    [Fact]
    public async Task Weak_password_returns_identity_error_codes()
    {
        using var session = _factory.CreateSession();

        using var response = await session.PostAsync("/api/auth/register", RegisterBody(NewEmail(), "aaaaaaaaaa"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var errors = json.GetProperty("errors").GetProperty("password").EnumerateArray().Select(e => e.GetString());
        Assert.Contains("PasswordRequiresUniqueChars", errors);
    }

    [Fact]
    public async Task Post_without_antiforgery_header_is_rejected()
    {
        using var session = _factory.CreateSession();
        (await session.MeAsync()).Dispose();

        using var response = await session.Client.PostAsJsonAsync("/api/auth/login", new { email = NewEmail(), password = Password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_sets_a_hardened_session_cookie_and_me_returns_the_user()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);

        using var login = await session.PostAsync("/api/auth/login", new { email, password = Password, rememberMe = false });

        Assert.Equal(HttpStatusCode.NoContent, login.StatusCode);
        var setCookie = Assert.Single(login.Headers.GetValues("Set-Cookie"), c => c.StartsWith("__Host-bookly.auth=", StringComparison.Ordinal));
        Assert.Contains("secure", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/", setCookie, StringComparison.OrdinalIgnoreCase);

        using var me = await session.MeAsync();
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var body = await me.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, body.GetProperty("email").GetString());
        Assert.True(body.GetProperty("emailConfirmed").GetBoolean());
    }

    [Fact]
    public async Task Wrong_password_and_unknown_email_get_the_same_answer()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);

        using var wrongPassword = await session.PostAsync("/api/auth/login", new { email, password = "password-sbagliata" });
        using var unknownEmail = await session.PostAsync("/api/auth/login", new { email = NewEmail(), password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal("auth.invalid_credentials", await ProblemCodeAsync(wrongPassword));
        Assert.Equal("auth.invalid_credentials", await ProblemCodeAsync(unknownEmail));
    }

    [Fact]
    public async Task Account_is_locked_after_five_failed_attempts()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);

        for (var i = 0; i < 5; i++)
        {
            (await session.PostAsync("/api/auth/login", new { email, password = "password-sbagliata" })).Dispose();
        }

        using var correct = await session.PostAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, correct.StatusCode);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);
        (await session.PostAsync("/api/auth/login", new { email, password = Password })).Dispose();
        (await session.MeAsync()).Dispose(); // token bound to the authenticated user

        using var logout = await session.PostAsync("/api/auth/logout");
        using var me = await session.MeAsync();

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, me.StatusCode);
    }

    [Fact]
    public async Task Password_reset_replaces_the_password()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);

        using var forgot = await session.PostAsync("/api/auth/forgot-password", new { email });
        var query = HttpUtility.ParseQueryString(_factory.Emails.LastLink(email, ResetSubject).Query);
        using var reset = await session.PostAsync("/api/auth/reset-password", new { email, token = query["token"], newPassword = "nuova-password-lunga" });
        using var oldLogin = await session.PostAsync("/api/auth/login", new { email, password = Password });
        using var newLogin = await session.PostAsync("/api/auth/login", new { email, password = "nuova-password-lunga" });

        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, newLogin.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_for_unknown_email_is_accepted_without_sending_email()
    {
        using var session = _factory.CreateSession();
        var email = NewEmail();

        using var response = await session.PostAsync("/api/auth/forgot-password", new { email });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(_factory.Emails.SentTo(email));
    }

    [Fact]
    public async Task Tampered_reset_token_is_rejected()
    {
        using var session = _factory.CreateSession();
        var email = await RegisterAndConfirmAsync(session);

        using var reset = await session.PostAsync("/api/auth/reset-password", new { email, token = "bm90LWEtdG9rZW4", newPassword = "nuova-password-lunga" });

        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode);
        Assert.Equal("auth.invalid_token", await ProblemCodeAsync(reset));
    }

    public void Dispose() => _factory.Dispose();
}

[Collection(DatabaseCollection.Name)]
public sealed class AuthRateLimitTests(PostgresFixture database) : IDisposable
{
    private readonly BooklyApiFactory _factory = new(database, loginPermitPerMinute: 2);

    [Fact]
    public async Task Login_attempts_over_the_limit_get_429()
    {
        using var session = _factory.CreateSession();
        var body = new { email = $"{Guid.NewGuid():N}@example.test", password = "una-password-lunga" };

        (await session.PostAsync("/api/auth/login", body)).Dispose();
        (await session.PostAsync("/api/auth/login", body)).Dispose();
        using var third = await session.PostAsync("/api/auth/login", body);

        Assert.Equal(HttpStatusCode.TooManyRequests, third.StatusCode);
    }

    public void Dispose() => _factory.Dispose();
}
