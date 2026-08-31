[CmdletBinding(PositionalBinding=$false)]
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$HarnessArgs)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Python = Join-Path $RepoRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) { throw 'Run scripts\setup.ps1 first; the repository .venv is missing.' }
& $Python -m careertwin.harness @HarnessArgs
if ($LASTEXITCODE -ne 0) { throw "CareerTwin harness failed with exit code $LASTEXITCODE." }
