using System.Text;
using Bookly.Api.Auth;
using Bookly.Api.DTOs.Auth;
using Bookly.Api.Entities;
using Bookly.Api.Infrastructure;
using Bookly.Api.Infrastructure.Email;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Services;

/// <summary>
/// Account flows. Responses never reveal whether an email is registered (DEC-021):
/// register, forgot-password and resend-confirmation always "accept" the request.
/// </summary>
public sealed class AccountService(
    UserManager<AppUser> userManager,
    IEmailSender emailSender,
    IOptions<AppOptions> appOptions,
    TimeProvider timeProvider,
    ILogger<AccountService> logger)
{
    public async Task<IdentityResult> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var existing = await userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
        {
            var resetLink = await BuildResetLinkAsync(existing);
            await TrySendAsync(EmailTemplates.AlreadyRegistered(existing.Email!, existing.FirstName, resetLink), cancellationToken);
            return IdentityResult.Success;
        }

        var now = timeProvider.GetUtcNow();
        var user = new AppUser
        {
            Id = Guid.CreateVersion7(),
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim(),
            PrivacyAcceptedAt = now,
            CreatedAt = now,
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return result;
        }

        await SendConfirmationAsync(user, cancellationToken);
        return IdentityResult.Success;
    }

    public async Task ResendConfirmationAsync(string email, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is { EmailConfirmed: false })
        {
            await SendConfirmationAsync(user, cancellationToken);
        }
    }

    public async Task<bool> ConfirmEmailAsync(Guid userId, string token)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || !TryDecode(token, out var decoded))
        {
            return false;
        }

        var result = await userManager.ConfirmEmailAsync(user, decoded);
        return result.Succeeded;
    }

    public async Task ForgotPasswordAsync(string email, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return;
        }

        var link = await BuildResetLinkAsync(user);
        await TrySendAsync(EmailTemplates.ResetPassword(user.Email!, user.FirstName, link), cancellationToken);
    }

    /// <summary>Resets the password. An unknown email or a malformed token is reported as an InvalidToken failure.</summary>
    public async Task<IdentityResult> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null || !TryDecode(request.Token, out var decoded))
        {
            return IdentityResult.Failed(userManager.ErrorDescriber.InvalidToken());
        }

        var result = await userManager.ResetPasswordAsync(user, decoded, request.NewPassword);
        if (!result.Succeeded)
        {
            return result;
        }

        // The reset link proves ownership of the mailbox; ResetPasswordAsync already rotated the security stamp.
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await userManager.UpdateAsync(user);
        }

        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.SetLockoutEndDateAsync(user, null);
        return result;
    }

    /// <summary>Invitation link for a user created without a password (DEC-028).</summary>
    public async Task<string> BuildInvitationLinkAsync(AppUser user)
    {
        var token = Encode(await userManager.GenerateUserTokenAsync(
            user, InvitationTokenProvider<AppUser>.ProviderName, InvitationTokenProvider<AppUser>.Purpose));
        return $"{BaseUrl}/invito?userId={user.Id}&token={token}";
    }

    /// <summary>The invited user if the link is valid and still unused (no password yet), otherwise null.</summary>
    public async Task<AppUser?> FindInvitedUserAsync(Guid userId, string token)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null || user.PasswordHash is not null || !TryDecode(token, out var decoded))
        {
            return null;
        }

        var valid = await userManager.VerifyUserTokenAsync(
            user, InvitationTokenProvider<AppUser>.ProviderName, InvitationTokenProvider<AppUser>.Purpose, decoded);
        return valid ? user : null;
    }

    /// <summary>
    /// Sets the first password of an invited user. The link proves ownership of the mailbox, so the
    /// email is confirmed; adding the password rotates the security stamp and invalidates the link.
    /// </summary>
    public async Task<(AppUser? User, IdentityResult Result)> AcceptInvitationAsync(AcceptInvitationRequest request)
    {
        var user = await FindInvitedUserAsync(request.UserId, request.Token);
        if (user is null)
        {
            return (null, IdentityResult.Failed(userManager.ErrorDescriber.InvalidToken()));
        }

        var result = await userManager.AddPasswordAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return (null, result);
        }

        user.EmailConfirmed = true;
        user.PrivacyAcceptedAt = timeProvider.GetUtcNow();
        await userManager.UpdateAsync(user);
        return (user, result);
    }

    private async Task SendConfirmationAsync(AppUser user, CancellationToken cancellationToken)
    {
        var token = Encode(await userManager.GenerateEmailConfirmationTokenAsync(user));
        var link = $"{BaseUrl}/conferma-email?userId={user.Id}&token={token}";
        await TrySendAsync(EmailTemplates.ConfirmEmail(user.Email!, user.FirstName, link), cancellationToken);
    }

    private async Task<string> BuildResetLinkAsync(AppUser user)
    {
        var token = Encode(await userManager.GeneratePasswordResetTokenAsync(user));
        return $"{BaseUrl}/reimposta-password?email={Uri.EscapeDataString(user.Email!)}&token={token}";
    }

    /// <summary>
    /// Email failures must not break the account flow (OWASP A10): the user can ask for a new email.
    /// </summary>
    private async Task TrySendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "Sending email '{Subject}' failed", message.Subject);
        }
    }

    private string BaseUrl => appOptions.Value.PublicBaseUrl.TrimEnd('/');

    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    private static bool TryDecode(string token, out string decoded)
    {
        try
        {
            decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token));
            return true;
        }
        catch (FormatException)
        {
            decoded = string.Empty;
            return false;
        }
    }
}
