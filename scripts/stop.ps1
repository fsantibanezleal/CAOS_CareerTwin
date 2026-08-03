[CmdletBinding()]
param([switch]$Docker)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
if ($Docker) { docker compose down; Assert-NativeSuccess 'Docker Compose shutdown'; exit 0 }
function Stop-CareerTwinProcessTree([int]$ProcessId, [bool]$ValidateOwnership = $true) {
  $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $Process) { return }
  if ($ValidateOwnership -and $Process.CommandLine -notlike "*$RepoRoot*") { throw "Refusing to stop stale PID $ProcessId because it does not belong to this repository." }
  Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue | ForEach-Object { Stop-CareerTwinProcessTree ([int]$_.ProcessId) $false }
  Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
}
foreach ($Name in @('api','worker','web')) {
  $PidPath = Join-Path $RepoRoot ".run\$Name.pid"
  if (Test-Path -LiteralPath $PidPath) {
    $ProcessId = [int](Get-Content -LiteralPath $PidPath -Raw)
    Stop-CareerTwinProcessTree $ProcessId
    Remove-Item -LiteralPath $PidPath -Force
  }
}
Write-Output 'CareerTwin native processes stopped.'
