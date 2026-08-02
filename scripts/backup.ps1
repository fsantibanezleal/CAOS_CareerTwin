[CmdletBinding()]
param([string]$OutputDirectory = 'backups\private')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackupRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputDirectory))
$RepoPrefix = $RepoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $BackupRoot.StartsWith($RepoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Backup directory must be inside the repository working copy.' }
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
if ($env:OS -eq 'Windows_NT') {
  & icacls.exe $BackupRoot /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
  Assert-NativeSuccess 'Private backup directory ACL'
}
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$DatabaseFile = Join-Path $BackupRoot "careertwin-$Stamp.sql"
$BlobFile = Join-Path $BackupRoot "careertwin-blobs-$Stamp.tar.gz"
$BlobStage = Join-Path $BackupRoot ".careertwin-blobs-$Stamp"
$BlobDirectory = Join-Path $BlobStage 'blobs'
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
New-Item -ItemType Directory -Force -Path $BlobStage | Out-Null
try {
  docker compose cp 'app:/var/lib/careertwin/blobs' $BlobDirectory
  Assert-NativeSuccess 'Blob volume copy'
  & tar.exe -czf $BlobFile -C $BlobStage blobs
  Assert-NativeSuccess 'Blob backup archive'
} finally {
  $ResolvedStage = [System.IO.Path]::GetFullPath($BlobStage)
  if (-not $ResolvedStage.StartsWith($BackupRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to clean an unexpected blob staging path.' }
  Remove-Item -LiteralPath $ResolvedStage -Recurse -Force -ErrorAction SilentlyContinue
}
if ($env:OS -eq 'Windows_NT') {
  foreach ($PrivateFile in @($DatabaseFile, $BlobFile)) {
    & icacls.exe $PrivateFile /inheritance:r /grant:r "$($env:USERNAME):F" | Out-Null
    Assert-NativeSuccess "Private backup file ACL: $PrivateFile"
  }
}
Write-Output "Private backup created under $BackupRoot. Run restore-check.ps1 before trusting it."
