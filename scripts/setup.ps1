[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.11 or newer is required.' }
if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv; Assert-NativeSuccess 'Virtual environment creation' }
& '.\.venv\Scripts\python.exe' -m pip install --upgrade pip
Assert-NativeSuccess 'pip upgrade'
& '.\.venv\Scripts\python.exe' -m pip install -e '.[dev]'
Assert-NativeSuccess 'Python dependency installation'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js 24 LTS or newer is required.' }
$NodeVersion = node -p "process.versions.node"
Assert-NativeSuccess 'Node.js version check'
if ([Version]$NodeVersion -lt [Version]'24.0.0') { throw "Node.js 24 LTS or newer is required; found $NodeVersion." }
Push-Location frontend
try { npm ci; Assert-NativeSuccess 'Frontend dependency installation' } finally { Pop-Location }

if (-not (Test-Path '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
  $Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  function New-PrivateValue([int]$Bytes = 36) {
    $Buffer = New-Object byte[] $Bytes
    $Random.GetBytes($Buffer)
    return [Convert]::ToBase64String($Buffer).Replace('+','-').Replace('/','_').TrimEnd('=')
  }
  $EnvText = Get-Content -LiteralPath '.env' -Raw
  $EnvText = $EnvText.Replace('APP_SECRET_KEY=', "APP_SECRET_KEY=$(New-PrivateValue)")
  $EnvText = $EnvText.Replace('APP_CSRF_SECRET=', "APP_CSRF_SECRET=$(New-PrivateValue)")
  $EnvText = $EnvText.Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$(New-PrivateValue 24)")
  [System.IO.File]::WriteAllText(
    (Join-Path $RepoRoot '.env'),
    $EnvText,
    (New-Object System.Text.UTF8Encoding($false))
  )
  $Random.Dispose()
  Write-Output 'Created ignored .env with generated local secrets.'
}

& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Assert-NativeSuccess 'Database migration'
Write-Output 'CareerTwin setup complete. Run scripts\bootstrap-superuser.ps1, then scripts\dev.ps1.'
