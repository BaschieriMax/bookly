using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Bookly.Api.Auth;

/// <summary>Email confirmation links last 48 hours; password reset links keep the 1 hour default provider.</summary>
public sealed class EmailConfirmationTokenProvider<TUser>(
    IDataProtectionProvider dataProtectionProvider,
    IOptions<EmailConfirmationTokenProviderOptions> options,
    ILogger<DataProtectorTokenProvider<TUser>> logger)
    : DataProtectorTokenProvider<TUser>(dataProtectionProvider, options, logger)
    where TUser : class
{
    public const string ProviderName = "EmailConfirmation";
}

public sealed class EmailConfirmationTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public EmailConfirmationTokenProviderOptions()
    {
        Name = EmailConfirmationTokenProvider<object>.ProviderName;
        TokenLifespan = TimeSpan.FromHours(48);
    }
}
