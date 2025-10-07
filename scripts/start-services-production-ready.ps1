# Production-Ready Service Startup Script
Write-Host "Starting SOC Compliance Platform Services (Production Mode)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check Docker
docker version > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running!" -ForegroundColor Red
    exit 1
}

# Service list with dependencies
$services = @(
    @{Name="auth-service"; Port=3001; Deps=@()},
    @{Name="client-service"; Port=3002; Deps=@("auth-service")},
    @{Name="policy-service"; Port=3003; Deps=@("auth-service")},
    @{Name="control-service"; Port=3004; Deps=@("auth-service", "policy-service")},
    @{Name="evidence-service"; Port=3005; Deps=@("auth-service", "client-service")},
    @{Name="workflow-service"; Port=3006; Deps=@("auth-service", "control-service")},
    @{Name="reporting-service"; Port=3007; Deps=@("auth-service", "client-service")},
    @{Name="audit-service"; Port=3008; Deps=@("auth-service")},
    @{Name="integration-service"; Port=3009; Deps=@("auth-service")},
    @{Name="notification-service"; Port=3010; Deps=@("auth-service")},
    @{Name="ai-service"; Port=3011; Deps=@("auth-service", "policy-service")}
)

# Function to test health
function Test-ServiceHealth {
    param([int]$Port)
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$Port/health" -Method Get -TimeoutSec 3
        return $response.status -eq "ok"
    } catch {
        return $false
    }
}

# Function to start a service
function Start-Service {
    param($Service)
    
    $serviceName = $Service.Name
    $servicePath = Join-Path (Split-Path $PSScriptRoot -Parent) "services\$serviceName"
    
    Write-Host "`nStarting $serviceName..." -ForegroundColor Yellow
    
    # Ensure .env exists
    $envFile = Join-Path $servicePath ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "  ERROR: .env file not found!" -ForegroundColor Red
        Write-Host "  Run .\scripts\configure-dev-environment.ps1 first" -ForegroundColor Yellow
        return $false
    }
    
    # Build the service
    Write-Host "  Building..." -NoNewline
    Push-Location $servicePath
    $buildOutput = npm run build 2>&1
    $buildSuccess = $LASTEXITCODE -eq 0
    Pop-Location
    
    if (-not $buildSuccess) {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Build error: $buildOutput" -ForegroundColor Red
        return $false
    }
    Write-Host " OK" -ForegroundColor Green
    
    # Start the service using direct node execution
    Push-Location $servicePath
    $process = Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "& {",
        "  Write-Host 'Starting $serviceName on port $($Service.Port)...' -ForegroundColor Cyan;",
        "  npm run start:direct",
        "}"
    ) -PassThru -WindowStyle Minimized
    Pop-Location
    
    # Wait for service to be healthy
    Write-Host "  Waiting for health check..." -NoNewline
    $attempts = 0
    $maxAttempts = 30
    
    while ($attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 2
        if (Test-ServiceHealth -Port $Service.Port) {
            Write-Host " OK" -ForegroundColor Green
            Write-Host "  $serviceName is running on http://localhost:$($Service.Port)" -ForegroundColor Green
            Write-Host "  API docs: http://localhost:$($Service.Port)/api/docs" -ForegroundColor Cyan
            return $true
        }
        Write-Host "." -NoNewline
        $attempts++
    }
    
    Write-Host " TIMEOUT" -ForegroundColor Red
    Write-Host "  Failed to start $serviceName" -ForegroundColor Red
    
    # Kill the process if it's still running
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    
    return $false
}

# Check Docker services
Write-Host "`nChecking Docker services..." -ForegroundColor Yellow
$dockerServices = @("postgres", "redis", "kafka", "zookeeper", "mongodb", "elasticsearch")
$dockerRunning = docker ps --format "{{.Names}}" 2>$null

foreach ($svc in $dockerServices) {
    $isRunning = $dockerRunning | Where-Object { $_ -like "*$svc*" }
    if ($isRunning) {
        Write-Host "  ✓ $svc is running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $svc is NOT running" -ForegroundColor Red
        Write-Host "    Run: .\start-docker-services.ps1" -ForegroundColor Yellow
    }
}

# Start services in dependency order
Write-Host "`nStarting microservices..." -ForegroundColor Cyan
$started = @()
$failed = @()

foreach ($service in $services) {
    # Check dependencies
    $canStart = $true
    foreach ($dep in $service.Deps) {
        if ($dep -notin $started) {
            Write-Host "`n$($service.Name) waiting for dependency: $dep" -ForegroundColor Yellow
            $canStart = $false
            break
        }
    }
    
    if ($canStart) {
        if (Start-Service -Service $service) {
            $started += $service.Name
        } else {
            $failed += $service.Name
        }
    } else {
        $failed += $service.Name
    }
}

# Summary
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "Startup Summary:" -ForegroundColor Yellow
Write-Host "  Started: $($started.Count)/$($services.Count) services" -ForegroundColor $(if ($started.Count -eq $services.Count) { "Green" } else { "Yellow" })

if ($failed.Count -gt 0) {
    Write-Host "`nFailed services:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}

if ($started.Count -gt 0) {
    Write-Host "`nRunning services:" -ForegroundColor Green
    foreach ($service in $services) {
        if ($service.Name -in $started) {
            Write-Host "  - $($service.Name): http://localhost:$($service.Port)" -ForegroundColor Green
        }
    }
}

# Run health check
Write-Host "`nRunning comprehensive health check..." -ForegroundColor Cyan
& (Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\check-local-health.ps1") -Detailed

Write-Host "`nTo stop all services, run:" -ForegroundColor Yellow
Write-Host "  .\scripts\stop-all-services.ps1" -ForegroundColor Cyan
Write-Host "`nServices are running in minimized windows. Check them for logs." -ForegroundColor Yellow