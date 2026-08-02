[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
& '.\.venv\Scripts\python.exe' -m ruff check backend tests evals
Assert-NativeSuccess 'Ruff'
& '.\.venv\Scripts\python.exe' -m mypy backend evals
Assert-NativeSuccess 'MyPy'
& '.\.venv\Scripts\python.exe' -m pytest
Assert-NativeSuccess 'Pytest'
& '.\.venv\Scripts\python.exe' 'evals\agent_contract.py'
Assert-NativeSuccess 'Agent contract evaluation'
Push-Location frontend
try {
  npm run lint
  Assert-NativeSuccess 'Frontend lint'
  npm test
  Assert-NativeSuccess 'Frontend tests'
  npm run build
  Assert-NativeSuccess 'Frontend production build'
} finally { Pop-Location }
Write-Output 'All local quality gates passed.'
