$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is not running. Start Docker Desktop first if you want to manage containers."
}

docker compose stop postgres redis
Write-Host "PostgreSQL and Redis have been stopped."
