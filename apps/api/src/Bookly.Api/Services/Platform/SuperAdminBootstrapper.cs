using Bookly.Api.Data.Configurations;
using Bookly.Api.Entities;
using Microsoft.AspNetCore.Identity;

namespace Bookly.Api.Services.Platform;

public sealed class PlatformOptions
{
    public const string Section = "Platform";

    /// <summary>
    /// Emails that must have the SuperAdmin role (DEC-028). Applied at every start-up, only to
    /// accounts that already exist with a confirmed email: registering with the address is not
    /// enough, the mailbox must be proven first.
    /// </summary>
    public string[] SuperAdminEmails { get; set; } = [];
}

/// <summary>Grants SuperAdmin to the configured emails. Idempotent; never removes the role.</summary>
public static class SuperAdminBootstrapper
{
    public static async Task RunAsync(IServiceProvider services, PlatformOptions options, ILogger logger)
    {
        if (options.SuperAdminEmails.Length == 0)
        {
            return;
        }

        var users = services.GetRequiredService<UserManager<AppUser>>();
        foreach (var email in options.SuperAdminEmails.Where(e => !string.IsNullOrWhiteSpace(e)))
        {
            var user = await users.FindByEmailAsync(email.Trim());
            if (user is not { EmailConfirmed: true })
            {
                logger.LogWarning("SuperAdmin bootstrap: no confirmed account for a configured email yet");
                continue;
            }

            if (!await users.IsInRoleAsync(user, AppRoleConfiguration.SuperAdmin))
            {
                await users.AddToRoleAsync(user, AppRoleConfiguration.SuperAdmin);
                logger.LogInformation("SuperAdmin role granted to user {UserId}", user.Id);
            }
        }
    }
}
