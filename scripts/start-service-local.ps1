# Start Service Locally - Workaround for npm workspace issues
# Usage: ./scripts/start-service-local.ps1 -ServiceName control-service

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceName,
    
    [string]$Mode = "dev"  # dev or prod
)

$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$servicePath = Join-Path $projectRoot "services" $ServiceName

if (!(Test-Path $servicePath)) {
    Write-Error "Service path not found: $servicePath"
    exit 1
}

Write-Host "Starting $ServiceName in $Mode mode..." -ForegroundColor Cyan

# Navigate to service directory
Set-Location $servicePath

# Set NODE_PATH to help with module resolution
$env:NODE_PATH = @(
    "$projectRoot\node_modules",
    "$servicePath\node_modules",
    "$projectRoot"
) -join ";"

Write-Host "NODE_PATH set to: $env:NODE_PATH" -ForegroundColor DarkGray

# Set other environment variables
$env:NODE_ENV = if ($Mode -eq "prod") { "production" } else { "development" }
$env:DB_HOST = "localhost"
$env:REDIS_HOST = "localhost"
$env:REDIS_PASSWORD = "soc_redis_pass"
$env:KAFKA_BROKERS = "localhost:9092"

# Build the service first
Write-Host "Building service..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}

# Start the service
if ($Mode -eq "prod") {
    Write-Host "Starting in production mode..." -ForegroundColor Green
    node dist/main
} else {
    Write-Host "Starting in development mode..." -ForegroundColor Green
    npm run start:dev
}