[CmdletBinding()]
param([string]$OutputDirectory = 'backups\private')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackupRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputDirectory))
if (-not $BackupRoot.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Backup directory must be inside the repository working copy.' }
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
if ($env:OS -eq 'Windows_NT') {
  & icacls.exe $BackupRoot /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
  Assert-NativeSuccess 'Private backup directory ACL'
}
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DatabaseFile = Join-Path $BackupRoot "careertwin-$Stamp.sql"
$BlobFile = Join-Path $BackupRoot "careertwin-blobs-$Stamp.tar.gz"
$ContainerDatabaseFile = '/tmp/careertwin-database-backup.sql'
Set-Location $RepoRoot
try {
  docker compose exec -T db pg_dump --clean --if-exists --no-owner -U careertwin -d careertwin --file=$ContainerDatabaseFile
  Assert-NativeSuccess 'PostgreSQL backup'
  docker compose cp "db:$ContainerDatabaseFile" $DatabaseFile
  Assert-NativeSuccess 'Database backup copy'
} finally {
  docker compose exec -T db rm -f $ContainerDatabaseFile
}
docker compose exec -T app tar -czf /tmp/careertwin-blobs-backup.tar.gz -C /var/lib/careertwin blobs
Assert-NativeSuccess 'Blob backup'
docker compose cp app:/tmp/careertwin-blobs-backup.tar.gz $BlobFile
Assert-NativeSuccess 'Blob backup copy'
docker compose exec -T app rm -f /tmp/careertwin-blobs-backup.tar.gz
if ($env:OS -eq 'Windows_NT') {
  foreach ($PrivateFile in @($DatabaseFile, $BlobFile)) {
    & icacls.exe $PrivateFile /inheritance:r /grant:r "$($env:USERNAME):F" | Out-Null
    Assert-NativeSuccess "Private backup file ACL: $PrivateFile"
  }
}
Write-Output "Private backup created under $BackupRoot. Run restore-check.ps1 before trusting it."
