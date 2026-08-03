[CmdletBinding()]
param([switch]$Docker)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
if (-not (Test-Path '.env')) { throw 'Run scripts\setup.ps1 first.' }

if ($Docker) {
  docker compose up --build -d
  Assert-NativeSuccess 'Docker Compose startup'
  docker compose ps
  Assert-NativeSuccess 'Docker Compose status'
  Write-Output 'CareerTwin is starting at http://localhost:8000.'
  exit 0
}

if (-not (Test-Path '.venv\Scripts\python.exe')) { throw 'Run scripts\setup.ps1 first; the repository .venv is missing.' }
if (-not (Test-Path 'frontend\node_modules\vite\bin\vite.js')) { throw 'Run scripts\setup.ps1 first; frontend/node_modules is missing or incomplete.' }
New-Item -ItemType Directory -Force -Path '.run' | Out-Null
foreach ($Name in @('api','worker','web')) {
  $PidPath = Join-Path $RepoRoot ".run\$Name.pid"
  if (Test-Path -LiteralPath $PidPath) {
    $RecordedId = [int](Get-Content -LiteralPath $PidPath -Raw)
    if (Get-Process -Id $RecordedId -ErrorAction SilentlyContinue) { throw "CareerTwin $Name is already running with PID $RecordedId. Run scripts\stop.ps1 first." }
    Remove-Item -LiteralPath $PidPath -Force
  }
}
& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Assert-NativeSuccess 'Database migration'
$Api = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','uvicorn','careertwin.main:app','--host','127.0.0.1','--port','8000','--reload') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput '.run\api.out.log' -RedirectStandardError '.run\api.err.log' -PassThru
$Worker = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','careertwin.worker') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput '.run\worker.out.log' -RedirectStandardError '.run\worker.err.log' -PassThru
$ViteScript = Join-Path $RepoRoot 'frontend\node_modules\vite\bin\vite.js'
$Web = Start-Process -FilePath 'node.exe' -ArgumentList @($ViteScript,'--host','127.0.0.1') -WorkingDirectory (Join-Path $RepoRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RepoRoot '.run\web.out.log') -RedirectStandardError (Join-Path $RepoRoot '.run\web.err.log') -PassThru
Set-Content -LiteralPath '.run\api.pid' -Value $Api.Id
Set-Content -LiteralPath '.run\worker.pid' -Value $Worker.Id
Set-Content -LiteralPath '.run\web.pid' -Value $Web.Id
Start-Sleep -Seconds 1
foreach ($Process in @($Api, $Worker, $Web)) {
  if ($Process.HasExited) {
    foreach ($Started in @($Api, $Worker, $Web)) { if (-not $Started.HasExited) { Stop-Process -Id $Started.Id -ErrorAction SilentlyContinue } }
    throw 'A native CareerTwin process exited during startup. Inspect ignored .run/*.err.log files.'
  }
}
Write-Output 'Native CareerTwin started: web http://127.0.0.1:5173, API http://127.0.0.1:8000, database-backed worker active.'
