param([Parameter(Mandatory=$true)][string]$SourceProfile)
$ErrorActionPreference = 'Stop'
# Run from ordinary Windows PowerShell, outside packaged development tools.
# Keep the encrypted credential and Electron encryption key together.
$destination = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'DexterRocketPet'
$source = (Resolve-Path -LiteralPath $SourceProfile).Path
if ($source -eq $destination) { throw 'Source and destination must differ.' }
if (Get-Process -Name RocketPet -ErrorAction SilentlyContinue) { throw 'Close Rocket Pet before restoring.' }
foreach ($name in @('state.json','credential.bin','Local State')) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $name) -PathType Leaf)) { throw ('Missing profile file: ' + $name) }
}
if (Test-Path -LiteralPath (Join-Path $destination 'state.json')) { throw 'Destination already has settings; refusing to overwrite.' }
if (Test-Path -LiteralPath (Join-Path $destination 'credential.bin')) { throw 'Destination already has credentials; refusing to overwrite.' }
try { $saved = Get-Content -LiteralPath (Join-Path $source 'state.json') -Raw -Encoding UTF8 | ConvertFrom-Json }
catch { throw 'Source settings are not valid UTF-8 JSON.' }
if (-not $saved.settings.baseUrl -or -not $saved.settings.userId) { throw 'Source has no configured account.' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$backup = Join-Path $destination ('before-restore-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backup | Out-Null
if (Test-Path -LiteralPath (Join-Path $destination 'Local State')) {
    Copy-Item -LiteralPath (Join-Path $destination 'Local State') -Destination $backup
}
foreach ($name in @('Local State','credential.bin','state.json')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $destination $name)
}
Write-Output 'Profile restored. Original files retained. Start Rocket Snail normally.'
