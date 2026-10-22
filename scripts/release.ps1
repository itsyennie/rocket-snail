$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
$stage = Join-Path $projectRoot ('dist\release-' + $version + '-' + [guid]::NewGuid().ToString('N'))
$appDirectory = Join-Path $stage 'RocketPet-Windows-x64'
node scripts/package.cjs $appDirectory
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
$archive = Join-Path $projectRoot ('dist\rocket-snail-' + $version + '-windows-x64.zip')
Compress-Archive -LiteralPath $appDirectory -DestinationPath $archive -Force
$stream = [IO.File]::OpenRead($archive)
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
finally { $stream.Dispose(); $sha.Dispose() }
[IO.File]::WriteAllText(($archive + '.sha256'), ($hash + '  ' + [IO.Path]::GetFileName($archive) + "`n"))
Write-Output $archive
