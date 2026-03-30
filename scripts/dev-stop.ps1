$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot "output\runtime"
$processFile = Join-Path $runtimeDir "processes.json"

if (-not (Test-Path $processFile)) {
  Write-Host "No runtime process file found."
  exit 0
}

$processes = Get-Content $processFile | ConvertFrom-Json

foreach ($process in $processes) {
  try {
    taskkill /PID $process.pid /T /F *> $null
    if ($LASTEXITCODE -ne 0) {
      Stop-Process -Id $process.pid -Force -ErrorAction Stop
    }
    Write-Host "Stopped $($process.name) (PID $($process.pid))"
  } catch {
    Write-Host "Skipped $($process.name) (PID $($process.pid))"
  }
}

Remove-Item $processFile -Force
Write-Host "Runtime process file removed."
