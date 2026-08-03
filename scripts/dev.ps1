[CmdletBinding()]
param(
  [switch]$Docker,
  [ValidateRange(0,65535)][int]$ApiPort = 0,
  [ValidateRange(0,65535)][int]$WebPort = 0
)
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
$ApiPort = if ($ApiPort) { $ApiPort } elseif ($env:CAREERTWIN_API_PORT) { [int]$env:CAREERTWIN_API_PORT } else { 8000 }
$WebPort = if ($WebPort) { $WebPort } elseif ($env:CAREERTWIN_WEB_PORT) { [int]$env:CAREERTWIN_WEB_PORT } else { 5173 }
if ($ApiPort -eq $WebPort) { throw 'API and web ports must be different.' }
function Test-LoopbackPortAvailable([int]$Port) {
  $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  try { $Listener.Start(); return $true } catch [System.Net.Sockets.SocketException] { return $false } finally { $Listener.Stop() }
}
foreach ($Port in @($ApiPort, $WebPort)) {
  if (-not (Test-LoopbackPortAvailable $Port)) { throw "Loopback port $Port is already in use. Choose -ApiPort/-WebPort or stop the owning application." }
}
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
$PreviousApiPort = $env:CAREERTWIN_API_PORT
$PreviousWebPort = $env:CAREERTWIN_WEB_PORT
try {
  $env:CAREERTWIN_API_PORT = [string]$ApiPort
  $env:CAREERTWIN_WEB_PORT = [string]$WebPort
  $Api = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','uvicorn','careertwin.main:app','--host','127.0.0.1','--port',[string]$ApiPort) -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput '.run\api.out.log' -RedirectStandardError '.run\api.err.log' -PassThru
  $Worker = Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','careertwin.worker') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput '.run\worker.out.log' -RedirectStandardError '.run\worker.err.log' -PassThru
  $ViteScript = Join-Path $RepoRoot 'frontend\node_modules\vite\bin\vite.js'
  $Web = Start-Process -FilePath 'node.exe' -ArgumentList @($ViteScript,'--host','127.0.0.1','--port',[string]$WebPort,'--strictPort') -WorkingDirectory (Join-Path $RepoRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $RepoRoot '.run\web.out.log') -RedirectStandardError (Join-Path $RepoRoot '.run\web.err.log') -PassThru
  Set-Content -LiteralPath '.run\api.pid' -Value $Api.Id
  Set-Content -LiteralPath '.run\worker.pid' -Value $Worker.Id
  Set-Content -LiteralPath '.run\web.pid' -Value $Web.Id
  Start-Sleep -Seconds 2
  foreach ($Process in @($Api, $Worker, $Web)) {
    if ($Process.HasExited) {
      & (Join-Path $PSScriptRoot 'stop.ps1')
      throw 'A native CareerTwin process exited during startup. Inspect ignored .run/*.err.log files.'
    }
  }
} finally {
  $env:CAREERTWIN_API_PORT = $PreviousApiPort
  $env:CAREERTWIN_WEB_PORT = $PreviousWebPort
}
Write-Output "Native CareerTwin started: web http://127.0.0.1:$WebPort, API http://127.0.0.1:$ApiPort, database-backed worker active."
