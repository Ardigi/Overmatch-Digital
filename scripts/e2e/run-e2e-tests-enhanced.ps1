# Enhanced E2E Test Runner with Best Practices
# Implements isolated test environments, parallel execution, and monitoring

param(
    [Parameter(Mandatory=$false)]
    [string]$Service = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$Parallel,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseEnhancedCompose,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory=$false)]
    [switch]$KeepRunning,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseIsolation,
    
    [Parameter(Mandatory=$false)]
    [string]$TestRunId = [System.Guid]::NewGuid().ToString().Substring(0, 8),
    
    [Parameter(Mandatory=$false)]
    [switch]$CollectMetrics,
    
    [Parameter(Mandatory=$false)]
    [switch]$Debug,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$script:startTime = Get-Date

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Test results storage
$script:testResults = @{
    passed = @()
    failed = @()
    skipped = @()
    metrics = @{}
}

# Service configurations
$services = @{
    "auth" = @{
        name = "auth-service"
        port = 3001
        health = "/health"
        critical = $true
        dependencies = @("postgres", "redis", "kafka")
    }
    "client" = @{
        name = "client-service"
        port = 3002
        health = "/api/v1/health"
        critical = $true
        dependencies = @("postgres", "kafka")
    }
    "policy" = @{
        name = "policy-service"
        port = 3003
        health = "/health"
        critical = $true
        dependencies = @("postgres", "kafka")
    }
    "control" = @{
        name = "control-service"
        port = 3004
        health = "/health"
        critical = $true
        dependencies = @("postgres", "redis", "kafka")
    }
    "evidence" = @{
        name = "evidence-service"
        port = 3005
        health = "/health"
        critical = $true
        dependencies = @("postgres", "mongodb", "kafka")
    }
    "workflow" = @{
        name = "workflow-service"
        port = 3006
        health = "/health"
        critical = $false
        dependencies = @("postgres", "kafka")
    }
    "reporting" = @{
        name = "reporting-service"
        port = 3007
        health = "/health"
        critical = $false
        dependencies = @("postgres", "redis", "kafka")
    }
    "audit" = @{
        name = "audit-service"
        port = 3008
        health = "/health"
        critical = $false
        dependencies = @("postgres", "kafka")
    }
    "integration" = @{
        name = "integration-service"
        port = 3009
        health = "/health"
        critical = $false
        dependencies = @("postgres", "kafka")
    }
    "notification" = @{
        name = "notification-service"
        port = 3010
        health = "/health"
        critical = $false
        dependencies = @("postgres", "redis", "kafka", "maildev")
    }
    "ai" = @{
        name = "ai-service"
        port = 3011
        health = "/health"
        critical = $false
        dependencies = @("mongodb", "elasticsearch", "kafka")
    }
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Docker
    if (-not (Test-DockerRunning)) {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Info "Node.js version: $nodeVersion"
    } catch {
        Write-Error "Node.js is not installed or not in PATH"
        exit 1
    }
    
    # Check shared packages are built
    $sharedPackages = @(
        "packages/auth-common/dist",
        "shared/contracts/dist",
        "shared/events/dist"
    )
    
    $missingPackages = $sharedPackages | Where-Object { -not (Test-Path $_) }
    if ($missingPackages.Count -gt 0) {
        Write-Warning "Shared packages not built. Building now..."
        npm run build:shared
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build shared packages"
            exit 1
        }
    }
    
    Write-Success "✅ Prerequisites check passed"
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

# Function to select docker-compose file
function Get-DockerComposeFile {
    if ($UseEnhancedCompose) {
        return "docker-compose.e2e.enhanced.yml"
    } else {
        return "docker-compose.e2e.yml"
    }
}

# Function to start test infrastructure
function Start-TestInfrastructure {
    Write-Info "`n🚀 Starting E2E test infrastructure..."
    
    $composeFile = Get-DockerComposeFile
    Write-Info "Using compose file: $composeFile"
    
    # Start infrastructure services first
    $infraServices = @(
        "postgres-test",
        "redis-test",
        "mongodb-test",
        "elasticsearch-test",
        "zookeeper-test",
        "kafka-test",
        "maildev-test"
    )
    
    if ($CollectMetrics) {
        $infraServices += "test-monitor"
    }
    
    if (-not $DryRun) {
        docker-compose -f $composeFile up -d $infraServices
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start test infrastructure"
            exit 1
        }
    }
    
    Write-Info "Waiting for infrastructure services..."
    if (-not $DryRun) {
        Start-Sleep -Seconds 15
        
        # Verify infrastructure health
        Test-InfrastructureHealth
    }
    
    # Setup test isolation if requested
    if ($UseIsolation) {
        Write-Info "Setting up test isolation..."
        & "$PSScriptRoot\test-isolation.ps1" -TestRunId $TestRunId -Action setup
    }
    
    Write-Success "✅ Test infrastructure is ready"
}

# Function to test infrastructure health
function Test-InfrastructureHealth {
    Write-Info "Checking infrastructure health..."
    
    # Check PostgreSQL
    $pgReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            docker exec overmatch-digital-postgres-test-1 pg_isready -U test_user -d test_main | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $pgReady = $true
                Write-Success "✅ PostgreSQL is ready"
                break
            }
        } catch {
            # Not ready yet
        }
        Start-Sleep -Seconds 1
    }
    
    if (-not $pgReady) {
        Write-Error "PostgreSQL test database failed to start"
        Show-ServiceLogs -Service "postgres-test"
        exit 1
    }
    
    # Check Redis
    try {
        docker exec overmatch-digital-redis-test-1 redis-cli -a test_redis_pass ping | Out-Null
        Write-Success "✅ Redis is ready"
    } catch {
        Write-Error "Redis test instance failed to start"
        exit 1
    }
    
    # Check Kafka
    try {
        docker exec overmatch-digital-kafka-test-1 kafka-broker-api-versions --bootstrap-server localhost:9092 | Out-Null
        Write-Success "✅ Kafka is ready"
    } catch {
        Write-Error "Kafka test instance failed to start"
        exit 1
    }
}

# Function to build services
function Build-Services {
    param([string[]]$ServiceList)
    
    if ($SkipBuild) {
        Write-Warning "Skipping service build (-SkipBuild flag set)"
        return
    }
    
    Write-Info "`n🔨 Building services..."
    
    $composeFile = Get-DockerComposeFile
    
    if ($Parallel) {
        Write-Info "Building services in parallel..."
        $jobs = @()
        
        foreach ($svc in $ServiceList) {
            if ($services.ContainsKey($svc)) {
                $serviceName = $services[$svc].name
                $job = Start-Job -ScriptBlock {
                    param($compose, $service)
                    docker-compose -f $compose build "$service-test"
                } -ArgumentList $composeFile, $serviceName
                $jobs += $job
            }
        }
        
        # Wait for all builds to complete
        $jobs | Wait-Job
        $failed = $jobs | Where-Object { $_.State -eq "Failed" }
        
        if ($failed.Count -gt 0) {
            Write-Error "Some services failed to build"
            $jobs | Receive-Job
            exit 1
        }
        
        $jobs | Remove-Job
    } else {
        # Sequential build
        foreach ($svc in $ServiceList) {
            if ($services.ContainsKey($svc)) {
                $serviceName = $services[$svc].name
                Write-Info "Building $serviceName..."
                
                if (-not $DryRun) {
                    docker-compose -f $composeFile build "$serviceName-test"
                    if ($LASTEXITCODE -ne 0) {
                        Write-Error "Failed to build $serviceName"
                        exit 1
                    }
                }
            }
        }
    }
    
    Write-Success "✅ Services built successfully"
}

# Function to start services
function Start-Services {
    param([string[]]$ServiceList)
    
    Write-Info "`n🚀 Starting services..."
    
    $composeFile = Get-DockerComposeFile
    $serviceNames = @()
    
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceNames += "$($services[$svc].name)-test"
        }
    }
    
    if (-not $DryRun) {
        docker-compose -f $composeFile up -d $serviceNames
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start services"
            exit 1
        }
    }
    
    # Wait for services to be healthy
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $config = $services[$svc]
            if (-not $DryRun) {
                $healthy = Wait-ForServiceHealth -ServiceName $config.name -Port $config.port -HealthPath $config.health
                if (-not $healthy -and $config.critical) {
                    Write-Error "Critical service startup failed: $($config.name)"
                    Show-ServiceLogs -Service "$($config.name)-test"
                    exit 1
                }
            }
        }
    }
    
    Write-Success "✅ All services started"
}

# Function to wait for service health
function Wait-ForServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$HealthPath,
        [int]$MaxRetries = 60
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
            if ($Debug) {
                Write-Warning "Health check attempt $($retries + 1) failed: $_"
            }
        }
        
        $retries++
        if ($retries -lt $MaxRetries) {
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Error "❌ $ServiceName failed to become healthy after $MaxRetries attempts"
    return $false
}

# Function to run tests
function Run-Tests {
    param([string[]]$ServiceList)
    
    Write-Info "`n🧪 Running E2E tests..."
    
    if ($Parallel) {
        Run-TestsParallel -ServiceList $ServiceList
    } else {
        Run-TestsSequential -ServiceList $ServiceList
    }
    
    # Generate test report
    Show-TestReport
}

# Function to run tests sequentially
function Run-TestsSequential {
    param([string[]]$ServiceList)
    
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceName = $services[$svc].name
            $servicePath = "services/$serviceName"
            
            if (Test-Path "$servicePath/test/e2e") {
                Write-Info "`nRunning E2E tests for $serviceName..."
                
                $testStart = Get-Date
                
                Push-Location $servicePath
                try {
                    $env:NODE_ENV = "test"
                    if ($Debug) { $env:DEBUG = "*" }
                    if ($UseIsolation) { 
                        $env:TEST_RUN_ID = $TestRunId
                        # Load isolation environment
                        if (Test-Path "$PSScriptRoot/test-isolation-${TestRunId}.env") {
                            Get-Content "$PSScriptRoot/test-isolation-${TestRunId}.env" | ForEach-Object {
                                if ($_ -match '^(.+?)=(.+)$') {
                                    [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
                                }
                            }
                        }
                    }
                    
                    if (-not $DryRun) {
                        npm run test:e2e
                        
                        $testEnd = Get-Date
                        $duration = ($testEnd - $testStart).TotalSeconds
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-Success "✅ $serviceName E2E tests passed (${duration}s)"
                            $script:testResults.passed += $serviceName
                            $script:testResults.metrics[$serviceName] = @{
                                duration = $duration
                                status = "passed"
                            }
                        } else {
                            Write-Error "❌ $serviceName E2E tests failed"
                            $script:testResults.failed += $serviceName
                            $script:testResults.metrics[$serviceName] = @{
                                duration = $duration
                                status = "failed"
                            }
                        }
                    }
                } finally {
                    Pop-Location
                    if ($Debug) { Remove-Item Env:DEBUG -ErrorAction SilentlyContinue }
                    if ($UseIsolation) { Remove-Item Env:TEST_RUN_ID -ErrorAction SilentlyContinue }
                }
            } else {
                Write-Warning "⚠️  No E2E tests found for $serviceName"
                $script:testResults.skipped += $serviceName
            }
        }
    }
}

# Function to run tests in parallel
function Run-TestsParallel {
    param([string[]]$ServiceList)
    
    Write-Info "Running tests in parallel..."
    
    $jobs = @()
    
    foreach ($svc in $ServiceList) {
        if ($services.ContainsKey($svc)) {
            $serviceName = $services[$svc].name
            $servicePath = "services/$serviceName"
            
            if (Test-Path "$servicePath/test/e2e") {
                $job = Start-Job -ScriptBlock {
                    param($service, $path, $debug, $isolation, $runId)
                    
                    Set-Location $path
                    $env:NODE_ENV = "test"
                    if ($debug) { $env:DEBUG = "*" }
                    if ($isolation) { $env:TEST_RUN_ID = $runId }
                    
                    $result = @{
                        service = $service
                        start = Get-Date
                    }
                    
                    try {
                        npm run test:e2e 2>&1
                        $result.success = $LASTEXITCODE -eq 0
                    } catch {
                        $result.success = $false
                        $result.error = $_.Exception.Message
                    }
                    
                    $result.end = Get-Date
                    $result.duration = ($result.end - $result.start).TotalSeconds
                    
                    return $result
                } -ArgumentList $serviceName, (Get-Location).Path, $Debug, $UseIsolation, $TestRunId
                
                $jobs += @{
                    job = $job
                    service = $serviceName
                }
            }
        }
    }
    
    # Wait for all jobs to complete
    Write-Info "Waiting for parallel tests to complete..."
    $completed = 0
    
    while ($jobs.Count -gt 0) {
        $running = $jobs | Where-Object { $_.job.State -eq "Running" }
        $finished = $jobs | Where-Object { $_.job.State -ne "Running" }
        
        foreach ($j in $finished) {
            $result = Receive-Job -Job $j.job
            
            if ($result.success) {
                Write-Success "✅ $($result.service) passed ($($result.duration)s)"
                $script:testResults.passed += $result.service
            } else {
                Write-Error "❌ $($result.service) failed"
                $script:testResults.failed += $result.service
            }
            
            $script:testResults.metrics[$result.service] = @{
                duration = $result.duration
                status = if ($result.success) { "passed" } else { "failed" }
            }
            
            Remove-Job -Job $j.job
            $completed++
        }
        
        $jobs = $jobs | Where-Object { $_.job.State -eq "Running" }
        
        if ($jobs.Count -gt 0) {
            Write-Progress -Activity "Running E2E Tests" -Status "$completed tests completed, $($jobs.Count) running" -PercentComplete (($completed / ($completed + $jobs.Count)) * 100)
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Progress -Activity "Running E2E Tests" -Completed
}

# Function to show service logs
function Show-ServiceLogs {
    param([string]$Service = "")
    
    Write-Info "`n📋 Service logs:"
    $composeFile = Get-DockerComposeFile
    
    if ($Service) {
        docker-compose -f $composeFile logs --tail=100 $Service
    } else {
        docker-compose -f $composeFile logs --tail=50
    }
}

# Function to cleanup test environment
function Cleanup-TestEnvironment {
    Write-Info "`n🧹 Cleaning up test environment..."
    
    # Cleanup test isolation if used
    if ($UseIsolation) {
        & "$PSScriptRoot\test-isolation.ps1" -TestRunId $TestRunId -Action cleanup
    }
    
    # Stop all test containers
    $composeFile = Get-DockerComposeFile
    docker-compose -f $composeFile down -v
    
    Write-Success "✅ Cleanup complete"
}

# Function to show test report
function Show-TestReport {
    Write-Info "`n📊 Test Report:"
    Write-Info "================================"
    Write-Info "Test Run ID: $TestRunId"
    Write-Info "Total Services: $($script:testResults.passed.Count + $script:testResults.failed.Count + $script:testResults.skipped.Count)"
    Write-Success "Passed: $($script:testResults.passed.Count)"
    Write-Error "Failed: $($script:testResults.failed.Count)"
    Write-Warning "Skipped: $($script:testResults.skipped.Count)"
    
    if ($script:testResults.failed.Count -gt 0) {
        Write-Info "`nFailed services:"
        $script:testResults.failed | ForEach-Object { Write-Error "  - $_" }
    }
    
    if ($CollectMetrics) {
        Write-Info "`nTest Execution Metrics:"
        $totalDuration = 0
        $script:testResults.metrics.GetEnumerator() | Sort-Object Name | ForEach-Object {
            $status = if ($_.Value.status -eq "passed") { "✅" } else { "❌" }
            Write-Host "  $status $($_.Key): $([Math]::Round($_.Value.duration, 2))s"
            $totalDuration += $_.Value.duration
        }
        Write-Info "  Total test duration: $([Math]::Round($totalDuration, 2))s"
    }
    
    # Export test results
    $reportFile = "test-report-${TestRunId}.json"
    $report = @{
        runId = $TestRunId
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        duration = ((Get-Date) - $script:startTime).TotalSeconds
        results = $script:testResults
        configuration = @{
            parallel = $Parallel
            isolation = $UseIsolation
            enhancedCompose = $UseEnhancedCompose
        }
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8
    Write-Info "`nTest report saved to: $reportFile"
}

# Main execution
Write-Info "=== SOC Compliance Platform - Enhanced E2E Test Runner ==="
Write-Info "Test Run ID: $TestRunId"
Write-Info "Service: $Service"
Write-Info "Parallel: $Parallel"
Write-Info "Isolation: $UseIsolation"
Write-Info ""

# Check prerequisites
Test-Prerequisites

# Determine which services to test
$servicesToTest = @()
if ($Service -eq "all") {
    $servicesToTest = $services.Keys
} else {
    $servicesToTest = $Service -split ","
}

# Filter for critical services only if requested
if ($Service -eq "critical") {
    $servicesToTest = $services.GetEnumerator() | Where-Object { $_.Value.critical } | ForEach-Object { $_.Key }
}

try {
    # Start infrastructure
    Start-TestInfrastructure
    
    # Build services
    Build-Services -ServiceList $servicesToTest
    
    # Start services
    Start-Services -ServiceList $servicesToTest
    
    # Run tests
    Run-Tests -ServiceList $servicesToTest
    
    # Check if all tests passed
    if ($script:testResults.failed.Count -eq 0) {
        Write-Success "`n✅ All E2E tests passed!"
        $exitCode = 0
    } else {
        Write-Error "`n❌ Some E2E tests failed"
        if (-not $Debug) {
            Show-ServiceLogs
        }
        $exitCode = 1
    }
    
} catch {
    Write-Error "`n❌ Test execution failed: $_"
    Write-Error $_.ScriptStackTrace
    $exitCode = 1
} finally {
    $endTime = Get-Date
    $duration = $endTime - $script:startTime
    Write-Info "`nTotal time: $($duration.TotalMinutes.ToString('F2')) minutes"
    
    if (-not $KeepRunning) {
        Cleanup-TestEnvironment
    } else {
        Write-Warning "`nTest environment is still running."
        Write-Info "View logs: docker-compose -f $(Get-DockerComposeFile) logs -f"
        Write-Info "Stop environment: docker-compose -f $(Get-DockerComposeFile) down -v"
        if ($UseIsolation) {
            Write-Info "Cleanup isolation: .\scripts\e2e\test-isolation.ps1 -TestRunId $TestRunId -Action cleanup"
        }
    }
    
    exit $exitCode
}