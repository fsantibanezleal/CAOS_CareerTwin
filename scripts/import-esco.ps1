[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Archive,
  [ValidateSet('en','es')][string]$Language = 'en',
  [switch]$Replace
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ArchivePath = (Resolve-Path -LiteralPath $Archive).Path
Set-Location $RepoRoot
$Arguments = @('-m','careertwin.cli','import-esco','--archive',$ArchivePath,'--language',$Language)
if ($Replace) { $Arguments += '--replace' }
& '.\.venv\Scripts\python.exe' @Arguments
Assert-NativeSuccess 'ESCO import'
