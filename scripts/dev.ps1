[CmdletBinding()]
param([switch]$Code)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
if (-not (Test-Path '.env')) { throw 'Run scripts\setup.ps1 first.' }

if (-not $Code) {
  docker compose up --build -d
  Assert-NativeSuccess 'Docker Compose startup'
  docker compose ps
  Assert-NativeSuccess 'Docker Compose status'
  Write-Output 'CareerTwin is starting at http://localhost:8000.'
  exit 0
}

New-Item -ItemType Directory -Force -Path '.run' | Out-Null
& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Assert-NativeSuccess 'Database migration'
$Api = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','uvicorn','careertwin.main:app','--host','127.0.0.1','--port','8000','--reload') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput '.run\api.out.log' -RedirectStandardError '.run\api.err.log' -PassThru
$Web = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev') -WorkingDirectory (Join-Path $RepoRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RepoRoot '.run\web.out.log') -RedirectStandardError (Join-Path $RepoRoot '.run\web.err.log') -PassThru
Set-Content -LiteralPath '.run\api.pid' -Value $Api.Id
Set-Content -LiteralPath '.run\web.pid' -Value $Web.Id
Write-Output 'Code mode started: web http://127.0.0.1:5173, API http://127.0.0.1:8000.'
