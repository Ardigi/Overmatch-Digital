# Simple Service Startup Script
Write-Host "Starting SOC Compliance Platform Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check Docker
docker version > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running!" -ForegroundColor Red
    exit 1
}

# Service list
$services = @(
    @{Name="auth-service"; Port=3001},
    @{Name="client-service"; Port=3002},
    @{Name="policy-service"; Port=3003},
    @{Name="control-service"; Port=3004},
    @{Name="evidence-service"; Port=3005},
    @{Name="workflow-service"; Port=3006},
    @{Name="reporting-service"; Port=3007},
    @{Name="audit-service"; Port=3008},
    @{Name="integration-service"; Port=3009},
    @{Name="notification-service"; Port=3010},
    @{Name="ai-service"; Port=3011}
)

# Function to test health
function Test-Health {
    param([int]$Port)
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method Get -TimeoutSec 2
        return $response.status -eq "ok"
    } catch {
        return $false
    }
}

# Start each service
$rootPath = Split-Path $PSScriptRoot -Parent
$started = 0
$failed = 0

foreach ($service in $services) {
    Write-Host "`nStarting $($service.Name)..." -ForegroundColor Yellow
    
    $servicePath = Join-Path $rootPath "services\$($service.Name)"
    if (-not (Test-Path $servicePath)) {
        Write-Host "  Service directory not found!" -ForegroundColor Red
        $failed++
        continue
    }
    
    # Check for .env file
    $envFile = Join-Path $servicePath ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "  Creating default .env file..." -ForegroundColor Yellow
        $dbName = "soc_" + ($service.Name -replace '-service','') -replace '-','_'
        @"
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=$dbName
SERVICE_PORT=$($service.Port)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
"@ | Set-Content $envFile
    }
    
    # Start the service
    Push-Location $servicePath
    $logFile = "$($service.Name).log"
    Start-Process powershell -ArgumentList "-Command", "npm run start:dev 2>&1 | Tee-Object -FilePath $logFile" -WindowStyle Minimized
    Pop-Location
    
    # Wait and check health
    Write-Host "  Waiting for service to start..." -NoNewline
    $attempts = 0
    $healthy = $false
    
    while ($attempts -lt 15 -and -not $healthy) {
        Start-Sleep -Seconds 2
        if (Test-Health -Port $service.Port) {
            $healthy = $true
            Write-Host " ✓" -ForegroundColor Green
            Write-Host "  $($service.Name) is running on port $($service.Port)" -ForegroundColor Green
            $started++
        } else {
            Write-Host "." -NoNewline
            $attempts++
        }
    }
    
    if (-not $healthy) {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "  Failed to start $($service.Name)" -ForegroundColor Red
        $failed++
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Startup Summary:" -ForegroundColor Yellow
Write-Host "  Started: $started services" -ForegroundColor Green
Write-Host "  Failed: $failed services" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })

# Run health check
Write-Host "`nRunning health check..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "check-local-health.ps1")

Write-Host "`nTo stop all services, run:" -ForegroundColor Yellow
Write-Host '  .\scripts\stop-all-services.ps1' -ForegroundColor Cyan