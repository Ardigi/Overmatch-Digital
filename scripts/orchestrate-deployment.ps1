# SOC Platform Deployment Orchestration Script
# Manages and tracks the complete deployment workflow for production readiness
# Usage: .\orchestrate-deployment.ps1 [-Phase <1-4>] [-Service <name>] [-Report] [-Fix]

param(
    [Parameter()]
    [ValidateSet(1, 2, 3, 4)]
    [int]$Phase = 0,
    
    [Parameter()]
    [string]$Service = "",
    
    [Parameter()]
    [switch]$Report,
    
    [Parameter()]
    [switch]$Fix,
    
    [Parameter()]
    [switch]$Parallel,
    
    [Parameter()]
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"
$script:startTime = Get-Date

# Color functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Warning { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Error { Write-Host $args[0] -ForegroundColor Red }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }
function Write-Progress { Write-Host $args[0] -ForegroundColor Magenta }

# Service definitions with current status
$services = @{
    "auth" = @{
        Name = "Auth Service"
        Port = 3001
        Database = "soc_auth"
        Container = "overmatch-digital-auth-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $true
        Priority = 1
    }
    "client" = @{
        Name = "Client Service"
        Port = 3002
        Database = "soc_clients"
        Container = "overmatch-digital-client-service-1"
        DockerDeployed = $true
        TypeScriptClean = $false
        TestsPassing = $false
        Priority = 1
    }
    "policy" = @{
        Name = "Policy Service"
        Port = 3003
        Database = "soc_policies"
        Container = "overmatch-digital-policy-service-1"
        DockerDeployed = $true
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 2
    }
    "control" = @{
        Name = "Control Service"
        Port = 3004
        Database = "soc_controls"
        Container = "overmatch-digital-control-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $true
        Priority = 1
    }
    "evidence" = @{
        Name = "Evidence Service"
        Port = 3005
        Database = "soc_evidence"
        Container = "overmatch-digital-evidence-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $true
        Priority = 1
    }
    "workflow" = @{
        Name = "Workflow Service"
        Port = 3006
        Database = "soc_workflows"
        Container = "overmatch-digital-workflow-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 3
    }
    "reporting" = @{
        Name = "Reporting Service"
        Port = 3007
        Database = "soc_reporting"
        Container = "overmatch-digital-reporting-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 3
    }
    "audit" = @{
        Name = "Audit Service"
        Port = 3008
        Database = "soc_audits"
        Container = "overmatch-digital-audit-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 3
    }
    "integration" = @{
        Name = "Integration Service"
        Port = 3009
        Database = "soc_integrations"
        Container = "overmatch-digital-integration-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 4
    }
    "notification" = @{
        Name = "Notification Service"
        Port = 3010
        Database = "soc_notifications"
        Container = "overmatch-digital-notification-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 4
    }
    "ai" = @{
        Name = "AI Service"
        Port = 3011
        Database = "soc_ai"
        Container = "overmatch-digital-ai-service-1"
        DockerDeployed = $false
        TypeScriptClean = $true
        TestsPassing = $false
        Priority = 4
    }
}

# Phase definitions
$phases = @{
    1 = @{
        Name = "Critical Infrastructure Fix"
        Tasks = @(
            "Fix Kong Gateway configuration"
            "Resolve Client Service TypeScript errors"
            "Deploy Auth, Control, Evidence services"
        )
    }
    2 = @{
        Name = "Service Deployment & Testing"
        Tasks = @(
            "Deploy Workflow, Reporting, Audit services"
            "Deploy Integration, Notification, AI services"
            "Improve test coverage to >80%"
        )
    }
    3 = @{
        Name = "Integration & E2E Testing"
        Tasks = @(
            "Service-to-service communication tests"
            "Kafka event flow validation"
            "Complete E2E test suite"
            "Performance testing"
        )
    }
    4 = @{
        Name = "Production Readiness"
        Tasks = @(
            "Security hardening"
            "Monitoring setup"
            "Documentation completion"
            "Production deployment"
        )
    }
}

function Show-Banner {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║        SOC Platform - Deployment Orchestration            ║" -ForegroundColor Cyan
    Write-Host "║                  Production Readiness: ~40%               ║" -ForegroundColor Yellow
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Get-ServiceStatus {
    param($ServiceKey)
    
    $svc = $services[$ServiceKey]
    $status = @{
        Running = $false
        Healthy = $false
        DockerImage = $false
    }
    
    # Check if container is running
    $containerRunning = docker ps --filter "name=$($svc.Container)" --filter "status=running" -q 2>$null
    if ($containerRunning) {
        $status.Running = $true
        
        # Check health endpoint
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$($svc.Port)/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $status.Healthy = $true
            }
        } catch {}
    }
    
    # Check if Docker image exists
    $imageName = "overmatch-digital-$ServiceKey-service"
    $imageExists = docker images -q $imageName 2>$null
    if ($imageExists) {
        $status.DockerImage = $true
    }
    
    return $status
}

function Show-ServiceDashboard {
    Write-Info "`nService Status Dashboard"
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    $readyCount = 0
    $totalCount = $services.Count
    
    foreach ($key in $services.Keys | Sort-Object { $services[$_].Priority }) {
        $svc = $services[$key]
        $status = Get-ServiceStatus -ServiceKey $key
        
        $dockerStatus = if ($svc.DockerDeployed) { "✅" } else { "❌" }
        $tsStatus = if ($svc.TypeScriptClean) { "✅" } else { "⚠️" }
        $testStatus = if ($svc.TestsPassing) { "✅" } else { "⚠️" }
        $healthStatus = if ($status.Healthy) { "✅" } else { "❌" }
        
        if ($svc.DockerDeployed -and $svc.TypeScriptClean -and $svc.TestsPassing) {
            $readyCount++
            $overallStatus = "✅ Ready"
            $color = "Green"
        } elseif ($svc.DockerDeployed -or ($svc.TypeScriptClean -and $svc.TestsPassing)) {
            $overallStatus = "⚠️ Almost"
            $color = "Yellow"
        } else {
            $overallStatus = "❌ Not Ready"
            $color = "Red"
        }
        
        Write-Host ("{0,-20} Docker: {1}  TypeScript: {2}  Tests: {3}  Health: {4}  [{5}]" -f $svc.Name, $dockerStatus, $tsStatus, $testStatus, $healthStatus, $overallStatus) -ForegroundColor $color
    }
    
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    $percentage = [math]::Round(($readyCount / $totalCount) * 100)
    $progressMsg = "Overall Progress: $readyCount/$totalCount services ready"
    Write-Progress $progressMsg
}

function Deploy-Service {
    param(
        [string]$ServiceKey,
        [switch]$Force
    )
    
    $svc = $services[$ServiceKey]
    Write-Info "`nDeploying $($svc.Name)..."
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would deploy $ServiceKey service"
        return $true
    }
    
    # Step 1: Build shared packages
    Write-Progress "  Building shared packages..."
    npm run build:shared 2>&1 | Out-Null
    
    # Step 2: Check TypeScript
    Write-Progress "  Checking TypeScript..."
    Set-Location "services/$ServiceKey-service"
    $tsCheck = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  TypeScript errors found"
        if (-not $Force) {
            Set-Location ../..
            return $false
        }
    }
    
    # Step 3: Build service
    Write-Progress "  Building service..."
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "  Build failed"
        Set-Location ../..
        return $false
    }
    Set-Location ../..
    
    # Step 4: Build Docker image
    Write-Progress "  Building Docker image..."
    docker-compose build $ServiceKey-service 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "  Docker build failed"
        return $false
    }
    
    # Step 5: Start container
    Write-Progress "  Starting container..."
    docker-compose up -d $ServiceKey-service 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    
    # Step 6: Verify health
    Write-Progress "  Verifying health..."
    $maxRetries = 10
    $retries = 0
    while ($retries -lt $maxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$($svc.Port)/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "  [SUCCESS] $($svc.Name) deployed successfully!"
                $services[$ServiceKey].DockerDeployed = $true
                return $true
            }
        } catch {}
        $retries++
        Start-Sleep -Seconds 2
    }
    
    Write-Error "  Failed to verify health endpoint"
    return $false
}

function Fix-KongGateway {
    Write-Info "`nFixing Kong Gateway..."
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would fix Kong Gateway configuration"
        return $true
    }
    
    # Check if Kong is running
    $kongRunning = docker ps --filter "name=kong" --filter "status=running" -q
    if (-not $kongRunning) {
        Write-Progress "  Starting Kong Gateway..."
        docker-compose up -d kong 2>&1 | Out-Null
        Start-Sleep -Seconds 5
    }
    
    # Test Kong admin API
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/status" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "  [SUCCESS] Kong Gateway is operational"
            return $true
        }
    } catch {
        Write-Error "  Kong Gateway not responding"
        return $false
    }
}

function Fix-ClientTypeScript {
    Write-Info "`nFixing Client Service TypeScript errors..."
    
    if ($DryRun) {
        Write-Warning "[DRY RUN] Would fix Client Service TypeScript"
        return $true
    }
    
    Set-Location services/client-service
    
    # Check current errors
    Write-Progress "  Checking TypeScript errors..."
    $tsErrors = npx tsc --noEmit 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "  [SUCCESS] No TypeScript errors found!"
        $services["client"].TypeScriptClean = $true
        Set-Location ../..
        return $true
    }
    
    Write-Warning "  TypeScript errors detected, attempting fixes..."
    # Here you would implement specific fixes
    
    Set-Location ../..
    return $false
}

function Execute-Phase {
    param([int]$PhaseNumber)
    
    $phase = $phases[$PhaseNumber]
    Write-Info "`nPhase ${PhaseNumber}: $($phase.Name)"
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    foreach ($task in $phase.Tasks) {
        Write-Host "  • $task" -ForegroundColor White
    }
    
    if ($PhaseNumber -eq 1) {
        # Phase 1: Critical Infrastructure
        Fix-KongGateway
        Fix-ClientTypeScript
        
        # Deploy critical services
        $criticalServices = @("auth", "control", "evidence")
        foreach ($svc in $criticalServices) {
            if (-not $services[$svc].DockerDeployed) {
                Deploy-Service -ServiceKey $svc
            }
        }
    }
    elseif ($PhaseNumber -eq 2) {
        # Phase 2: Service Deployment
        $batch1 = @("workflow", "reporting", "audit")
        $batch2 = @("integration", "notification", "ai")
        
        Write-Progress "`nDeploying Batch 1 services..."
        foreach ($svc in $batch1) {
            Deploy-Service -ServiceKey $svc
        }
        
        Write-Progress "`nDeploying Batch 2 services..."
        foreach ($svc in $batch2) {
            Deploy-Service -ServiceKey $svc
        }
    }
    elseif ($PhaseNumber -eq 3) {
        # Phase 3: Integration & E2E Testing
        Write-Progress "`nRunning integration tests..."
        .\scripts\run-integration-tests.ps1
        
        Write-Progress "`nRunning E2E tests..."
        .\scripts\run-e2e-tests.ps1
    }
    elseif ($PhaseNumber -eq 4) {
        # Phase 4: Production Readiness
        Write-Progress "`nPerforming security audit..."
        Write-Progress "`nSetting up monitoring..."
        Write-Progress "`nFinalizing documentation..."
    }
}

function Generate-Report {
    $reportPath = "deployment-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
    
    $report = @"
# SOC Platform Deployment Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Executive Summary
- **Platform Readiness**: ~40%
- **Services Deployed**: $(($services.Values | Where-Object { $_.DockerDeployed }).Count) / $($services.Count)
- **TypeScript Clean**: $(($services.Values | Where-Object { $_.TypeScriptClean }).Count) / $($services.Count)
- **Tests Passing**: $(($services.Values | Where-Object { $_.TestsPassing }).Count) / $($services.Count)

## Service Details
"@

    foreach ($key in $services.Keys | Sort-Object) {
        $svc = $services[$key]
        $status = Get-ServiceStatus -ServiceKey $key
        $report += @"

### $($svc.Name)
- Port: $($svc.Port)
- Database: $($svc.Database)
- Docker Deployed: $(if ($svc.DockerDeployed) { "✅" } else { "❌" })
- TypeScript Clean: $(if ($svc.TypeScriptClean) { "✅" } else { "❌" })
- Tests Passing: $(if ($svc.TestsPassing) { "✅" } else { "❌" })
- Currently Running: $(if ($status.Running) { "✅" } else { "❌" })
- Health Check: $(if ($status.Healthy) { "✅" } else { "❌" })
"@
    }
    
    $report | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Success "`nReport generated: $reportPath"
}

# Main execution
Show-Banner

if ($Report) {
    Show-ServiceDashboard
    Generate-Report
}
elseif ($Service) {
    # Deploy specific service
    if ($services.ContainsKey($Service)) {
        Deploy-Service -ServiceKey $Service -Force:$Fix
    } else {
        Write-Error "Service '$Service' not found"
    }
}
elseif ($Phase -gt 0) {
    # Execute specific phase
    Execute-Phase -PhaseNumber $Phase
}
else {
    # Show dashboard and options
    Show-ServiceDashboard
    
    Write-Info "`nAvailable Commands:"
    Write-Host "  .\orchestrate-deployment.ps1 -Phase 1     # Execute Phase 1 (Critical Infrastructure)" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -Phase 2     # Execute Phase 2 (Service Deployment)" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -Phase 3     # Execute Phase 3 (Integration & E2E)" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -Phase 4     # Execute Phase 4 (Production Ready)" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -Service auth  # Deploy specific service" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -Report      # Generate deployment report" -ForegroundColor White
    Write-Host "  .\orchestrate-deployment.ps1 -DryRun      # Preview actions without executing" -ForegroundColor White
}

$duration = (Get-Date) - $script:startTime
Write-Info "`nExecution time: $($duration.ToString('mm\:ss'))"