[CmdletBinding()]
param([string]$Url = 'http://127.0.0.1:8000')
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'test.ps1')
$Live = Invoke-RestMethod "$Url/api/health/live"
if ($Live.status -ne 'ok') { throw 'Liveness verification failed.' }
$Headers = Invoke-WebRequest -UseBasicParsing "$Url/"
foreach ($Name in @('X-Content-Type-Options','X-Frame-Options','Content-Security-Policy')) {
  if (-not $Headers.Headers[$Name]) { throw "Missing response security header: $Name" }
}
Write-Output 'Runtime and response-security verification passed.'
