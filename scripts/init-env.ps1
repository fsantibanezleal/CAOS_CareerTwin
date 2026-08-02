[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Destination = Join-Path $RepoRoot '.env'
if (Test-Path -LiteralPath $Destination) {
  Write-Output 'Using existing ignored .env; no values were changed.'
  exit 0
}

Copy-Item -LiteralPath (Join-Path $RepoRoot '.env.example') -Destination $Destination
$Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  function New-PrivateValue([int]$Bytes = 36) {
    $Buffer = New-Object byte[] $Bytes
    $Random.GetBytes($Buffer)
    return [Convert]::ToBase64String($Buffer).Replace('+','-').Replace('/','_').TrimEnd('=')
  }
  $EnvText = Get-Content -LiteralPath $Destination -Raw
  $EnvText = $EnvText.Replace('APP_SECRET_KEY=', "APP_SECRET_KEY=$(New-PrivateValue)")
  $EnvText = $EnvText.Replace('APP_CSRF_SECRET=', "APP_CSRF_SECRET=$(New-PrivateValue)")
  $EnvText = $EnvText.Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$(New-PrivateValue 24)")
  $EnvText = $EnvText.Replace('BLOB_ENCRYPTION_KEY=', "BLOB_ENCRYPTION_KEY=$(New-PrivateValue 32)")
  $EnvText = $EnvText.Replace('CONNECTOR_ENCRYPTION_KEY=', "CONNECTOR_ENCRYPTION_KEY=$(New-PrivateValue 32)")
  $EnvText = $EnvText.Replace('DOCLING_API_KEY=', "DOCLING_API_KEY=$(New-PrivateValue 32)")
  [System.IO.File]::WriteAllText(
    $Destination,
    $EnvText,
    (New-Object System.Text.UTF8Encoding($false))
  )
} finally {
  $Random.Dispose()
}
Write-Output 'Created ignored .env with generated local secrets.'
