param(
  [string]$ApiBaseUrl = "http://localhost:3001",
  [string]$CustomerAppUrl = "http://localhost:3101",
  [string]$WorkerAppUrl = "http://localhost:3102",
  [string]$AdminAppUrl = "http://localhost:3103",
  [string]$DatabaseHost = "localhost",
  [int]$DatabasePort = 5432,
  [string]$RedisHost = "localhost",
  [int]$RedisPort = 6379,
  [switch]$SkipDependencyCheck
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "== $Message =="
}

function Invoke-Json(
  [string]$Method,
  [string]$Url,
  [object]$Body = $null,
  [hashtable]$Headers = @{}
) {
  $request = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
    ContentType = "application/json"
  }

  if ($null -ne $Body) {
    $request.Body = ($Body | ConvertTo-Json -Depth 8)
  }

  return Invoke-RestMethod @request
}

function Assert-Status200([string]$Url) {
  $response = Invoke-WebRequest -UseBasicParsing $Url
  if ($response.StatusCode -ne 200) {
    throw "Expected HTTP 200 from $Url but got $($response.StatusCode)"
  }
  Write-Host "PASS $Url"
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

Write-Step "Checking app URLs"
Assert-Status200 "$ApiBaseUrl/health"
Assert-Status200 $CustomerAppUrl
Assert-Status200 $WorkerAppUrl
Assert-Status200 $AdminAppUrl

Write-Step "Preparing customer session"
try {
  Invoke-Json "POST" "$ApiBaseUrl/auth/customer/register" @{
    phone = "01099000001"
    name = "Smoke Customer"
    otpCode = "000000"
  } | Out-Null
} catch {
  if (-not $_.Exception.Message.Contains("(409)")) {
    throw
  }
}
$customerLogin = Invoke-Json "POST" "$ApiBaseUrl/auth/customer/login" @{
  phone = "01099000001"
  otpCode = "000000"
}
$customerToken = $customerLogin.token

Write-Step "Preparing worker session"
try {
  Invoke-Json "POST" "$ApiBaseUrl/auth/worker/register" @{
    phone = "01099000002"
    name = "Smoke Worker"
    module = "FREECAB"
    vehicleType = "SEDAN"
    vehicleNumber = "99A1002"
    otpCode = "000000"
  } | Out-Null
} catch {
  if (-not $_.Exception.Message.Contains("(409)")) {
    throw
  }
}
$workerLogin = Invoke-Json "POST" "$ApiBaseUrl/auth/worker/login" @{
  phone = "01099000002"
  otpCode = "000000"
}
$workerToken = $workerLogin.token
$workerId = $workerLogin.worker.id

Write-Step "Generating admin token"
$adminTokenPayload = Invoke-Json "POST" "$AdminAppUrl/api/dev-admin-token" @{}
$adminHeaders = @{ authorization = "Bearer $($adminTokenPayload.token)" }

Write-Step "Activating worker and publishing presence"
Invoke-Json "PATCH" "$ApiBaseUrl/admin/workers/$workerId/status" @{
  status = "ACTIVE"
} $adminHeaders | Out-Null

Invoke-Json "PATCH" "$ApiBaseUrl/worker/presence" @{
  isOnline = $true
  lat = 37.5551
  lng = 126.9707
} @{ authorization = "Bearer $workerToken" } | Out-Null

Write-Step "Creating customer job"
$job = Invoke-Json "POST" "$ApiBaseUrl/jobs" @{
  module = "FREECAB"
  originAddress = "Seoul Station"
  originLat = 37.5551
  originLng = 126.9707
  destAddress = "City Hall"
  destLat = 37.5663
  destLng = 126.9779
  metadata = @{
    vehicleType = "SEDAN"
  }
} @{ authorization = "Bearer $customerToken" }

Write-Step "Checking worker/admin views"
$activeJob = Invoke-Json "GET" "$ApiBaseUrl/worker/jobs/active" $null @{ authorization = "Bearer $workerToken" }
$adminStats = Invoke-Json "GET" "$ApiBaseUrl/admin/stats" $null $adminHeaders

Write-Step "Smoke summary"
[pscustomobject]@{
  customer = $customerLogin.customer.phone
  worker = $workerLogin.worker.phone
  jobStatus = $job.job.status
  activeJobId = $activeJob.job.id
  totalJobs = $adminStats.summary.totalJobs
  onlineWorkers = $adminStats.summary.onlineWorkers
} | Format-List
