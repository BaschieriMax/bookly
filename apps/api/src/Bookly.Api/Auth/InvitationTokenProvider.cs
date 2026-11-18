using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Auth;

/// <summary>
/// Invitation links (owner of a new tenant) last 7 days: the invitee may not read the email at once.
/// The token is bound to the security stamp, so it stops working once the password is set.
/// </summary>
public sealed class InvitationTokenProvider<TUser>(
    IDataProtectionProvider dataProtectionProvider,
    IOptions<InvitationTokenProviderOptions> options,
    ILogger<DataProtectorTokenProvider<TUser>> logger)
    : DataProtectorTokenProvider<TUser>(dataProtectionProvider, options, logger)
    where TUser : class
{
    public const string ProviderName = "Invitation";
    public const string Purpose = "AcceptInvitation";
}

public sealed class InvitationTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public InvitationTokenProviderOptions()
    {
        Name = InvitationTokenProvider<object>.ProviderName;
        TokenLifespan = TimeSpan.FromDays(7);
    }
}
