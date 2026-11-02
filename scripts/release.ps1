$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
$archive = Join-Path $projectRoot ('dist\rocket-snail-' + $version + '-windows-x64.zip')
if (Test-Path -LiteralPath $archive) { throw 'Release ZIP already exists. Choose a new version or inspect the existing artifact; never overwrite it.' }
$stage = Join-Path $projectRoot ('dist\release-' + $version + '-' + [guid]::NewGuid().ToString('N'))
$appDirectory = Join-Path $stage 'RocketPet-Windows-x64'
node scripts/package.cjs $appDirectory
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
Compress-Archive -LiteralPath $appDirectory -DestinationPath $archive
$stream = [IO.File]::OpenRead($archive)
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $sha.Dispose() }
[IO.File]::WriteAllText(($archive + '.sha256'), ($hash + '  ' + [IO.Path]::GetFileName($archive) + "`n"))
Write-Output $archive
