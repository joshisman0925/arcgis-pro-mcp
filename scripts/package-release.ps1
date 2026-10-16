[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$plugin = Join-Path $root 'plugins\arcgis-pro-mcp'
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('arcgis-marketplace-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path (Join-Path $scratch '.agents\plugins'), (Join-Path $scratch 'plugins') | Out-Null
Copy-Item -LiteralPath (Join-Path $root '.agents\plugins\marketplace.json') -Destination (Join-Path $scratch '.agents\plugins\marketplace.json')
Copy-Item -LiteralPath $plugin -Destination (Join-Path $scratch 'plugins') -Recurse
foreach ($file in @('INSTALL-PROMPT.md','UPDATE-PROMPT.md','COMPATIBILITY.md','LICENSE','PRIVACY.md','SECURITY.md')) { Copy-Item -LiteralPath (Join-Path $root $file) -Destination $scratch }
$pluginZip = Join-Path $dist "arcgis-pro-mcp-plugin-$version.zip"
$teamZip = Join-Path $dist "arcgis-pro-mcp-windows-$version.zip"
foreach ($zip in @($pluginZip,$teamZip)) { if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip } }
[IO.Compression.ZipFile]::CreateFromDirectory($plugin, $pluginZip)
[IO.Compression.ZipFile]::CreateFromDirectory($scratch, $teamZip)
Copy-Item -LiteralPath (Join-Path $plugin 'native\LocalProConnector.esriAddinX') -Destination (Join-Path $dist 'LocalProConnector.esriAddinX') -Force
$entries = @($pluginZip,$teamZip,(Join-Path $dist 'LocalProConnector.esriAddinX')) | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetFileName($_) }
[IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS'), $entries, [Text.UTF8Encoding]::new($false))
Write-Output "Release assets created in $dist"
