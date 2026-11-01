namespace Refboard.Services;

public static class TimeFormat
{
    /// <summary>Matches Python's time.strftime('%Y-%m-%dT%H:%M:%S%z') - no
    /// colon in the offset - which .NET's own "zzz" custom specifier does not
    /// produce on its own (it always includes one).</summary>
    public static string Iso(DateTimeOffset t) =>
        t.ToString("yyyy-MM-ddTHH:mm:ss") + t.ToString("zzz").Replace(":", "");
}
