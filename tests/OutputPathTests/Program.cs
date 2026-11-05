using System.IO;
using ProConnector;

// Same cases as test-tools.mjs outputPathProblem, plus Add-in-only drive-type rules.
string[] allowed = [
    @"D:\exports\map.png", "D:/exports/map.png", @"C:\work\out\buffer_100m", @"D:\資料\輸出 1\圖.pdf",
    @"D:\exports\.hidden\map.png", @"D:\a.b.c\report.v2.pdf"
];
string[] rejected = [
    "", "exports/map.png", @"\exports\map.png", @"\\server\share\map.png", @"\\?\D:\exports\map.png", @"\\.\D:\map.png",
    "D:map.png", @"D:\x\a.txt:s.png", @"D:\x\a.png::$DATA", @"D:\exports\NUL.png", @"D:\exports\con", @"D:\COM1\map.png",
    @"D:\exports\lpt¹.png", @"D:\exports\CONOUT$", @"D:\a\b.png.", @"D:\a\b.png ", @"D:\a.\b.png", @"D:\a\..\b.png",
    @"D:\a\.\b.png", @"D:\a\\b.png", @"D:\a\b<.png", @"D:\a\b|.png", "D:\\a\\b\u0001.png", @"D:\a\b?.png", @"D:\a\b*.png"
];
var failures = 0;
foreach (var p in allowed) if (OutputPath.Problem(p) is { } why) { failures++; Console.Error.WriteLine($"FAIL allowed rejected: {p} -> {why}"); }
foreach (var p in rejected) if (OutputPath.Problem(p) is null) { failures++; Console.Error.WriteLine($"FAIL rejected allowed: {p}"); }
if (OutputPath.Problem(null) is null) { failures++; Console.Error.WriteLine("FAIL null allowed"); }
if (OutputPath.DriveProblem(DriveType.Network) is null) { failures++; Console.Error.WriteLine("FAIL network drive allowed"); }
if (OutputPath.DriveProblem(DriveType.NoRootDirectory) is null) { failures++; Console.Error.WriteLine("FAIL missing drive allowed"); }
foreach (var t in new[] { DriveType.Fixed, DriveType.Removable, DriveType.Ram })
    if (OutputPath.DriveProblem(t) is { } why) { failures++; Console.Error.WriteLine($"FAIL {t} rejected: {why}"); }
var total = allowed.Length + rejected.Length + 6;
Console.WriteLine(failures == 0 ? $"OutputPath tests: {total} passed" : $"OutputPath tests: {failures}/{total} failed");
return failures == 0 ? 0 : 1;
