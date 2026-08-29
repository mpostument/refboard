using System.Numerics;
using System.Text.RegularExpressions;

namespace Refboard.Services;

/// <summary>
/// Sort key that reads digit runs as numbers: "Veronica2" before "Veronica10".
/// Plain string sort puts it after, which only shows up as an oddly ordered
/// sequential mode - see refboard-index.py's original natural_key().
///
/// The Python original builds a list mixing ints and lowercased strings and
/// lets Python's list comparison sort it, which works in practice but can
/// throw TypeError if two names split into differently-typed tokens at the
/// same position - not reachable with realistic filenames, but not a promise
/// either. This splits both strings with the identical pattern first, so
/// which positions are digit runs is a property of the split alone and is
/// guaranteed to agree between any two strings compared - no type mismatch
/// is possible by construction, a small robustness improvement over the
/// original with no behavioural difference for anything it actually sorted.
/// </summary>
public sealed partial class NaturalComparer : IComparer<string?>
{
    public static readonly NaturalComparer Instance = new();

    [GeneratedRegex(@"(\d+)")]
    private static partial Regex DigitRun();

    public int Compare(string? x, string? y)
    {
        var a = DigitRun().Split(x ?? "");
        var b = DigitRun().Split(y ?? "");
        var n = Math.Min(a.Length, b.Length);

        for (var i = 0; i < n; i++)
        {
            // Both strings were split with the same pattern, so parity alone
            // (not content) decides whether position i is a digit run.
            var isDigit = i % 2 == 1;
            int cmp;
            if (isDigit)
            {
                var na = BigInteger.Parse(a[i].Length == 0 ? "0" : a[i]);
                var nb = BigInteger.Parse(b[i].Length == 0 ? "0" : b[i]);
                cmp = na.CompareTo(nb);
            }
            else
            {
                cmp = string.Compare(a[i], b[i], StringComparison.OrdinalIgnoreCase);
            }
            if (cmp != 0) return cmp;
        }

        return a.Length.CompareTo(b.Length);
    }
}
