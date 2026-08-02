[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$DatabaseBackup)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_native.ps1')
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackupPath = (Resolve-Path -LiteralPath $DatabaseBackup).Path
if (-not $BackupPath.StartsWith($RepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Restore-check input must be an explicitly selected file inside this working copy.' }
$CheckDatabase = 'careertwin_restore_check'
$ContainerBackup = '/tmp/careertwin-restore-check.sql'
Set-Location $RepoRoot
docker compose cp $BackupPath "db:$ContainerBackup"
Assert-NativeSuccess 'Restore-check backup copy'
docker compose exec -T db dropdb --if-exists -U careertwin $CheckDatabase
Assert-NativeSuccess 'Restore-check database cleanup'
docker compose exec -T db createdb -U careertwin $CheckDatabase
Assert-NativeSuccess 'Restore-check database creation'
try {
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U careertwin -d $CheckDatabase --file=$ContainerBackup
  Assert-NativeSuccess 'Database restore check'
  docker compose exec -T db psql -U careertwin -d $CheckDatabase -c 'SELECT count(*) AS schema_tables FROM information_schema.tables WHERE table_schema = ''public'';'
  Assert-NativeSuccess 'Restored schema query'
  Write-Output 'Isolated database restore check passed.'
} finally {
  docker compose exec -T db rm -f $ContainerBackup
  docker compose exec -T db dropdb --if-exists -U careertwin $CheckDatabase
}
