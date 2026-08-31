[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
& (Join-Path $PSScriptRoot 'init-env.ps1')

if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.11 or newer is required.' }
$PythonVersion = python -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
Assert-NativeSuccess 'Python version check'
if ([Version]$PythonVersion -lt [Version]'3.11.0') { throw "Python 3.11 or newer is required; found $PythonVersion." }
if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv; Assert-NativeSuccess 'Virtual environment creation' }
& '.\.venv\Scripts\python.exe' -m pip install --upgrade pip
Assert-NativeSuccess 'pip upgrade'
& '.\.venv\Scripts\python.exe' -m pip install -e '.[dev,observability]'
Assert-NativeSuccess 'Python dependency installation'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 LTS is required.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm 11 is required.' }
$NodeVersion = node -p "process.versions.node"
Assert-NativeSuccess 'Node.js version check'
if ([Version]$NodeVersion -lt [Version]'24.0.0' -or [Version]$NodeVersion -ge [Version]'25.0.0') { throw "Node.js 24 LTS is required; found $NodeVersion." }
$NpmVersion = npm --version
Assert-NativeSuccess 'npm version check'
if ([Version]$NpmVersion -lt [Version]'11.0.0' -or [Version]$NpmVersion -ge [Version]'12.0.0') { throw "npm 11 is required; found $NpmVersion." }
if (-not (Test-Path 'frontend\package-lock.json')) { throw 'frontend/package-lock.json is required for a reproducible install.' }
Push-Location frontend
try { npm ci --no-audit --no-fund; Assert-NativeSuccess 'Locked frontend dependency installation' } finally { Pop-Location }

& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Assert-NativeSuccess 'Database migration'
Write-Output 'CareerTwin native setup complete in .venv. Run scripts\bootstrap-superuser.ps1, then scripts\dev.ps1.'
