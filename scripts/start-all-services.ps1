# Start All Services Script for SOC Compliance Platform
param(
    [switch]$SkipInfrastructure,
    [switch]$Sequential,
    [switch]$DebugMode,
    [int]$StartupDelay = 5
)

Write-Host "=== SOC Compliance Platform - Service Startup Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
if (-not $SkipInfrastructure) {
    docker version > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker is not running. Please start Docker Desktop first!" -ForegroundColor Red
        exit 1
    }
}

# Service definitions with dependencies
$services = @(
    @{Name="auth-service"; Port=3001; Path="services/auth-service"; Dependencies=@()},
    @{Name="client-service"; Port=3002; Path="services/client-service"; Dependencies=@("auth-service")},
    @{Name="policy-service"; Port=3003; Path="services/policy-service"; Dependencies=@("auth-service")},
    @{Name="control-service"; Port=3004; Path="services/control-service"; Dependencies=@("auth-service", "policy-service")},
    @{Name="evidence-service"; Port=3005; Path="services/evidence-service"; Dependencies=@("auth-service", "client-service")},
    @{Name="workflow-service"; Port=3006; Path="services/workflow-service"; Dependencies=@("auth-service", "control-service")},
    @{Name="reporting-service"; Port=3007; Path="services/reporting-service"; Dependencies=@("auth-service", "client-service")},
    @{Name="audit-service"; Port=3008; Path="services/audit-service"; Dependencies=@("auth-service")},
    @{Name="integration-service"; Port=3009; Path="services/integration-service"; Dependencies=@("auth-service")},
    @{Name="notification-service"; Port=3010; Path="services/notification-service"; Dependencies=@("auth-service")},
    @{Name="ai-service"; Port=3011; Path="services/ai-service"; Dependencies=@("auth-service", "policy-service")}
)

# Store running processes
$global:runningProcesses = @{}

# Function to check if a service is healthy
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port
    )
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method Get -TimeoutSec 3
        return $response.status -eq "ok"
    } catch {
        return $false
    }
}

# Function to start a service
function Start-Service {
    param(
        [hashtable]$Service
    )
    
    $serviceName = $Service.Name
    $servicePath = Join-Path $PSScriptRoot ".." $Service.Path
    
    Write-Host "`nStarting $serviceName..." -ForegroundColor Yellow
    
    # Check if service directory exists
    if (-not (Test-Path $servicePath)) {
        Write-Host "  ERROR: Service directory not found: $servicePath" -ForegroundColor Red
        return $false
    }
    
    # Check if .env file exists
    $envFile = Join-Path $servicePath ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "  WARNING: .env file not found for $serviceName" -ForegroundColor Yellow
        # Create a basic .env file
        $envContent = @"
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=soc_$(($serviceName -replace '-service','') -replace '-','_')
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass
KAFKA_BROKERS=localhost:9092
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SERVICE_PORT=$($Service.Port)
"@
        Set-Content -Path $envFile -Value $envContent
        Write-Host "  Created default .env file" -ForegroundColor Green
    }
    
    # Start the service
    $logFile = Join-Path $servicePath "$serviceName.log"
    $errorFile = Join-Path $servicePath "$serviceName.error.log"
    
    Push-Location $servicePath
    try {
        if ($DebugMode) {
            # Start in new window for debugging
            $process = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run start:dev" -PassThru
        } else {
            # Start in background
            $process = Start-Process npm.cmd -ArgumentList "run", "start:dev" `
                -WindowStyle Hidden `
                -RedirectStandardOutput $logFile `
                -RedirectStandardError $errorFile `
                -PassThru
        }
        
        $global:runningProcesses[$serviceName] = $process
        
        # Wait for service to be healthy
        Write-Host "  Waiting for $serviceName to be healthy..." -NoNewline
        $attempts = 0
        $maxAttempts = 30
        
        while ($attempts -lt $maxAttempts) {
            Start-Sleep -Seconds 2
            if (Test-ServiceHealth -ServiceName $serviceName -Port $Service.Port) {
                Write-Host " ✓" -ForegroundColor Green
                Write-Host "  $serviceName is running on port $($Service.Port)" -ForegroundColor Green
                return $true
            }
            Write-Host "." -NoNewline
            $attempts++
        }
        
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "  $serviceName failed to start within timeout" -ForegroundColor Red
        
        # Show error log
        if (Test-Path $errorFile) {
            Write-Host "  Last errors:" -ForegroundColor Yellow
            Get-Content $errorFile -Tail 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        
        return $false
        
    } finally {
        Pop-Location
    }
}

# Function to stop all services
function Stop-AllServices {
    Write-Host "`nStopping all services..." -ForegroundColor Yellow
    
    foreach ($process in $global:runningProcesses.Values) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "All services stopped" -ForegroundColor Green
}

# Set up cleanup on exit
trap {
    Stop-AllServices
}

# Start infrastructure if needed
if (-not $SkipInfrastructure) {
    Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
    docker-compose up -d postgres redis kafka zookeeper mongodb elasticsearch
    
    Write-Host "Waiting for infrastructure to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Start services
$failedServices = @()

if ($Sequential) {
    # Start services one by one in dependency order
    foreach ($service in $services) {
        $canStart = $true
        
        # Check dependencies
        foreach ($dep in $service.Dependencies) {
            if ($dep -in $failedServices) {
                Write-Host "$($service.Name) cannot start because dependency $dep failed" -ForegroundColor Red
                $failedServices += $service.Name
                $canStart = $false
                break
            }
        }
        
        if ($canStart) {
            if (-not (Start-Service -Service $service)) {
                $failedServices += $service.Name
            }
        }
        
        if ($StartupDelay -gt 0) {
            Start-Sleep -Seconds $StartupDelay
        }
    }
} else {
    # Start all services in parallel
    Write-Host "Starting all services in parallel..." -ForegroundColor Cyan
    
    $jobs = @()
    foreach ($service in $services) {
        $job = Start-Job -ScriptBlock {
            param($Service)
            
            # Start service directly in job
            $servicePath = Join-Path $PSScriptRoot ".." $Service.Path
            Push-Location $servicePath
            
            try {
                Start-Process npm.cmd -ArgumentList "run", "start:dev" -NoNewWindow
                Start-Sleep -Seconds 30  # Give service time to start
                
                # Simple health check
                try {
                    Invoke-RestMethod -Uri "http://localhost:$($Service.Port)/health" -Method Get -TimeoutSec 3
                    return $true
                } catch {
                    return $false
                }
            } finally {
                Pop-Location
            }
        } -ArgumentList $service
        
        $jobs += @{Job=$job; Service=$service}
    }
    
    # Wait for all jobs to complete
    $jobs | ForEach-Object {
        $result = Wait-Job -Job $_.Job | Receive-Job
        Remove-Job -Job $_.Job
        
        if (-not $result) {
            $failedServices += $_.Service.Name
        }
    }
}

# Summary
Write-Host "`n=== Service Startup Summary ===" -ForegroundColor Cyan
$successCount = $services.Count - $failedServices.Count

Write-Host "Successfully started: $successCount/$($services.Count) services" -ForegroundColor $(if ($successCount -eq $services.Count) { "Green" } else { "Yellow" })

if ($failedServices.Count -gt 0) {
    Write-Host "`nFailed services:" -ForegroundColor Red
    $failedServices | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}

# Run health check
Write-Host "`nRunning comprehensive health check..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "check-local-health.ps1") -Detailed

Write-Host "`nStartup complete!" -ForegroundColor Green
Write-Host "To stop all services, press Ctrl+C or run: .\scripts\stop-all-services.ps1" -ForegroundColor Yellow

# Keep script running if in debug mode
if ($DebugMode) {
    Write-Host "`nDebug mode: Services running in separate windows. Press any key to stop all services..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Stop-AllServices
}