using System.IO;
using System.Text.RegularExpressions;

namespace ProConnector;

/// <summary>
/// Pure output-path rules shared by every tool that writes a new file. Mirrors outputPathProblem() in tools.mjs so
/// a same-user process calling the Named Pipe directly cannot use Win32 path aliases to bypass "new files only".
/// No ArcGIS dependency, so tests/OutputPathTests can compile it on a machine without ArcGIS Pro.
/// </summary>
internal static partial class OutputPath
{
    [GeneratedRegex(@"^[a-zA-Z]:[\\/]")] private static partial Regex DriveRoot();
    [GeneratedRegex(@"[\u0000-\u001f<>:""|?*]")] private static partial Regex ReservedChar();
    [GeneratedRegex(@"^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)", RegexOptions.IgnoreCase)] private static partial Regex ReservedName();

    /// <summary>Returns null when the raw path text is acceptable, otherwise the reason. Checks text before Win32 normalization.</summary>
    internal static string? Problem(string? path)
    {
        if (string.IsNullOrEmpty(path) || !DriveRoot().IsMatch(path)) return "Output must be an absolute local Windows path (drive letter; no UNC or device prefix).";
        var rest = path[3..];
        if (ReservedChar().IsMatch(rest)) return "Output path contains a character Windows reserves (including : for alternate data streams).";
        var segments = rest.Split(['\\', '/']);
        if (segments.Contains("..")) return "Output must be an absolute local Windows path without traversal.";
        if (segments.Any(s => s.Length == 0 || s == "." || s.EndsWith('.') || s.EndsWith(' '))) return "Output path segments must not be empty, \".\", or end with a dot or space.";
        if (segments.Any(s => ReservedName().IsMatch(s))) return "Output path must not use a reserved Windows device name.";
        return null;
    }

    /// <summary>Rejects drive letters mapped to network shares; outputs must stay on this computer.</summary>
    internal static string? DriveProblem(DriveType type) => type switch {
        DriveType.Network => "Output must be on a local drive; mapped network drives are not allowed.",
        DriveType.NoRootDirectory => "Output drive does not exist.",
        _ => null
    };
}
