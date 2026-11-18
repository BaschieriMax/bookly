var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseStatusCodePages();

// The React build is copied into wwwroot at image build time (DEC-010).
app.MapStaticAssets();

app.MapHealthChecks("/api/health");
app.MapControllers();

// Unknown API routes must return a JSON 404, never the SPA shell.
app.MapFallback("/api/{**rest}", () => Results.Problem(
    statusCode: StatusCodes.Status404NotFound,
    title: "Not Found"));

// Client-side routes (/admin, /b/{slug}, ...) are served by the SPA.
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>Entry point, public for WebApplicationFactory in integration tests.</summary>
public partial class Program;
