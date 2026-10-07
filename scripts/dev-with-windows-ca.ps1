param(
  [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$localAppData = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($localAppData)) {
  $localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
}
if ([string]::IsNullOrWhiteSpace($localAppData)) {
  throw 'Could not locate the Windows Local AppData directory.'
}
$bundleDirectory = Join-Path $localAppData 'Codeforces'
$bundlePath = Join-Path $bundleDirectory 'windows-root-cas.pem'
New-Item -ItemType Directory -Path $bundleDirectory -Force | Out-Null

$certificates = Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root |
  Sort-Object -Property Thumbprint -Unique
if (-not $certificates) {
  throw 'No trusted Windows root certificates were found.'
}

$pem = [System.Text.StringBuilder]::new()
foreach ($certificate in $certificates) {
  $encoded = [Convert]::ToBase64String($certificate.RawData)
  [void]$pem.AppendLine('-----BEGIN CERTIFICATE-----')
  for ($index = 0; $index -lt $encoded.Length; $index += 64) {
    [void]$pem.AppendLine($encoded.Substring($index, [Math]::Min(64, $encoded.Length - $index)))
  }
  [void]$pem.AppendLine('-----END CERTIFICATE-----')
}
[System.IO.File]::WriteAllText($bundlePath, $pem.ToString(), [System.Text.Encoding]::ASCII)

if ($PrepareOnly) {
  Write-Output $bundlePath
  exit 0
}

$env:NODE_EXTRA_CA_CERTS = $bundlePath
Push-Location $repoRoot
try {
  npm run dev:turbo
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}