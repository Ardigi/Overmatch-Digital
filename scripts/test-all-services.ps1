# Test All Services Script
# This script tests each service individually to ensure it starts without errors
# Run from the project root directory

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Testing All 11 SOC Compliance Services " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to test a service
function Test-Service {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [int]$Port,
        [int]$WaitTime = 15
    )
    
    Write-Host "Testing $ServiceName on port $Port..." -ForegroundColor Yellow
    
    # Navigate to service directory
    Set-Location $ServicePath
    
    # Kill any process using the port
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($process) {
        Write-Host "  Killing process on port $Port..." -ForegroundColor DarkGray
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Start the service in background
    Write-Host "  Starting $ServiceName..." -ForegroundColor Green
    $job = Start-Job -ScriptBlock {
        param($path)
        Set-Location $path
        npm run start:dev 2>&1
    } -ArgumentList $ServicePath
    
    # Wait for service to start
    Write-Host "  Waiting $WaitTime seconds for service to initialize..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $WaitTime
    
    # Check if service is running
    $jobState = Get-Job -Id $job.Id | Select-Object -ExpandProperty State
    
    if ($jobState -eq "Running") {
        # Try to hit health endpoint
        try {
            $healthUrl = "http://localhost:$Port/health"
            $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  ✅ $ServiceName is RUNNING and HEALTHY!" -ForegroundColor Green
                $global:SuccessCount++
            } else {
                Write-Host "  ⚠️ $ServiceName is running but health check failed" -ForegroundColor Yellow
                $global:WarningCount++
            }
        } catch {
            Write-Host "  ⚠️ $ServiceName is running but health endpoint not accessible" -ForegroundColor Yellow
            $global:WarningCount++
        }
        
        # Get recent logs
        $logs = Receive-Job -Id $job.Id -Keep | Select-Object -Last 10
        if ($logs) {
            Write-Host "  Recent logs:" -ForegroundColor DarkGray
            $logs | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    } else {
        Write-Host "  ❌ $ServiceName FAILED to start!" -ForegroundColor Red
        $global:FailCount++
        
        # Get error logs
        $logs = Receive-Job -Id $job.Id
        if ($logs) {
            Write-Host "  Error logs:" -ForegroundColor Red
            $logs | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
        }
    }
    
    # Stop the job
    Stop-Job -Id $job.Id -ErrorAction SilentlyContinue
    Remove-Job -Id $job.Id -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Set-Location $PSScriptRoot\..
}

# Initialize counters
$global:SuccessCount = 0
$global:WarningCount = 0
$global:FailCount = 0

# Get project root
$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $projectRoot

# Test each service
$services = @(
    @{Name="Auth Service"; Path="services\auth-service"; Port=3001; Wait=15},
    @{Name="Client Service"; Path="services\client-service"; Port=3002; Wait=15},
    @{Name="Policy Service"; Path="services\policy-service"; Port=3003; Wait=20},
    @{Name="Control Service"; Path="services\control-service"; Port=3004; Wait=20},
    @{Name="Evidence Service"; Path="services\evidence-service"; Port=3005; Wait=25},
    @{Name="Workflow Service"; Path="services\workflow-service"; Port=3006; Wait=15},
    @{Name="Reporting Service"; Path="services\reporting-service"; Port=3007; Wait=15},
    @{Name="Audit Service"; Path="services\audit-service"; Port=3008; Wait=15},
    @{Name="Integration Service"; Path="services\integration-service"; Port=3009; Wait=15},
    @{Name="Notification Service"; Path="services\notification-service"; Port=3010; Wait=15},
    @{Name="AI Service"; Path="services\ai-service"; Port=3011; Wait=15}
)

Write-Host "Starting service tests..." -ForegroundColor Cyan
Write-Host "Note: Each service will be started, tested, and stopped." -ForegroundColor DarkGray
Write-Host ""

# Ensure Docker services are running
Write-Host "Checking Docker services..." -ForegroundColor Yellow
$dockerServices = docker-compose ps --services 2>$null
if ($dockerServices -contains "postgres" -and $dockerServices -contains "redis") {
    Write-Host "✅ Required Docker services are running" -ForegroundColor Green
} else {
    Write-Host "⚠️ Starting required Docker services..." -ForegroundColor Yellow
    docker-compose up -d postgres redis kafka mongodb elasticsearch
    Start-Sleep -Seconds 10
}
Write-Host ""

# Test each service
foreach ($service in $services) {
    Test-Service -ServiceName $service.Name -ServicePath "$projectRoot\$($service.Path)" -Port $service.Port -WaitTime $service.Wait
}

# Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "           Test Summary                   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Successful: $global:SuccessCount services" -ForegroundColor Green
Write-Host "⚠️ Warnings: $global:WarningCount services" -ForegroundColor Yellow
Write-Host "❌ Failed: $global:FailCount services" -ForegroundColor Red
Write-Host ""

# Provide next steps
if ($global:FailCount -eq 0) {
    Write-Host "🎉 All services are working! Next steps:" -ForegroundColor Green
    Write-Host "1. Run 'docker-compose up -d' to deploy all services" -ForegroundColor White
    Write-Host "2. Test the full platform at http://localhost:3000" -ForegroundColor White
    Write-Host "3. Access Kong Gateway at http://localhost:8002" -ForegroundColor White
} else {
    Write-Host "⚠️ Some services failed. Check the logs above for details." -ForegroundColor Yellow
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "- Database connection: Ensure PostgreSQL is running" -ForegroundColor DarkYellow
    Write-Host "- Redis connection: Check Redis is running with password" -ForegroundColor DarkYellow
    Write-Host "- Missing dependencies: Run 'npm install' in the service directory" -ForegroundColor DarkYellow
    Write-Host "- Port conflicts: Check if ports are already in use" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "Test completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray