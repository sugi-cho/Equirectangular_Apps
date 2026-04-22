$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = 5174
$url = "http://localhost:$port/"

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js not found. Installing with winget..."
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget not found. Install Node.js LTS manually."
  }
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements | Out-Host
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

if (Test-AppReady) {
  Start-Process $url
  exit 0
}

Write-Host "Starting the viewer web app..."
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--port", $port) -WorkingDirectory $root

for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-AppReady) {
    Start-Process $url
    exit 0
  }
}

throw "Startup timed out."
