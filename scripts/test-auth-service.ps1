# Test auth-service startup
Write-Host "Testing auth-service startup..." -ForegroundColor Cyan

$servicePath = Join-Path $PSScriptRoot "services\auth-service"
Set-Location $servicePath

# Start the service
Write-Host "Starting auth-service..." -ForegroundColor Yellow
$process = Start-Process node -ArgumentList "dist/src/main.js" -PassThru -NoNewWindow -RedirectStandardOutput "auth-service.log" -RedirectStandardError "auth-service.error.log"

# Wait for service to start
Start-Sleep -Seconds 5

# Check if service is running
if ($process.HasExited) {
    Write-Host "Service failed to start!" -ForegroundColor Red
    Write-Host "`nError log:" -ForegroundColor Yellow
    Get-Content "auth-service.error.log" | Select-Object -Last 20
} else {
    Write-Host "Service started with PID: $($process.Id)" -ForegroundColor Green
    
    # Test health endpoint
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
        Write-Host "Health check passed: $($response.status)" -ForegroundColor Green
    } catch {
        Write-Host "Health check failed: $_" -ForegroundColor Red
    }
    
    # Stop the service
    Stop-Process -Id $process.Id -Force
    Write-Host "Service stopped" -ForegroundColor Yellow
}

Set-Location $PSScriptRoot