# Test Critical Services Script
# Tests the most important services needed for basic platform functionality

Write-Host "Testing Critical Services..." -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $projectRoot

# Function to check service health
function Check-Service {
    param(
        [string]$Name,
        [int]$Port
    )
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $Name (port $Port) - HEALTHY" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "❌ $Name (port $Port) - NOT RUNNING" -ForegroundColor Red
        return $false
    }
    return $false
}

# Check Docker services first
Write-Host "Checking Docker Infrastructure..." -ForegroundColor Yellow
$requiredServices = @("postgres", "redis", "kafka", "kong")
$runningServices = docker ps --format "table {{.Names}}" | Select-Object -Skip 1

foreach ($service in $requiredServices) {
    if ($runningServices -match $service) {
        Write-Host "✅ $service is running" -ForegroundColor Green
    } else {
        Write-Host "❌ $service is NOT running" -ForegroundColor Red
        Write-Host "   Run: docker-compose up -d $service" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Checking Microservices..." -ForegroundColor Yellow

# Check already running services
$results = @{
    "Auth Service" = Check-Service -Name "Auth Service" -Port 3001
    "Client Service" = Check-Service -Name "Client Service" -Port 3002
}

# Try to start Control Service (next critical service)
if (-not (Check-Service -Name "Control Service" -Port 3004)) {
    Write-Host ""
    Write-Host "Attempting to start Control Service..." -ForegroundColor Yellow
    
    Set-Location "$projectRoot\services\control-service"
    
    # Start in background and capture output
    $process = Start-Process -FilePath "npm" -ArgumentList "run", "start:dev" -WindowStyle Hidden -PassThru -RedirectStandardOutput "control-output.log" -RedirectStandardError "control-error.log"
    
    Write-Host "Waiting 20 seconds for Control Service to start..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 20
    
    if (Check-Service -Name "Control Service" -Port 3004) {
        $results["Control Service"] = $true
    } else {
        Write-Host "Control Service failed to start. Check logs:" -ForegroundColor Red
        Write-Host "  $projectRoot\services\control-service\control-error.log" -ForegroundColor Yellow
        
        # Show last few lines of error log
        if (Test-Path "control-error.log") {
            Write-Host ""
            Write-Host "Recent errors:" -ForegroundColor Red
            Get-Content "control-error.log" -Tail 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkRed }
        }
        
        # Stop the process
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

Set-Location $projectRoot

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
$runningCount = ($results.Values | Where-Object { $_ -eq $true }).Count
Write-Host "Running: $runningCount / $($results.Count) critical services" -ForegroundColor $(if ($runningCount -eq $results.Count) { "Green" } else { "Yellow" })

# Next steps
Write-Host ""
if ($runningCount -ge 2) {
    Write-Host "✅ Core services are running. You can:" -ForegroundColor Green
    Write-Host "   1. Access the frontend at http://localhost:3000" -ForegroundColor White
    Write-Host "   2. Use dev-login at http://localhost:3000/dev-login" -ForegroundColor White
    Write-Host "   3. Check API docs at http://localhost:3001/api/docs" -ForegroundColor White
} else {
    Write-Host "⚠️ Some core services are not running." -ForegroundColor Yellow
    Write-Host "To start all services:" -ForegroundColor Yellow
    Write-Host "   1. docker-compose up -d" -ForegroundColor White
    Write-Host "   2. cd services/auth-service && npm run start:dev" -ForegroundColor White
    Write-Host "   3. cd services/client-service && npm run start:dev" -ForegroundColor White
}