[CmdletBinding()]
param([string]$ProInstallDir, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$pluginRoot = Split-Path $PSScriptRoot -Parent
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Native Windows is required.' }
if (!$ProInstallDir) {
    $proKey = Get-ItemProperty 'HKLM:\SOFTWARE\ESRI\ArcGISPro' -ErrorAction SilentlyContinue
    $ProInstallDir = $proKey.InstallDir
    if (!$ProInstallDir) { $ProInstallDir = Join-Path $env:ProgramFiles 'ArcGIS\Pro' }
}
$proExe = Join-Path $ProInstallDir 'bin\ArcGISPro.exe'
if (!(Test-Path -LiteralPath $proExe)) { throw 'ArcGIS Pro was not found. Supply -ProInstallDir.' }
$proVersion = [version](Get-Item -LiteralPath $proExe).VersionInfo.ProductVersion
if ($proVersion.Major -ne 3 -or $proVersion.Minor -lt 3) { throw "Pro $proVersion is not supported by this .NET 8 package; requires Pro 3.3 or a later 3.x." }
$native = Join-Path $pluginRoot 'native\LocalProConnector.esriAddinX'
$checksums = Get-Content -LiteralPath (Join-Path $pluginRoot 'native\checksums.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $native -Algorithm SHA256).Hash -ne $checksums.sha256) { throw 'Bundled Add-in checksum mismatch; obtain a clean package.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Get-AddinVersion([string]$Path) {
    $archive = [IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $archive.GetEntry('Config.daml')
        if (!$entry) { throw "Config.daml is missing in $Path" }
        $reader = [IO.StreamReader]::new($entry.Open())
        try { [xml]$daml = $reader.ReadToEnd() } finally { $reader.Dispose() }
        return [version]$daml.ArcGIS.AddInInfo.version
    } finally { $archive.Dispose() }
}
$bundledVersion = Get-AddinVersion $native
if ($bundledVersion -ne [version]$checksums.version) { throw 'Bundled Add-in version does not match checksums.json.' }
$targetDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'ArcGIS\AddIns\ArcGISPro\{969AD37B-DF15-46C7-ABF6-A4338D351C58}'
$target = Join-Path $targetDir 'LocalProConnector.esriAddinX'
$unchanged = (Test-Path -LiteralPath $target) -and ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $checksums.sha256)
$installedVersion = if (Test-Path -LiteralPath $target) { Get-AddinVersion $target } else { $null }
$downgrade = $null -ne $installedVersion -and $installedVersion -gt $bundledVersion
$status = [ordered]@{ proVersion = $proVersion.ToString(); compatibility = $(if ($proVersion.Minor -eq 3) { 'tested baseline' } else { 'forward-compatibility candidate; not locally tested' }); packageVersion = $checksums.version; installedVersion = $(if ($installedVersion) { $installedVersion.ToString() } else { $null }); target = $target; packageAlreadyMatches = $unchanged; updateRequired = !$unchanged; downgradeBlocked = $downgrade; runtimeVerificationRequired = $true; checkOnly = [bool]$CheckOnly }
if ($CheckOnly) { $status | ConvertTo-Json; exit 0 }
if ($downgrade) { throw "Installed Add-in $installedVersion is newer than bundled $bundledVersion. Obtain a newer plugin; automatic downgrade is blocked." }
if ($unchanged) { $status['result'] = 'Already installed. Runtime version still requires ping verification.'; $status | ConvertTo-Json; exit 0 }
if (@(Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue).Count) { throw 'Save your work and close Pro, then rerun setup. Pro will not be stopped automatically.' }
$backupDir = Join-Path $env:LOCALAPPDATA 'ArcGISProMcp\backups'
if (Test-Path -LiteralPath $target) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -LiteralPath $target -Destination (Join-Path $backupDir ('LocalProConnector-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.esriAddinX'))
}
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $native -Destination $target -Force
$status['result'] = 'Installed. Normally open Pro and verify the loaded version with MCP ping.'
$status | ConvertTo-Json
