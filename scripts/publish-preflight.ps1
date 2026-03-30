$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$criticalPatterns = @(
  ".env",
  ".env.local",
  "*.pem",
  "*.pfx",
  "*.p12",
  "*.key",
  "*.crt"
)

$warningPatterns = @(
  "*.log",
  "coverage",
  "dist",
  ".turbo",
  "output"
)

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "== $Title =="
}

function Resolve-Matches([string[]]$Patterns) {
  $results = @()
  foreach ($pattern in $Patterns) {
    $items = Get-ChildItem -Path $projectRoot -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and $_.Name -like $pattern
      }

    foreach ($item in $items) {
      $results += $item.FullName
    }
  }

  return $results | Sort-Object -Unique
}

Write-Section "IwootCall Publish Preflight"
Write-Host "Project root: $projectRoot"

$criticalMatches = Resolve-Matches -Patterns $criticalPatterns
$warningMatches = Resolve-Matches -Patterns $warningPatterns

Write-Section "Critical Local Files"
if ($criticalMatches.Count -eq 0) {
  Write-Host "PASS: No critical local files were found."
} else {
  foreach ($match in $criticalMatches) {
    Write-Host "WARN: $match"
  }
  Write-Host "These files must stay out of GitHub."
}

Write-Section "Generated Or Local-Only Outputs"
if ($warningMatches.Count -eq 0) {
  Write-Host "PASS: No generated outputs were found."
} else {
  foreach ($match in $warningMatches) {
    Write-Host "INFO: $match"
  }
}

Write-Section "Git Repository"
cmd /c "git rev-parse --is-inside-work-tree 2>nul" | Out-Null
$isGitRepo = $LASTEXITCODE -eq 0

if (-not $isGitRepo) {
  Write-Host "INFO: This folder is not a Git repository yet."
  Write-Host "Run 'git init -b main' before your first public push."
  exit 0
}

$trackedFiles = git ls-files
$trackedCritical = @()
foreach ($file in $trackedFiles) {
  if (
    $file -eq ".env" -or
    $file -like ".env.*" -and $file -ne ".env.example" -or
    $file -like "*.pem" -or
    $file -like "*.pfx" -or
    $file -like "*.p12" -or
    $file -like "*.key" -or
    $file -like "*.crt"
  ) {
    $trackedCritical += $file
  }
}

if ($trackedCritical.Count -gt 0) {
  Write-Section "Tracked Sensitive Files"
  foreach ($file in $trackedCritical) {
    Write-Host "FAIL: $file"
  }
  throw "Tracked sensitive files detected. Remove them before publishing."
}

Write-Section "Tracked Sensitive Files"
Write-Host "PASS: No tracked sensitive files were found."
