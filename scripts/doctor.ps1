[CmdletBinding()]
param([string]$Url = 'http://127.0.0.1:8000')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
Write-Output "python: $(python --version 2>&1)"
Write-Output "node: $(node --version 2>&1)"
Write-Output "git: $(git --version 2>&1)"
if (Get-Command docker -ErrorAction SilentlyContinue) { Write-Output "docker: $(docker --version 2>&1)" }
if (Test-Path '.venv\Scripts\python.exe') {
  & '.\.venv\Scripts\python.exe' -m careertwin.cli doctor
  Assert-NativeSuccess 'CareerTwin doctor'
}
try {
  $Live = Invoke-RestMethod "$Url/api/health/live"
  Write-Output "liveness: $($Live.status) version=$($Live.version)"
  $Ready = Invoke-RestMethod "$Url/api/health/ready"
  Write-Output "readiness: $($Ready.status)"
} catch { Write-Output 'runtime: not reachable (start it with scripts\dev.ps1)' }
