[CmdletBinding()]
param(
    [string]$OutputDirectory = "data/private/taxonomies"
)
$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$TargetDirectory = Join-Path $RepoRoot $OutputDirectory
$Target = Join-Path $TargetDirectory 'db_30_3_text.zip'
$Uri = 'https://www.onetcenter.org/dl_files/database/db_30_3_text.zip'
$ExpectedSha256 = '7758ec966fd91895b3d290b83c9f1f1d46730d37fdda4faac67104d1c0d2a780'

New-Item -ItemType Directory -Force -Path $TargetDirectory | Out-Null
if (-not (Test-Path -LiteralPath $Target)) {
    Invoke-WebRequest -Uri $Uri -OutFile $Target
}
$ActualSha256 = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualSha256 -ne $ExpectedSha256) {
    throw "O*NET 30.3 archive checksum mismatch. Remove the private archive and review upstream before retrying."
}
Write-Output "Verified O*NET 30.3 at $Target (sha256=$ActualSha256)"
Write-Output "Import with: careertwin import-onet --archive `"$Target`" --release 30.3 --replace"
