param(
  [string]$Root = "E:\проекты пеепе шнейне втфаааа\Нексо\Нексо"
)

$ErrorActionPreference = 'SilentlyContinue'

try {
  $files = Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue
} catch {
  $files = @()
}

# Find duplicate files by size first, then hash
$groupsByLength = $files | Group-Object Length | Where-Object { $_.Count -gt 1 }
$duplicateCandidates = @()
foreach ($g in $groupsByLength) {
  $filesInGroup = $g.Group
  $hashes = foreach ($f in $filesInGroup) {
    try {
      $h = Get-FileHash -Algorithm SHA256 -LiteralPath $f.FullName -ErrorAction Stop
      [PSCustomObject]@{
        Path = $f.FullName
        Length = $f.Length
        Hash = $h.Hash
      }
    } catch {}
  }
  $dupes = $hashes | Group-Object Hash | Where-Object { $_.Name -and $_.Count -gt 1 }
  foreach ($d in $dupes) {
    $paths = $d.Group | Select-Object -ExpandProperty Path
    $duplicateCandidates += [PSCustomObject]@{
      Hash = $d.Name
      Length = $d.Group[0].Length
      Count = $d.Count
      Paths = $paths
    }
  }
}

# Junk files
$junkPatterns = @(
  'Thumbs.db','ehthumbs.db','.DS_Store','desktop.ini',
  '*.log','*.tmp','*.bak','*.old','*.orig','*.rej','*.swp','*.swo','*~'
)
$junkFilesSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($pat in $junkPatterns) {
  try {
    Get-ChildItem -LiteralPath $Root -Recurse -File -Filter $pat -ErrorAction SilentlyContinue | ForEach-Object {
      [void]$junkFilesSet.Add($_.FullName)
    }
  } catch {}
}
$junkFiles = $junkFilesSet.ToArray() | Sort-Object

# Junk directories (build caches, virtual envs, IDE settings, etc.)
$junkDirNames = @(
  'node_modules','dist','build','.next','.parcel-cache','.turbo','.cache',
  '.gradle','out','coverage','.nyc_output','.pytest_cache','__pycache__',
  '.venv','.idea','.vscode','.sass-cache','.angular','bin','obj'
)
try {
  $junkDirs = Get-ChildItem -LiteralPath $Root -Recurse -Directory -ErrorAction SilentlyContinue |
    Where-Object { $junkDirNames -contains $_.Name } |
    Select-Object -ExpandProperty FullName |
    Sort-Object -Unique
} catch {
  $junkDirs = @()
}

# Zero-byte files
$zeroByteFiles = $files | Where-Object { $_.Length -eq 0 } | Select-Object -ExpandProperty FullName

$result = [PSCustomObject]@{
  Root = $Root
  DuplicateGroups = $duplicateCandidates | Sort-Object Count -Descending
  JunkFiles = $junkFiles
  JunkDirs = $junkDirs
  ZeroByteFiles = $zeroByteFiles
}

$result | ConvertTo-Json -Depth 6