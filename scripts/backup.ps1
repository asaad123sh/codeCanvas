$ErrorActionPreference = 'Stop'
$root = 'D:\.Projs\WPR'
$src = Join-Path $root 'web-builder'

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$folder = 'web-builder-backup-' + $stamp
$out = Join-Path $root ($folder + '.zip')
$stage = Join-Path $env:TEMP ('wbstage-' + $stamp)

$skip = @('node_modules', '.npm-cache', '.smoke', 'live', 'dist', '.git', '.vite')
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

Get-ChildItem -Path $src -Recurse -File -Force | ForEach-Object {
  $rel = $_.FullName.Substring($src.Length + 1)
  $parts = $rel.Split([char]92)
  $skipIt = $false
  foreach ($p in $parts) { if ($skip -contains $p) { $skipIt = $true } }
  if ($skipIt) { return }
  $dest = Join-Path $stage $rel
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}

$bat = Join-Path $root 'run-builder.bat'
if (Test-Path $bat) { Copy-Item -LiteralPath $bat -Destination (Join-Path $stage 'run-builder.bat') -Force }

if (Test-Path $out) { Remove-Item -LiteralPath $out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -CompressionLevel Optimal
Remove-Item -LiteralPath $stage -Recurse -Force

$zi = Get-Item -LiteralPath $out
Write-Output ('ARCHIVE: ' + $zi.FullName)
Write-Output ('BYTES: ' + $zi.Length)
Write-Output ('WHEN: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($out)
Write-Output ('ENTRIES: ' + $zip.Entries.Count)
$zip.Dispose()
