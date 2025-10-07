#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Integration Test Runner for SOC Compliance Platform
    
.DESCRIPTION
    Comprehensive integration test runner that manages test execution across all microservices.
    Handles dependencies, provides detailed reporting, and ensures proper test isolation.
    
.PARAMETER Service
    Run integration tests for specific service(s). Use 'all' for all services.
    
.PARAMETER Category
    Run specific test category: 'redis', 'database', 'communication', or 'all'
    
.PARAMETER FailFast
    Stop execution on first test failure
    
.PARAMETER Parallel
    Run non-dependent tests in parallel (experimental)
    
.PARAMETER Detailed
    Show detailed test output and timing information
    
.PARAMETER DryRun
    Show what would be executed without running tests
    
.PARAMETER SkipInfrastructureCheck
    Skip infrastructure verification (not recommended)
    
.PARAMETER GenerateReport
    Generate comprehensive test report after execution
    
.EXAMPLE
    .\scripts\run-integration-tests.ps1
    
.EXAMPLE
    .\scripts\run-integration-tests.ps1 -Service auth,client -Category redis -Detailed
    
.EXAMPLE
    .\scripts\run-integration-tests.ps1 -Service all -FailFast -GenerateReport
#>

param(
    [string[]]$Service = @(),
    [ValidateSet("redis", "database", "communication", "all")]
    [string]$Category = "all",
    [switch]$FailFast,
    [switch]$Parallel,
    [switch]$Detailed,
    [switch]$DryRun,
    [switch]$SkipInfrastructureCheck,
    [switch]$GenerateReport
)

# Global configuration
$Script:TestResults = @{
    StartTime = Get-Date
    EndTime = $null
    TotalTests = 0
    PassedTests = 0
    FailedTests = 0
    SkippedTests = 0
    Services = @{}
    Categories = @{}
    Failures = @()
    Performance = @{}
}

# Service configuration with dependencies and test categories
$ServiceConfig = @{
    "auth" = @{
        Name = "auth-service"
        Directory = "services/auth-service"
        Dependencies = @()
        TestCategories = @{
            redis = @("src/modules/auth/integration/redis-cache.integration.spec.ts")
            database = @("src/modules/auth/integration/database.integration.spec.ts")
            communication = @("src/modules/auth/integration/service-communication.integration.spec.ts")
            session = @("src/modules/auth/auth.session.integration.spec.ts")
            anomaly = @("src/modules/auth/anomaly-detection.integration.spec.ts")
        }
        Critical = $true
        Port = 3001
    }
    "client" = @{
        Name = "client-service"
        Directory = "services/client-service"
        Dependencies = @("auth")
        TestCategories = @{
            redis = @("src/modules/clients/integration/redis-cache.integration.spec.ts")
            database = @("src/modules/clients/integration/database.integration.spec.ts")
            multitenancy = @("src/modules/clients/integration/multi-tenancy.integration.spec.ts")
        }
        Critical = $true
        Port = 3002
    }
    "notification" = @{
        Name = "notification-service"
        Directory = "services/notification-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            redis = @("src/modules/notifications/integration/redis-cache.integration.spec.ts")
            database = @("src/modules/notifications/integration/database.integration.spec.ts")
            communication = @("src/modules/notifications/integration/service-communication.integration.spec.ts")
        }
        Critical = $true
        Port = 3010
    }
    "policy" = @{
        Name = "policy-service"
        Directory = "services/policy-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            database = @("src/modules/policies/__tests__/policies.integration.spec.ts")
            service = @("src/modules/policies/__tests__/policies.service.integration.spec.ts")
        }
        Critical = $false
        Port = 3003
    }
    "control" = @{
        Name = "control-service"
        Directory = "services/control-service"
        Dependencies = @("auth", "client", "policy")
        TestCategories = @{
            database = @("src/modules/controls/__tests__/controls.integration.spec.ts")
            service = @("src/modules/controls/__tests__/controls.service.integration.spec.ts")
        }
        Critical = $false
        Port = 3004
    }
    "evidence" = @{
        Name = "evidence-service"
        Directory = "services/evidence-service"
        Dependencies = @("auth", "client", "control")
        TestCategories = @{
            service = @("src/modules/evidence/evidence.integration.spec.ts")
        }
        Critical = $false
        Port = 3005
    }
    "workflow" = @{
        Name = "workflow-service"
        Directory = "services/workflow-service"
        Dependencies = @("auth", "client", "control")
        TestCategories = @{
            service = @("src/workflow-service.integration.spec.ts")
        }
        Critical = $false
        Port = 3006
    }
    "reporting" = @{
        Name = "reporting-service"
        Directory = "services/reporting-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            service = @("src/reporting-service.integration.spec.ts")
        }
        Critical = $false
        Port = 3007
    }
    "audit" = @{
        Name = "audit-service"
        Directory = "services/audit-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            service = @("src/modules/audits/audit-integration.service.ts")
        }
        Critical = $false
        Port = 3008
    }
    "integration" = @{
        Name = "integration-service"
        Directory = "services/integration-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            service = @("src/integration-service.integration.spec.ts")
        }
        Critical = $false
        Port = 3009
    }
    "ai" = @{
        Name = "ai-service"
        Directory = "services/ai-service"
        Dependencies = @("auth", "client")
        TestCategories = @{
            service = @("src/ai-service.integration.spec.ts")
        }
        Critical = $false
        Port = 3011
    }
}

# Utility Functions
function Write-TestHeader {
    param([string]$Title, [string]$Subtitle = "")
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    if ($Subtitle) {
        Write-Host "  $Subtitle" -ForegroundColor Gray
    }
    Write-Host "=" * 80 -ForegroundColor Cyan
}

function Write-TestStatus {
    param(
        [string]$Message,
        [string]$Status = "INFO",
        [string]$Details = ""
    )
    
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "FAILURE" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        "SKIP" { "Gray" }
        default { "White" }
    }
    
    $icon = switch ($Status) {
        "SUCCESS" { "✅" }
        "FAILURE" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "ℹ️" }
        "SKIP" { "⏭️" }
        default { "•" }
    }
    
    Write-Host "$icon $Message" -ForegroundColor $color
    if ($Details -and $Detailed) {
        Write-Host "   📋 $Details" -ForegroundColor Gray
    }
}

function Get-TestExecutionOrder {
    param([string[]]$RequestedServices)
    
    # If no services specified, run all
    if ($RequestedServices.Count -eq 0 -or $RequestedServices -contains "all") {
        $RequestedServices = $ServiceConfig.Keys
    }
    
    # Validate requested services
    $validServices = @()
    foreach ($service in $RequestedServices) {
        if ($ServiceConfig.ContainsKey($service)) {
            $validServices += $service
        } else {
            Write-TestStatus "Unknown service: $service" "WARNING"
        }
    }
    
    if ($validServices.Count -eq 0) {
        throw "No valid services specified"
    }
    
    # Topological sort for dependency resolution
    $sorted = @()
    $visiting = @{}
    $visited = @{}
    
    function Visit-Service {
        param([string]$ServiceName)
        
        if ($visited.ContainsKey($ServiceName)) { return }
        if ($visiting.ContainsKey($ServiceName)) {
            throw "Circular dependency detected involving $ServiceName"
        }
        
        $visiting[$ServiceName] = $true
        
        foreach ($dependency in $ServiceConfig[$ServiceName].Dependencies) {
            if ($validServices -contains $dependency) {
                Visit-Service $dependency
            }
        }
        
        $visiting.Remove($ServiceName)
        $visited[$ServiceName] = $true
        $sorted += $ServiceName
    }
    
    foreach ($service in $validServices) {
        Visit-Service $service
    }
    
    return $sorted
}

function Test-ServiceAvailability {
    param([string]$ServiceName)
    
    $config = $ServiceConfig[$ServiceName]
    $url = "http://127.0.0.1:$($config.Port)/health"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5 -Headers @{"X-API-Key" = "test-api-key"} -ErrorAction Stop
        return ($response.status -eq "ok" -or $response.success -eq $true)
    } catch {
        return $false
    }
}

function Invoke-ServiceIntegrationTests {
    param(
        [string]$ServiceName,
        [string]$TestCategory = "all"
    )
    
    $config = $ServiceConfig[$ServiceName]
    $serviceDir = Join-Path $PWD $config.Directory
    $startTime = Get-Date
    
    Write-TestStatus "Starting integration tests for $($config.Name)" "INFO"
    
    # Initialize service results
    $Script:TestResults.Services[$ServiceName] = @{
        StartTime = $startTime
        EndTime = $null
        Status = "RUNNING"
        TestFiles = @()
        PassedTests = 0
        FailedTests = 0
        SkippedTests = 0
        Output = ""
        Errors = @()
    }
    
    # Check if service directory exists
    if (-not (Test-Path $serviceDir)) {
        $errorMsg = "Service directory not found: $serviceDir"
        Write-TestStatus $errorMsg "FAILURE"
        $Script:TestResults.Services[$ServiceName].Status = "ERROR"
        $Script:TestResults.Services[$ServiceName].Errors += $errorMsg
        return $false
    }
    
    # Check if service is available (for communication tests)
    $serviceAvailable = Test-ServiceAvailability $ServiceName
    if (-not $serviceAvailable -and ($TestCategory -eq "communication" -or $TestCategory -eq "all")) {
        Write-TestStatus "Service $($config.Name) is not running - communication tests will be skipped" "WARNING"
    }
    
    # Determine test files to run
    $testFiles = @()
    if ($TestCategory -eq "all") {
        foreach ($category in $config.TestCategories.Keys) {
            $testFiles += $config.TestCategories[$category]
        }
    } elseif ($config.TestCategories.ContainsKey($TestCategory)) {
        $testFiles = $config.TestCategories[$TestCategory]
    } else {
        Write-TestStatus "Category '$TestCategory' not available for $ServiceName" "SKIP"
        return $true
    }
    
    # Filter existing test files
    $existingTestFiles = @()
    foreach ($testFile in $testFiles) {
        $fullPath = Join-Path $serviceDir $testFile
        if (Test-Path $fullPath) {
            $existingTestFiles += $testFile
        } else {
            Write-TestStatus "Test file not found: $testFile" "WARNING" "Skipping missing test file"
        }
    }
    
    if ($existingTestFiles.Count -eq 0) {
        Write-TestStatus "No integration test files found for $ServiceName" "SKIP"
        $Script:TestResults.Services[$ServiceName].Status = "SKIPPED"
        return $true
    }
    
    $Script:TestResults.Services[$ServiceName].TestFiles = $existingTestFiles
    
    # Run tests
    $overallSuccess = $true
    
    foreach ($testFile in $existingTestFiles) {
        if ($DryRun) {
            Write-TestStatus "Would run: $testFile" "INFO" "Dry run mode"
            continue
        }
        
        Write-TestStatus "Running: $testFile" "INFO"
        
        try {
            # Change to service directory
            Push-Location $serviceDir
            
            # Run Jest with integration config
            $jestConfigFile = "jest.integration.config.js"
            if (-not (Test-Path $jestConfigFile)) {
                throw "Integration test configuration not found: $jestConfigFile"
            }
            
            # Construct Jest command
            $jestArgs = @(
                "--config", $jestConfigFile
                "--testPathPattern", $testFile.Replace('\', '/')
                "--verbose"
                "--runInBand"  # Run tests sequentially
                "--detectOpenHandles"
                "--forceExit"
            )
            
            if (-not $Detailed) {
                $jestArgs += "--silent"
            }
            
            # Execute Jest
            $testStartTime = Get-Date
            $jestResult = & npm test -- @jestArgs 2>&1
            $testEndTime = Get-Date
            $testDuration = ($testEndTime - $testStartTime).TotalSeconds
            
            # Parse results
            $exitCode = $LASTEXITCODE
            $success = $exitCode -eq 0
            
            if ($success) {
                Write-TestStatus "Test passed: $testFile" "SUCCESS" "Duration: $([math]::Round($testDuration, 2))s"
                $Script:TestResults.Services[$ServiceName].PassedTests++
                $Script:TestResults.PassedTests++
            } else {
                Write-TestStatus "Test failed: $testFile" "FAILURE" "Exit code: $exitCode"
                $Script:TestResults.Services[$ServiceName].FailedTests++
                $Script:TestResults.FailedTests++
                $Script:TestResults.Failures += @{
                    Service = $ServiceName
                    TestFile = $testFile
                    ExitCode = $exitCode
                    Output = $jestResult
                    Duration = $testDuration
                }
                $overallSuccess = $false
                
                if ($FailFast) {
                    Write-TestStatus "Stopping execution due to FailFast mode" "WARNING"
                    break
                }
            }
            
            # Store performance data
            $Script:TestResults.Performance["$ServiceName.$testFile"] = @{
                Duration = $testDuration
                Success = $success
                Timestamp = $testStartTime
            }
            
            $Script:TestResults.TotalTests++
            
        } catch {
            $errorMsg = "Error running test $testFile`: $($_.Exception.Message)"
            Write-TestStatus $errorMsg "FAILURE"
            $Script:TestResults.Services[$ServiceName].Errors += $errorMsg
            $overallSuccess = $false
            
            if ($FailFast) {
                break
            }
        } finally {
            Pop-Location
        }
    }
    
    # Update service results
    $Script:TestResults.Services[$ServiceName].EndTime = Get-Date
    $Script:TestResults.Services[$ServiceName].Status = if ($overallSuccess) { "SUCCESS" } else { "FAILURE" }
    
    return $overallSuccess
}

function Show-ExecutionPlan {
    param([string[]]$Services, [string]$Category)
    
    Write-TestHeader "Integration Test Execution Plan"
    
    Write-Host "🎯 Target Configuration:" -ForegroundColor White
    Write-Host "   Services: $($Services -join ', ')" -ForegroundColor Cyan
    Write-Host "   Category: $Category" -ForegroundColor Cyan
    Write-Host "   Execution: $(if ($Parallel) { 'Parallel' } else { 'Sequential' })" -ForegroundColor Cyan
    Write-Host "   Fail Fast: $(if ($FailFast) { 'Enabled' } else { 'Disabled' })" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📋 Execution Order:" -ForegroundColor White
    
    $executionOrder = Get-TestExecutionOrder $Services
    for ($i = 0; $i -lt $executionOrder.Count; $i++) {
        $serviceName = $executionOrder[$i]
        $config = $ServiceConfig[$serviceName]
        $status = if (Test-ServiceAvailability $serviceName) { "🟢" } else { "🔴" }
        
        Write-Host "   $($i + 1). $status $($config.Name)" -ForegroundColor Cyan
        
        if ($config.Dependencies.Count -gt 0) {
            Write-Host "      Dependencies: $($config.Dependencies -join ', ')" -ForegroundColor Gray
        }
        
        # Show test files for this category
        $testFiles = @()
        if ($Category -eq "all") {
            foreach ($cat in $config.TestCategories.Keys) {
                $testFiles += $config.TestCategories[$cat]
            }
        } elseif ($config.TestCategories.ContainsKey($Category)) {
            $testFiles = $config.TestCategories[$Category]
        }
        
        if ($testFiles.Count -gt 0) {
            Write-Host "      Test Files:" -ForegroundColor Gray
            foreach ($testFile in $testFiles) {
                $fullPath = Join-Path $PWD (Join-Path $config.Directory $testFile)
                $exists = Test-Path $fullPath
                $indicator = if ($exists) { "✅" } else { "❌" }
                Write-Host "        $indicator $testFile" -ForegroundColor Gray
            }
        } else {
            Write-Host "      No tests for category: $Category" -ForegroundColor Yellow
        }
    }
    
    if ($DryRun) {
        Write-Host ""
        Write-Host "🔍 DRY RUN MODE - No tests will be executed" -ForegroundColor Yellow
        return $false
    }
    
    return $true
}

function Show-TestSummary {
    $Script:TestResults.EndTime = Get-Date
    $totalDuration = ($Script:TestResults.EndTime - $Script:TestResults.StartTime).TotalSeconds
    
    Write-TestHeader "Integration Test Summary"
    
    Write-Host "📊 Overall Results:" -ForegroundColor White
    Write-Host "   Total Tests: $($Script:TestResults.TotalTests)" -ForegroundColor Cyan
    Write-Host "   Passed: $($Script:TestResults.PassedTests)" -ForegroundColor Green
    Write-Host "   Failed: $($Script:TestResults.FailedTests)" -ForegroundColor Red
    Write-Host "   Skipped: $($Script:TestResults.SkippedTests)" -ForegroundColor Yellow
    Write-Host "   Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor Cyan
    
    # Service breakdown
    Write-Host ""
    Write-Host "🔍 Service Breakdown:" -ForegroundColor White
    foreach ($serviceName in $Script:TestResults.Services.Keys) {
        $serviceResult = $Script:TestResults.Services[$serviceName]
        $serviceDuration = if ($serviceResult.EndTime) {
            ($serviceResult.EndTime - $serviceResult.StartTime).TotalSeconds
        } else { 0 }
        
        $statusIcon = switch ($serviceResult.Status) {
            "SUCCESS" { "✅" }
            "FAILURE" { "❌" }
            "SKIPPED" { "⏭️" }
            "ERROR" { "💥" }
            default { "⏳" }
        }
        
        Write-Host "   $statusIcon $serviceName`: $($serviceResult.Status) ($([math]::Round($serviceDuration, 2))s)" -ForegroundColor Cyan
        Write-Host "      Tests: $($serviceResult.PassedTests) passed, $($serviceResult.FailedTests) failed, $($serviceResult.SkippedTests) skipped" -ForegroundColor Gray
        
        if ($serviceResult.Errors.Count -gt 0) {
            foreach ($error in $serviceResult.Errors) {
                Write-Host "      ❌ $error" -ForegroundColor Red
            }
        }
    }
    
    # Failure details
    if ($Script:TestResults.Failures.Count -gt 0) {
        Write-Host ""
        Write-Host "💥 Failure Details:" -ForegroundColor Red
        foreach ($failure in $Script:TestResults.Failures) {
            Write-Host "   Service: $($failure.Service)" -ForegroundColor Red
            Write-Host "   Test: $($failure.TestFile)" -ForegroundColor Red
            Write-Host "   Exit Code: $($failure.ExitCode)" -ForegroundColor Red
            Write-Host "   Duration: $([math]::Round($failure.Duration, 2))s" -ForegroundColor Red
            Write-Host ""
        }
    }
    
    # Performance summary
    if ($Script:TestResults.Performance.Count -gt 0) {
        Write-Host ""
        Write-Host "⚡ Performance Summary:" -ForegroundColor White
        $sortedPerf = $Script:TestResults.Performance.GetEnumerator() | Sort-Object { $_.Value.Duration } -Descending | Select-Object -First 5
        
        Write-Host "   Slowest Tests:" -ForegroundColor Gray
        foreach ($perf in $sortedPerf) {
            $status = if ($perf.Value.Success) { "✅" } else { "❌" }
            Write-Host "      $status $($perf.Key): $([math]::Round($perf.Value.Duration, 2))s" -ForegroundColor Gray
        }
    }
    
    # Final result
    Write-Host ""
    if ($Script:TestResults.FailedTests -eq 0) {
        Write-Host "🎉 ALL INTEGRATION TESTS PASSED!" -ForegroundColor Green
        return $true
    } else {
        Write-Host "💥 INTEGRATION TESTS FAILED" -ForegroundColor Red
        Write-Host "   $($Script:TestResults.FailedTests) test(s) failed out of $($Script:TestResults.TotalTests)" -ForegroundColor Red
        return $false
    }
}

# Main execution function
function Main {
    try {
        Write-Host ""
        Write-Host "🧪 SOC Compliance Platform - Integration Test Runner" -ForegroundColor Magenta
        Write-Host "   Running real integration tests against live infrastructure" -ForegroundColor Gray
        Write-Host "   Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
        
        # Infrastructure verification
        if (-not $SkipInfrastructureCheck) {
            Write-TestStatus "Verifying integration test infrastructure..." "INFO"
            
            $verificationScript = Join-Path $PSScriptRoot "verify-integration-infrastructure.ps1"
            if (Test-Path $verificationScript) {
                $verificationResult = & $verificationScript
                if ($LASTEXITCODE -ne 0) {
                    Write-TestStatus "Infrastructure verification failed" "FAILURE"
                    Write-Host ""
                    Write-Host "💡 Run infrastructure verification manually:" -ForegroundColor Yellow
                    Write-Host "   .\scripts\verify-integration-infrastructure.ps1 -Detailed" -ForegroundColor Cyan
                    return $false
                }
                Write-TestStatus "Infrastructure verification passed" "SUCCESS"
            } else {
                Write-TestStatus "Infrastructure verification script not found" "WARNING"
            }
        }
        
        # Show execution plan
        $executionOrder = Get-TestExecutionOrder $Service
        if (-not (Show-ExecutionPlan $executionOrder $Category)) {
            return $true  # Dry run completed
        }
        
        # Execute tests
        Write-TestHeader "Executing Integration Tests"
        
        $overallSuccess = $true
        foreach ($serviceName in $executionOrder) {
            $testSuccess = Invoke-ServiceIntegrationTests $serviceName $Category
            
            if (-not $testSuccess) {
                $overallSuccess = $false
                if ($FailFast) {
                    Write-TestStatus "Stopping execution due to failure and FailFast mode" "WARNING"
                    break
                }
            }
        }
        
        # Show summary
        $finalSuccess = Show-TestSummary
        
        # Generate report if requested
        if ($GenerateReport) {
            Write-TestStatus "Generating comprehensive test report..." "INFO"
            $reportScript = Join-Path $PSScriptRoot "generate-integration-report.ps1"
            if (Test-Path $reportScript) {
                & $reportScript -TestResults $Script:TestResults
            } else {
                Write-TestStatus "Report generator not found" "WARNING"
            }
        }
        
        return $finalSuccess
        
    } catch {
        Write-Host ""
        Write-Host "💥 INTEGRATION TEST RUNNER ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Gray
        return $false
    }
}

# Execute main function and exit with appropriate code
$success = Main
exit $(if ($success) { 0 } else { 1 })