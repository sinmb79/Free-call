param(
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "== $Message =="
}

function Test-CommandExists([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-ForPort([int]$Port, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet) {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "Port $Port did not become ready within $TimeoutSeconds seconds."
}

Write-Step "IwootCall local stack setup"

if (-not (Test-CommandExists "docker")) {
  throw "Docker is not installed. Install Docker Desktop first."
}

if (-not (Test-CommandExists "pnpm")) {
  throw "pnpm is not installed. Run 'npm install -g pnpm' first."
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running. Start Docker Desktop and run this script again."
}

Write-Step "Starting PostgreSQL and Redis"
docker compose up -d postgres redis

Write-Step "Waiting for service ports"
Wait-ForPort -Port 5432 -TimeoutSeconds 120
Wait-ForPort -Port 6379 -TimeoutSeconds 120

Write-Step "Applying Prisma migrations"
pnpm --filter @iwootcall/api prisma:deploy

if (-not $SkipSeed) {
  Write-Step "Seeding development data"
  pnpm --filter @iwootcall/api prisma:seed
}

Write-Step "Done"
Write-Host "PostgreSQL and Redis are ready."
Write-Host "Next step: pnpm dev:start"
