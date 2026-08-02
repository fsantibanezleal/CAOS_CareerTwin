function Assert-NativeSuccess {
  [CmdletBinding()]
  param([Parameter(Mandatory=$true)][string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with native exit code $LASTEXITCODE."
  }
}
