param([switch]$Settings)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$executable = Join-Path $projectRoot 'dist\RocketPet-Windows-x64\RocketPet.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Run npm run package first.' }
# Tool-hosted child processes can inherit a Windows Job Object and be terminated
# when that tool session ends. WMI launches the app independently of that job.
$arguments = if ($Settings) { '--settings' } else { '--startup' }
$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = ('"' + $executable + '" ' + $arguments)
    CurrentDirectory = Split-Path -Parent $executable
    ProcessStartupInformation = $startup
}
if ($result.ReturnValue -ne 0) { throw ('Windows launch failed: ' + $result.ReturnValue) }
Write-Output ('Rocket Snail process: ' + $result.ProcessId)
