[CmdletBinding()]
param([switch]$Code)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
if (-not $Code) { docker compose down; Assert-NativeSuccess 'Docker Compose shutdown'; exit 0 }
foreach ($Name in @('api','web')) {
  $PidPath = Join-Path $RepoRoot ".run\$Name.pid"
  if (Test-Path -LiteralPath $PidPath) {
    $ProcessId = [int](Get-Content -LiteralPath $PidPath -Raw)
    Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $PidPath -Force
  }
}
Write-Output 'CareerTwin code-mode processes stopped.'
