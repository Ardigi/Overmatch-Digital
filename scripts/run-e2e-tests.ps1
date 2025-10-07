# PowerShell script to run E2E tests for SOC Compliance Platform
# This script manages the complete E2E test lifecycle

param(
    [Parameter(Mandatory=$false)]
    [string]$Service = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$KeepRunning,
    
    [Parameter(Mandatory=$false)]
    [switch]$Cleanup,
    
    [Parameter(Mandatory=$false)]
    [switch]$Debug,
    
    [Parameter(Mandatory=$false)]
    [switch]$Coverage,
    
    [Parameter(Mandatory=$false)]
    [string]$TestPattern = ""
)

$ErrorActionPreference = "Stop"
$script:startTime = Get-Date

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Service configurations
$services = @{
    "auth" = @{
        name = "auth-service"
        port = 3001
        health = "/health"
    }
    "client" = @{
        name = "client-service"
        port = 3002
        health = "/api/v1/health"
    }
    "policy" = @{
        name = "policy-service"
        port = 3003
        health = "/health"
    }
    "control" = @{
        name = "control-service"
        port = 3004
        health = "/health"
    }
    "evidence" = @{
        name = "evidence-service"
        port = 3005
        health = "/health"
    }
    "workflow" = @{
        name = "workflow-service"
        port = 3006
        health = "/health"
    }
    "reporting" = @{
        name = "reporting-service"
        port = 3007
        health = "/health"
    }
    "audit" = @{
        name = "audit-service"
        port = 3008
        health = "/health"
    }
    "integration" = @{
        name = "integration-service"
        port = 3009
        health = "/health"
    }
    "notification" = @{
        name = "notification-service"
        port = 3010
        health = "/health"
    }
    "ai" = @{
        name = "ai-service"
        port = 3011
        health = "/health"
    }
}

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker ps | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to wait for service health
function Wait-ForService {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$HealthPath,
        [int]$MaxRetries = 30
    )
    
    Write-Info "Waiting for $ServiceName to be healthy..."
    $retries = 0
    
    while ($retries -lt $MaxRetries) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port$HealthPath" -Method GET -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Success "✅ $ServiceName is healthy"
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        $retries++
        if ($retries -lt $MaxRetries) {
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Error "❌ $ServiceName failed to become healthy after $MaxRetries attempts"
    return $false
}

# Function to start test infrastructure
function Start-TestInfrastructure {
    Write-Info "`n🚀 Starting E2E test infrastructure..."
    
    # Start infrastructure services
    docker-compose -f docker/testing/docker-compose.e2e.yml up -d postgres-test redis-test kafka-test zookeeper-test mongodb-test elasticsearch-test maildev-test
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start test infrastructure"
        exit 1
    }
    
    Write-Info "Waiting for infrastructure services..."
    Start-Sleep -Seconds 10
    
    # Check PostgreSQL
    $pgReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            docker exec overmatch-digital-postgres-test-1 pg_isready -U test_user -d test_main | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $pgReady = $true
                break
            }
        } catch {
            # Not ready yet
        }
        Start-Sleep -Seconds 1
    }
    
    if (-not $pgReady) {
        Write-Error "PostgreSQL test database failed to start"
        exit 1
    }
    
    Write-Success "✅ Test infrastructure is ready"
}

# Function to build services
function Build-Services {
    param([string[]]$ServiceList)
    
    if ($SkipBuild) {
        Write-Warning "Skipping service build (-SkipBuild flag set)"
        return
    }
    
    Write-Info "`n🔨 Building services..."
    
    # Build shared packages first
    Write-Info "Building shared packages..."
    npm run build --workspace=@soc-compliance/auth-common
    npm run build --workspace=@soc-compliance/shared-contracts
    npm run build --workspace=@soc-compliance/shared-events
    
    # Build specific services
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceName = $services[$svc].name
            Write-Info "Building $serviceName..."
            docker-compose -f docker/testing/docker-compose.e2e.yml build "$serviceName-test"
        }
    }
}

# Function to start services
function Start-Services {
    param([string[]]$ServiceList)
    
    Write-Info "`n🚀 Starting services..."
    
    $serviceNames = @()
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceNames += "$($services[$svc].name)-test"
        }
    }
    
    docker-compose -f docker/testing/docker-compose.e2e.yml up -d $serviceNames
    
    # Wait for services to be healthy
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $config = $services[$svc]
            $healthy = Wait-ForService -ServiceName $config.name -Port $config.port -HealthPath $config.health
            if (-not $healthy) {
                Write-Error "Service startup failed"
                Show-ServiceLogs
                exit 1
            }
        }
    }
}

# Function to run tests
function Run-Tests {
    param([string[]]$ServiceList)
    
    Write-Info "`n🧪 Running E2E tests..."
    
    $failedServices = @()
    $passedServices = @()
    
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceName = $services[$svc].name
            $servicePath = "services/$serviceName"
            
            if (Test-Path "$servicePath/test/e2e") {
                Write-Info "`nRunning E2E tests for $serviceName..."
                
                Push-Location $servicePath
                try {
                    $env:NODE_ENV = "test"
                    if ($Debug) { $env:DEBUG = "*" }
                    
                    $testCommand = "npm run test:e2e"
                    if ($Coverage) { $testCommand += " -- --coverage" }
                    if ($TestPattern) { $testCommand += " -- --testNamePattern=`"$TestPattern`"" }
                    
                    Invoke-Expression $testCommand
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "✅ $serviceName E2E tests passed"
                        $passedServices += $serviceName
                    } else {
                        Write-Error "❌ $serviceName E2E tests failed"
                        $failedServices += $serviceName
                    }
                } finally {
                    Pop-Location
                    if ($Debug) { Remove-Item Env:DEBUG -ErrorAction SilentlyContinue }
                }
            } else {
                Write-Warning "⚠️  No E2E tests found for $serviceName"
            }
        }
    }
    
    # Summary
    Write-Info "`n📊 Test Summary:"
    Write-Info "Passed: $($passedServices.Count) services"
    Write-Info "Failed: $($failedServices.Count) services"
    
    if ($failedServices.Count -gt 0) {
        Write-Error "`nFailed services:"
        $failedServices | ForEach-Object { Write-Error "  - $_" }
        return $false
    }
    
    return $true
}

# Function to show service logs
function Show-ServiceLogs {
    Write-Info "`n📋 Service logs:"
    docker-compose -f docker/testing/docker-compose.e2e.yml logs --tail=50
}

# Function to cleanup
function Cleanup-TestEnvironment {
    Write-Info "`n🧹 Cleaning up test environment..."
    
    # Stop all test containers
    docker-compose -f docker/testing/docker-compose.e2e.yml down -v
    
    # Run cleanup script
    if (Test-Path "scripts/e2e/cleanup-test-data.ps1") {
        & "scripts/e2e/cleanup-test-data.ps1" -Full
    }
    
    Write-Success "✅ Cleanup complete"
}

# Main execution
Write-Info "=== SOC Compliance Platform - E2E Test Runner ==="
Write-Info "Service: $Service"
Write-Info "Debug: $Debug"
Write-Info "Coverage: $Coverage"
Write-Info ""

# Check Docker
if (-not (Test-DockerRunning)) {
    Write-Error "Docker is not running. Please start Docker Desktop."
    exit 1
}

# Determine which services to test
$servicesToTest = @()
if ($Service -eq "all") {
    $servicesToTest = $services.Keys
} else {
    $servicesToTest = $Service -split ","
}

try {
    # Start infrastructure
    Start-TestInfrastructure
    
    # Build services
    Build-Services -ServiceList $servicesToTest
    
    # Start services
    Start-Services -ServiceList $servicesToTest
    
    # Run tests
    $testsPassed = Run-Tests -ServiceList $servicesToTest
    
    if (-not $testsPassed) {
        Write-Error "`n❌ E2E tests failed"
        Show-ServiceLogs
        exit 1
    }
    
    Write-Success "`n✅ All E2E tests passed!"
    
} finally {
    $endTime = Get-Date
    $duration = $endTime - $script:startTime
    Write-Info "`nTotal time: $($duration.TotalMinutes.ToString('F2')) minutes"
    
    if (-not $KeepRunning) {
        Cleanup-TestEnvironment
    } else {
        Write-Warning "`nTest environment is still running. Run with -Cleanup to stop and clean up."
    }
}

if ($Cleanup -and $KeepRunning) {
    Write-Info "`nCleaning up existing test environment..."
    Cleanup-TestEnvironment
}