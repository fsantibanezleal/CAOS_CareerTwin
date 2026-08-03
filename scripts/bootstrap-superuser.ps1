[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$DisplayName,
  [ValidateSet('en','es')][string]$Locale = 'en',
  [switch]$Compose,
  [switch]$ForcePasswordChange
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot
Write-Output 'The password will be requested without echo and is never written by this script.'
$PasswordPolicyArgs = if ($ForcePasswordChange) { @() } else { @('--no-force-change') }
if ($Compose) {
  docker compose exec app careertwin bootstrap-superuser --email $Email --display-name $DisplayName --locale $Locale @PasswordPolicyArgs
  Assert-NativeSuccess 'Compose superuser bootstrap'
} else {
  & '.\.venv\Scripts\python.exe' -m careertwin.cli bootstrap-superuser --email $Email --display-name $DisplayName --locale $Locale @PasswordPolicyArgs
  Assert-NativeSuccess 'Superuser bootstrap'
}
