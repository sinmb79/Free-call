param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

function Remove-IfExists([string]$Path) {
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
    Write-Host "Removed $Path"
  }
}

function Get-MatchingDirectories([string]$BasePath, [string[]]$Patterns) {
  if (-not (Test-Path $BasePath)) {
    return @()
  }

  $matches = @()
  foreach ($pattern in $Patterns) {
    $matches += Get-ChildItem -Path $BasePath -Directory -Filter $pattern -Recurse -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty FullName
  }

  return $matches | Sort-Object -Unique
}

Write-Host ""
Write-Host "== IwootCall Local Cleanup =="
Write-Host "Project root: $ProjectRoot"

$pathsToRemove = @(
  (Join-Path $ProjectRoot "output"),
  (Join-Path $ProjectRoot ".turbo"),
  (Join-Path $ProjectRoot "coverage"),
  (Join-Path $ProjectRoot "dist")
)

$pathsToRemove += Get-MatchingDirectories -BasePath (Join-Path $ProjectRoot "apps") -Patterns @(".next", ".turbo", "dist")
$pathsToRemove += Get-MatchingDirectories -BasePath (Join-Path $ProjectRoot "packages") -Patterns @(".turbo", "dist")

foreach ($path in ($pathsToRemove | Sort-Object -Unique)) {
  Remove-IfExists -Path $path
}

Write-Host "Local generated outputs have been cleaned."
