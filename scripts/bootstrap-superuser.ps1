[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$DisplayName,
  [ValidateSet('en','es')][string]$Locale = 'en',
  [switch]$Compose
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
Write-Output 'The temporary password will be requested without echo and is never written by this script.'
if ($Compose) {
  docker compose exec app careertwin bootstrap-superuser --email $Email --display-name $DisplayName --locale $Locale
  Assert-NativeSuccess 'Compose superuser bootstrap'
} else {
  & '.\.venv\Scripts\python.exe' -m careertwin.cli bootstrap-superuser --email $Email --display-name $DisplayName --locale $Locale
  Assert-NativeSuccess 'Superuser bootstrap'
}
