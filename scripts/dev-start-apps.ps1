param(
  [string]$ApiBaseUrl = "http://localhost:3001",
  [string]$CustomerAppUrl = "http://localhost:3101",
  [string]$WorkerAppUrl = "http://localhost:3102",
  [string]$AdminAppUrl = "http://localhost:3103",
  [string]$ApiCommand = "",
  [string]$CustomerCommand = "",
  [string]$WorkerCommand = "",
  [string]$AdminCommand = "",
  [string]$DatabaseHost = "localhost",
  [int]$DatabasePort = 5432,
  [string]$RedisHost = "localhost",
  [int]$RedisPort = 6379,
  [int]$StartupGraceSeconds = 3,
  [int]$ReadinessTimeoutSeconds = 45,
  [switch]$SkipDependencyCheck,
  [switch]$SkipReadinessCheck
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot "output\runtime"
$processFile = Join-Path $runtimeDir "processes.json"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Set-Location $projectRoot

function Test-CommandExists([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-EnvFile() {
  if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
  }
}

function Test-PortOpen(
  [string]$HostName,
  [int]$Port
) {
  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne(1000, $false)
    if (-not $connected) {
      return $false
    }

    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Start-AppProcess(
  [string]$Name,
  [string]$Command
) {
  $timestamp = Get-Date -Format "yyyyMMddHHmmssfff"
  $stdout = Join-Path $runtimeDir "$Name-$timestamp.log"
  $stderr = Join-Path $runtimeDir "$Name-$timestamp.err.log"
  $encodedCommand = [Convert]::ToBase64String(
    [System.Text.Encoding]::Unicode.GetBytes($Command)
  )

  $process = Start-Process powershell `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

  return [pscustomobject]@{
    name = $Name
    pid = $process.Id
    handle = $process
    stdout = $stdout
    stderr = $stderr
  }
}

function Stop-AppProcesses([object[]]$Processes) {
  foreach ($process in $Processes) {
    try {
      taskkill /PID $process.pid /T /F *> $null
      if ($LASTEXITCODE -ne 0) {
        if ($process.handle) {
          $process.handle.Refresh()
          if (-not $process.handle.HasExited) {
            $process.handle.Kill()
            $process.handle.WaitForExit()
          }
        } else {
          Stop-Process -Id $process.pid -Force -ErrorAction Stop
        }
      }
    } catch {
      # Best-effort cleanup when a process already exited.
    }
  }
}

function Get-LogExcerpt([string]$Path) {
  if (-not (Test-Path $Path)) {
    return ""
  }

  $lines = Get-Content -Path $Path -Tail 20 -ErrorAction SilentlyContinue
  return ($lines -join "`n").Trim()
}

function Get-ExitedProcessReports([object[]]$Processes) {
  $reports = @()

  foreach ($process in $Processes) {
    $hasExited = $false

    if ($process.handle) {
      $process.handle.Refresh()
      $hasExited = $process.handle.HasExited
    } elseif (-not (Get-Process -Id $process.pid -ErrorAction SilentlyContinue)) {
      $hasExited = $true
    }

    if ($hasExited) {
      $stderrExcerpt = Get-LogExcerpt -Path $process.stderr
      $stdoutExcerpt = Get-LogExcerpt -Path $process.stdout

      $detail =
        if ($stderrExcerpt) {
          $stderrExcerpt
        } elseif ($stdoutExcerpt) {
          $stdoutExcerpt
        } else {
          "No log output was captured."
        }

      $reports += [pscustomobject]@{
        name = $process.name
        pid = $process.pid
        stdout = $process.stdout
        stderr = $process.stderr
        detail = $detail
      }
    }
  }

  return $reports
}

function Assert-ProcessesStayAlive(
  [object[]]$Processes,
  [int]$GraceSeconds
) {
  $deadline = (Get-Date).AddSeconds($GraceSeconds)

  while ((Get-Date) -lt $deadline) {
    $failed = Get-ExitedProcessReports -Processes $Processes
    if ($failed.Count -gt 0) {
      $messages = foreach ($entry in $failed) {
        @(
          "$($entry.name) failed during startup.",
          "PID: $($entry.pid)",
          "stdout: $($entry.stdout)",
          "stderr: $($entry.stderr)",
          "detail: $($entry.detail)"
        ) -join "`n"
      }

      throw (($messages -join "`n`n").Trim())
    }

    Start-Sleep -Milliseconds 500
  }
}

function Test-HttpOk([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-ForReadiness(
  [object[]]$Checks,
  [int]$TimeoutSeconds
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $pending = @($Checks)

  while ((Get-Date) -lt $deadline) {
    $pending = @(
      foreach ($check in $pending) {
        if (-not (Test-HttpOk -Url $check.url)) {
          $check
        }
      }
    )

    if ($pending.Count -eq 0) {
      return
    }

    Start-Sleep -Seconds 2
  }

  $failures = foreach ($check in $pending) {
    "$($check.name) did not become ready at $($check.url) within $TimeoutSeconds seconds."
  }

  throw (($failures -join "`n").Trim())
}

Ensure-EnvFile

$allCommands = @($ApiCommand, $CustomerCommand, $WorkerCommand, $AdminCommand) -join " "
if ($allCommands -match "(^|\\s)pnpm(\\s|$)" -and -not (Test-CommandExists "pnpm")) {
  throw "pnpm is not installed. Run 'npm install -g pnpm' first."
}

if (-not $SkipDependencyCheck) {
  $missingDependencies = @()

  if (-not (Test-PortOpen -HostName $DatabaseHost -Port $DatabasePort)) {
    $missingDependencies += "PostgreSQL is not reachable at $($DatabaseHost):$DatabasePort."
  }

  if (-not (Test-PortOpen -HostName $RedisHost -Port $RedisPort)) {
    $missingDependencies += "Redis is not reachable at $($RedisHost):$RedisPort."
  }

  if ($missingDependencies.Count -gt 0) {
    throw ((@($missingDependencies) + "Run 'pnpm dev:stack' first.") -join "`n")
  }
}

$adminSecret =
  if ($env:ADMIN_JWT_SECRET) {
    $env:ADMIN_JWT_SECRET
  } elseif ($env:JWT_SECRET) {
    $env:JWT_SECRET
  } else {
    "change-this-in-production-min-32-chars"
  }

if (-not $ApiCommand) {
  $ApiCommand = "Set-Location '$projectRoot'; pnpm --filter @iwootcall/api dev"
}

if (-not $CustomerCommand) {
  $CustomerCommand = "Set-Location '$projectRoot'; `$env:NEXT_PUBLIC_API_BASE_URL='$ApiBaseUrl'; pnpm --filter @iwootcall/customer-app dev"
}

if (-not $WorkerCommand) {
  $WorkerCommand = "Set-Location '$projectRoot'; `$env:NEXT_PUBLIC_API_BASE_URL='$ApiBaseUrl'; pnpm --filter @iwootcall/worker-app dev"
}

if (-not $AdminCommand) {
  $AdminCommand = "Set-Location '$projectRoot'; `$env:NEXT_PUBLIC_API_BASE_URL='$ApiBaseUrl'; `$env:ADMIN_JWT_SECRET='$adminSecret'; `$env:ADMIN_DEV_ENABLED='true'; pnpm --filter @iwootcall/admin-panel dev"
}

$processes = @()

try {
  $processes += Start-AppProcess -Name "api" -Command $ApiCommand
  $processes += Start-AppProcess -Name "customer-app" -Command $CustomerCommand
  $processes += Start-AppProcess -Name "worker-app" -Command $WorkerCommand
  $processes += Start-AppProcess -Name "admin-panel" -Command $AdminCommand

  Assert-ProcessesStayAlive -Processes $processes -GraceSeconds $StartupGraceSeconds

  if (-not $SkipReadinessCheck) {
    $checks = @(
      [pscustomobject]@{ name = "api"; url = "$ApiBaseUrl/health" },
      [pscustomobject]@{ name = "customer-app"; url = $CustomerAppUrl },
      [pscustomobject]@{ name = "worker-app"; url = $WorkerAppUrl },
      [pscustomobject]@{ name = "admin-panel"; url = $AdminAppUrl }
    )

    Wait-ForReadiness -Checks $checks -TimeoutSeconds $ReadinessTimeoutSeconds
  }

  $processes |
    Select-Object name, pid, stdout, stderr |
    ConvertTo-Json |
    Set-Content -Path $processFile -Encoding ASCII

  Write-Host ""
  Write-Host "IwootCall app processes started."
  foreach ($process in $processes) {
    Write-Host "$($process.name): PID $($process.pid)"
  }
  Write-Host ""
  Write-Host "API: $ApiBaseUrl"
  Write-Host "Customer app: $CustomerAppUrl"
  Write-Host "Worker app: $WorkerAppUrl"
  Write-Host "Admin panel: $AdminAppUrl"
  Write-Host "Logs: $runtimeDir"
  Write-Host ""
  Write-Host "Next step: pnpm smoke:local"
} catch {
  Stop-AppProcesses -Processes $processes
  Remove-Item $processFile -Force -ErrorAction SilentlyContinue
  throw
}
