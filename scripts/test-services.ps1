# Test Service Startup Script
param(
    [string]$ServiceName = "client-service"
)

Write-Host "Testing $ServiceName startup..." -ForegroundColor Cyan

# Navigate to service directory
$ServicePath = Join-Path $PSScriptRoot "services\$ServiceName"
if (-not (Test-Path $ServicePath)) {
    Write-Host "Service directory not found: $ServicePath" -ForegroundColor Red
    exit 1
}

Set-Location $ServicePath

# Start the service
Write-Host "Starting $ServiceName..." -ForegroundColor Yellow
$process = Start-Process npm.cmd -ArgumentList "run", "start:dev" -PassThru -NoNewWindow -RedirectStandardOutput "startup.log" -RedirectStandardError "error.log"

# Wait a bit for the service to start
Write-Host "Waiting for service to start..."
Start-Sleep -Seconds 10

# Check if process is still running
if ($process.HasExited) {
    Write-Host "Service failed to start!" -ForegroundColor Red
    Write-Host "`nError log:" -ForegroundColor Yellow
    Get-Content "error.log" | Select-Object -Last 20
    exit 1
}

# Get the port for the service
$ports = @{
    "auth-service" = 3001
    "client-service" = 3002
    "policy-service" = 3003
    "control-service" = 3004
    "evidence-service" = 3005
    "workflow-service" = 3006
    "reporting-service" = 3007
    "audit-service" = 3008
    "integration-service" = 3009
    "notification-service" = 3010
    "ai-service" = 3011
}

$port = $ports[$ServiceName]
if (-not $port) {
    Write-Host "Unknown service port" -ForegroundColor Red
    Stop-Process $process
    exit 1
}

# Test health endpoint
Write-Host "`nTesting health endpoint at http://localhost:$port/health" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:$port/health" -Method Get -TimeoutSec 5
    Write-Host "Service is healthy!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
    Write-Host "`nStartup log:" -ForegroundColor Yellow
    Get-Content "startup.log" | Select-Object -Last 20
}

# Stop the service
Write-Host "`nStopping service..." -ForegroundColor Yellow
Stop-Process $process

Write-Host "Test completed" -ForegroundColor Cyan