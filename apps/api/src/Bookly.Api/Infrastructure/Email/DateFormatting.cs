using System.Globalization;

namespace Bookly.Api.Infrastructure.Email;

internal static class DateFormatting
{
    private static readonly CultureInfo Italian = CultureInfo.GetCultureInfo("it-IT");

    /// <summary>"martedì 2 marzo 2027, 09:45" in the tenant's time zone (booking-domain: notifications).</summary>
    public static string LongItalian(DateTimeOffset instant, TimeZoneInfo timeZone) =>
        TimeZoneInfo.ConvertTime(instant, timeZone).ToString("dddd d MMMM yyyy, HH:mm", Italian);
}
