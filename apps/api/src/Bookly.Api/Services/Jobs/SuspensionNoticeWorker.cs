using Bookly.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services.Jobs;

/// <summary>Wakes the <see cref="SuspensionNoticeWorker"/> as soon as a suspension queues emails.</summary>
public sealed class SuspensionNoticeSignal
{
    private readonly SemaphoreSlim _semaphore = new(0, 1);

    public void Notify()
    {
        try
        {
            _semaphore.Release();
        }
        catch (SemaphoreFullException)
        {
            // Already signalled: the worker will run once for both.
        }
    }

    public Task<bool> WaitAsync(TimeSpan timeout, CancellationToken cancellationToken) => _semaphore.WaitAsync(timeout, cancellationToken);
}

/// <summary>
/// Sends the suspension notices in the background (DEC-039): right after a suspension, at
/// startup and every few minutes while the app is awake. On Render free the app sleeps, so the
/// scheduler also calls POST /api/jobs/send-suspension-notices to resume after errors or the
/// daily limit; both paths claim each notice, so they never send twice.
/// </summary>
internal sealed class SuspensionNoticeWorker(
    IServiceScopeFactory scopes,
    SuspensionNoticeSignal signal,
    IOptions<SuspensionNoticeOptions> options,
    ILogger<SuspensionNoticeWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.RunInBackground || BuildTime.IsOpenApiGeneration)
        {
            return;
        }

        await Task.Yield();
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<SuspensionNoticeService>().SendDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // Database asleep or unreachable: try again at the next tick.
                logger.LogError(exception, "Suspension notice run failed");
            }

            try
            {
                await signal.WaitAsync(TimeSpan.FromMinutes(settings.PollMinutes), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
