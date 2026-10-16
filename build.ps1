$ErrorActionPreference = 'Stop'
& dotnet build "$PSScriptRoot/addin/Connector.csproj" -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archivePath = Join-Path $PSScriptRoot ('LocalProConnector.' + [guid]::NewGuid().ToString('N') + '.tmp')
$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, "$PSScriptRoot/addin/Config.daml", 'Config.daml') | Out-Null
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, "$PSScriptRoot/addin/bin/Release/net8.0-windows/ProConnector.dll", 'Install/ProConnector.dll') | Out-Null
} finally { $archive.Dispose() }
Move-Item -LiteralPath $archivePath -Destination "$PSScriptRoot/LocalProConnector.esriAddinX" -Force
Write-Host "Created LocalProConnector.esriAddinX"
