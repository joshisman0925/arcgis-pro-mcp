[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$package = Join-Path $root 'plugins/arcgis-pro-mcp/native/LocalProConnector.esriAddinX'
$archive = [IO.Compression.ZipFile]::OpenRead($package)
try {
    if (@($archive.Entries | Where-Object { $_.FullName -match '\.pdb$' }).Count) { throw 'Published package must not contain PDB files.' }
    $entry = $archive.GetEntry('Install/ProConnector.dll')
    if (!$entry) { throw 'Published package is missing ProConnector.dll.' }
    $stream = $entry.Open()
    $memory = [IO.MemoryStream]::new()
    try {
        $stream.CopyTo($memory)
        $bytes = $memory.ToArray()
        foreach ($encoding in @([Text.Encoding]::UTF8, [Text.Encoding]::Unicode)) {
            $text = $encoding.GetString($bytes)
            # Never print the matched private path to public CI logs.
            if ($text -match '(?i)[A-Z]:[\\/]|\\\\[^\s\x00]+[\\/]|/Users/|/home/|/runner/work/|/a/[^/]+/[^/]+/') {
                throw 'Published DLL contains an absolute local path; rebuild with sanitized Release settings.'
            }
        }
    } finally { $stream.Dispose(); $memory.Dispose() }
} finally { $archive.Dispose() }
Write-Output 'Published Add-in contains no PDB or detected absolute build path.'
