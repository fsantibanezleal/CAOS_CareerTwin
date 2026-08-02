[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
& (Join-Path $PSScriptRoot 'init-env.ps1')

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

& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Assert-NativeSuccess 'Database migration'
Write-Output 'CareerTwin setup complete. Run scripts\bootstrap-superuser.ps1, then scripts\dev.ps1.'
