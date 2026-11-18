using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;

namespace Bookly.Api.IntegrationTests.Infrastructure;

/// <summary>A browser-like session: cookie jar + antiforgery header, as the SPA does with Axios.</summary>
public sealed class ApiSession : IDisposable
{
    private static readonly Uri BaseAddress = new("https://localhost");

    public ApiSession(BooklyApiFactory factory)
    {
        Client = factory.CreateDefaultClient(BaseAddress, new CookieContainerHandler(Cookies));
    }

    public CookieContainer Cookies { get; } = new();

    public HttpClient Client { get; }

    public Cookie? GetCookie(string name) => Cookies.GetCookies(BaseAddress)[name];

    /// <summary>Calls GET /api/auth/me, which (re)issues the XSRF-TOKEN cookie.</summary>
    public async Task<HttpResponseMessage> MeAsync() => await Client.GetAsync("/api/auth/me");

    /// <summary>POST with the X-XSRF-TOKEN header taken from the cookie, priming it first if needed.</summary>
    public Task<HttpResponseMessage> PostAsync(string path, object? body = null) => SendAsync(HttpMethod.Post, path, body);

    /// <summary>Unsafe request with the X-XSRF-TOKEN header taken from the cookie, priming it first if needed.</summary>
    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body = null)
    {
        if (GetCookie("XSRF-TOKEN") is null)
        {
            (await MeAsync()).Dispose();
        }

        using var request = new HttpRequestMessage(method, path)
        {
            Content = JsonContent.Create(body ?? new { }),
        };
        request.Headers.Add("X-XSRF-TOKEN", GetCookie("XSRF-TOKEN")!.Value);
        return await Client.SendAsync(request);
    }

    /// <summary>Unsafe request with a ready-made body (e.g. multipart) and the antiforgery header.</summary>
    public async Task<HttpResponseMessage> SendContentAsync(HttpMethod method, string path, HttpContent content)
    {
        if (GetCookie("XSRF-TOKEN") is null)
        {
            (await MeAsync()).Dispose();
        }

        using var request = new HttpRequestMessage(method, path) { Content = content };
        request.Headers.Add("X-XSRF-TOKEN", GetCookie("XSRF-TOKEN")!.Value);
        return await Client.SendAsync(request);
    }

    public void Dispose() => Client.Dispose();
}
