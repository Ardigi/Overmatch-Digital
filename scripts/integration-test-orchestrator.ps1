#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Integration Test Orchestrator
    
.DESCRIPTION
    Advanced orchestration utilities for managing complex integration test workflows.
    Provides dependency management, parallel execution, resource monitoring,
    and intelligent retry mechanisms for enterprise-grade integration testing.
    
.PARAMETER Workflow
    Predefined workflow: 'full', 'quick', 'smoke', 'critical', 'regression'
    
.PARAMETER MaxParallelServices
    Maximum number of services to test in parallel (default: 2)
    
.PARAMETER RetryFailedTests
    Retry failed tests with exponential backoff
    
.PARAMETER MonitorResources
    Monitor system resources during test execution
    
.PARAMETER AlertThresholds
    Resource alert thresholds (JSON format)
    
.PARAMETER ContinueOnNonCritical
    Continue execution even if non-critical services fail
    
.PARAMETER GenerateMetrics
    Generate detailed metrics and performance analysis
    
.PARAMETER NotificationWebhook
    Webhook URL for test completion notifications
    
.EXAMPLE
    .\scripts\integration-test-orchestrator.ps1 -Workflow full
    
.EXAMPLE
    .\scripts\integration-test-orchestrator.ps1 -Workflow critical -RetryFailedTests -MonitorResources
    
.EXAMPLE
    .\scripts\integration-test-orchestrator.ps1 -MaxParallelServices 3 -GenerateMetrics -NotificationWebhook "https://hooks.slack.com/..."
#>

param(
    [ValidateSet("full", "quick", "smoke", "critical", "regression", "custom")]
    [string]$Workflow = "full",
    [int]$MaxParallelServices = 2,
    [switch]$RetryFailedTests,
    [switch]$MonitorResources,
    [string]$AlertThresholds = '{"cpu": 80, "memory": 85, "disk": 90}',
    [switch]$ContinueOnNonCritical,
    [switch]$GenerateMetrics,
    [string]$NotificationWebhook = "",
    [string]$CustomConfig = ""
)

# Global orchestration state
$Script:Orchestration = @{
    StartTime = Get-Date
    EndTime = $null
    Workflow = $Workflow
    Status = "INITIALIZING"
    Services = @{}
    ResourceMetrics = @()
    Notifications = @()
    Retries = @{}
    Performance = @{}
    Alerts = @()
}

# Workflow definitions
$WorkflowDefinitions = @{
    full = @{
        Name = "Full Integration Test Suite"
        Services = @("auth", "client", "notification", "policy", "control", "evidence", "workflow", "reporting", "audit", "integration", "ai")
        Categories = @("redis", "database", "communication")
        ParallelExecution = $true
        CriticalOnly = $false
        MaxDuration = 1800  # 30 minutes
        RetryAttempts = 2
    }
    quick = @{
        Name = "Quick Integration Tests"
        Services = @("auth", "client", "notification")
        Categories = @("redis", "database")
        ParallelExecution = $true
        CriticalOnly = $true
        MaxDuration = 600  # 10 minutes
        RetryAttempts = 1
    }
    smoke = @{
        Name = "Smoke Test Suite"
        Services = @("auth", "client")
        Categories = @("redis")
        ParallelExecution = $false
        CriticalOnly = $true
        MaxDuration = 300  # 5 minutes
        RetryAttempts = 0
    }
    critical = @{
        Name = "Critical Services Only"
        Services = @("auth", "client", "notification")
        Categories = @("redis", "database", "communication")
        ParallelExecution = $false
        CriticalOnly = $true
        MaxDuration = 900  # 15 minutes
        RetryAttempts = 3
    }
    regression = @{
        Name = "Regression Test Suite"
        Services = @("auth", "client", "notification", "policy", "control")
        Categories = @("database", "communication")
        ParallelExecution = $true
        CriticalOnly = $false
        MaxDuration = 1200  # 20 minutes
        RetryAttempts = 2
    }
}

# Resource monitoring configuration
$ResourceThresholds = if ($AlertThresholds) {
    $AlertThresholds | ConvertFrom-Json
} else {
    @{ cpu = 80; memory = 85; disk = 90 }
}

# Utility Functions
function Write-OrchestratorStatus {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Component = "ORCHESTRATOR"
    )
    
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "FAILURE" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        "DEBUG" { "Gray" }
        default { "White" }
    }
    
    $icon = switch ($Level) {
        "SUCCESS" { "✅" }
        "FAILURE" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "🎯" }
        "DEBUG" { "🔍" }
        default { "•" }
    }
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $icon [$Component] $Message" -ForegroundColor $color
}

function Get-SystemResources {
    try {
        # CPU Usage
        $cpu = (Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        
        # Memory Usage
        $memory = Get-WmiObject -Class Win32_OperatingSystem
        $memoryUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)
        
        # Disk Usage (C: drive)
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
        $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)
        
        return @{
            Timestamp = Get-Date
            CPU = $cpu
            Memory = $memoryUsage
            Disk = $diskUsage
            AvailableMemoryGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
            FreeDiskSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
        }
    } catch {
        Write-OrchestratorStatus "Failed to get system resources: $($_.Exception.Message)" "WARNING" "MONITOR"
        return @{
            Timestamp = Get-Date
            CPU = 0
            Memory = 0
            Disk = 0
            Error = $_.Exception.Message
        }
    }
}

function Start-ResourceMonitoring {
    if (-not $MonitorResources) { return }
    
    Write-OrchestratorStatus "Starting resource monitoring" "INFO" "MONITOR"
    
    # Create background job for resource monitoring
    $monitoringJob = Start-Job -ScriptBlock {
        param($ThresholdJson, $AlertCallback)
        
        $thresholds = $ThresholdJson | ConvertFrom-Json
        
        while ($true) {
            try {
                # Get system resources
                $resources = & {
                    $cpu = (Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
                    $memory = Get-WmiObject -Class Win32_OperatingSystem
                    $memoryUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)
                    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
                    $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)
                    
                    @{
                        Timestamp = Get-Date
                        CPU = $cpu
                        Memory = $memoryUsage
                        Disk = $diskUsage
                    }
                }
                
                # Check thresholds
                $alerts = @()
                if ($resources.CPU -gt $thresholds.cpu) {
                    $alerts += "HIGH_CPU:$($resources.CPU)%"
                }
                if ($resources.Memory -gt $thresholds.memory) {
                    $alerts += "HIGH_MEMORY:$($resources.Memory)%"
                }
                if ($resources.Disk -gt $thresholds.disk) {
                    $alerts += "HIGH_DISK:$($resources.Disk)%"
                }
                
                # Output results
                [PSCustomObject]@{
                    Type = "RESOURCE_DATA"
                    Data = $resources
                    Alerts = $alerts
                }
                
                Start-Sleep -Seconds 10
                
            } catch {
                [PSCustomObject]@{
                    Type = "RESOURCE_ERROR"
                    Error = $_.Exception.Message
                }
                Start-Sleep -Seconds 30
            }
        }
    } -ArgumentList ($ResourceThresholds | ConvertTo-Json), $null
    
    return $monitoringJob
}

function Stop-ResourceMonitoring {
    param([System.Management.Automation.Job]$MonitoringJob)
    
    if ($MonitoringJob) {
        Write-OrchestratorStatus "Stopping resource monitoring" "INFO" "MONITOR"
        Stop-Job $MonitoringJob
        Remove-Job $MonitoringJob
    }
}

function Invoke-ServiceTestWithRetry {
    param(
        [string]$ServiceName,
        [string]$Category,
        [int]$MaxRetries = 2,
        [int]$InitialDelaySeconds = 30
    )
    
    $attempt = 1
    $delay = $InitialDelaySeconds
    
    while ($attempt -le ($MaxRetries + 1)) {
        Write-OrchestratorStatus "Testing $ServiceName (attempt $attempt/$(($MaxRetries + 1)))" "INFO" "RETRY"
        
        try {
            # Run the integration test
            $testArgs = @(
                "-Service", $ServiceName
                "-Category", $Category
                "-FailFast"
            )
            
            $testResult = & "$PSScriptRoot\run-integration-tests.ps1" @testArgs
            $success = $LASTEXITCODE -eq 0
            
            if ($success) {
                Write-OrchestratorStatus "$ServiceName tests passed on attempt $attempt" "SUCCESS" "RETRY"
                return @{
                    Success = $true
                    Attempts = $attempt
                    FinalResult = $testResult
                }
            } else {
                Write-OrchestratorStatus "$ServiceName tests failed on attempt $attempt" "WARNING" "RETRY"
                
                if ($attempt -le $MaxRetries) {
                    Write-OrchestratorStatus "Retrying $ServiceName in $delay seconds..." "INFO" "RETRY"
                    Start-Sleep -Seconds $delay
                    $delay = [math]::Min($delay * 2, 300)  # Exponential backoff, max 5 minutes
                }
            }
            
        } catch {
            Write-OrchestratorStatus "Error testing $ServiceName on attempt $attempt`: $($_.Exception.Message)" "FAILURE" "RETRY"
        }
        
        $attempt++
    }
    
    Write-OrchestratorStatus "$ServiceName tests failed after $MaxRetries retries" "FAILURE" "RETRY"
    return @{
        Success = $false
        Attempts = $attempt - 1
        FinalResult = $null
    }
}

function Invoke-ParallelServiceTests {
    param(
        [string[]]$Services,
        [string]$Category,
        [int]$MaxParallel,
        [bool]$AllowRetries
    )
    
    Write-OrchestratorStatus "Starting parallel execution of $($Services.Count) services (max $MaxParallel concurrent)" "INFO" "PARALLEL"
    
    $jobs = @()
    $results = @{}
    $serviceQueue = [System.Collections.Queue]::new($Services)
    
    # Start initial batch of jobs
    while ($jobs.Count -lt $MaxParallel -and $serviceQueue.Count -gt 0) {
        $serviceName = $serviceQueue.Dequeue()
        
        Write-OrchestratorStatus "Starting parallel test for $serviceName" "INFO" "PARALLEL"
        
        $job = Start-Job -ScriptBlock {
            param($ServiceName, $Category, $ScriptPath, $AllowRetries)
            
            try {
                $testArgs = @(
                    "-Service", $ServiceName
                    "-Category", $Category
                    "-FailFast"
                )
                
                if ($AllowRetries) {
                    # Use retry mechanism
                    $retryResult = & $ScriptPath\integration-test-orchestrator.ps1 -ServiceName $ServiceName -Category $Category -MaxRetries 2 -Mode "RetryOnly"
                    return @{
                        Service = $ServiceName
                        Success = $retryResult.Success
                        Attempts = $retryResult.Attempts
                        Output = $retryResult.FinalResult
                    }
                } else {
                    # Direct test execution
                    $testOutput = & $ScriptPath\run-integration-tests.ps1 @testArgs 2>&1
                    $success = $LASTEXITCODE -eq 0
                    
                    return @{
                        Service = $ServiceName
                        Success = $success
                        Attempts = 1
                        Output = $testOutput
                    }
                }
                
            } catch {
                return @{
                    Service = $ServiceName
                    Success = $false
                    Attempts = 1
                    Error = $_.Exception.Message
                }
            }
        } -ArgumentList $serviceName, $Category, $PSScriptRoot, $AllowRetries
        
        $jobs += @{
            Job = $job
            Service = $serviceName
            StartTime = Get-Date
        }
    }
    
    # Process completed jobs and start new ones
    while ($jobs.Count -gt 0 -or $serviceQueue.Count -gt 0) {
        # Check for completed jobs
        $completedJobs = $jobs | Where-Object { $_.Job.State -eq "Completed" }
        
        foreach ($completedJob in $completedJobs) {
            $result = Receive-Job $completedJob.Job
            $results[$completedJob.Service] = $result
            
            $duration = ((Get-Date) - $completedJob.StartTime).TotalSeconds
            $status = if ($result.Success) { "SUCCESS" } else { "FAILURE" }
            
            Write-OrchestratorStatus "$($completedJob.Service) completed in $([math]::Round($duration, 1))s" $status "PARALLEL"
            
            Remove-Job $completedJob.Job
            $jobs = $jobs | Where-Object { $_.Job.Id -ne $completedJob.Job.Id }
        }
        
        # Start new jobs if queue has items and we have capacity
        while ($jobs.Count -lt $MaxParallel -and $serviceQueue.Count -gt 0) {
            $serviceName = $serviceQueue.Dequeue()
            
            Write-OrchestratorStatus "Starting parallel test for $serviceName" "INFO" "PARALLEL"
            
            $job = Start-Job -ScriptBlock {
                param($ServiceName, $Category, $ScriptPath)
                
                try {
                    $testArgs = @(
                        "-Service", $ServiceName
                        "-Category", $Category
                        "-FailFast"
                    )
                    
                    $testOutput = & $ScriptPath\run-integration-tests.ps1 @testArgs 2>&1
                    $success = $LASTEXITCODE -eq 0
                    
                    return @{
                        Service = $ServiceName
                        Success = $success
                        Attempts = 1
                        Output = $testOutput
                    }
                    
                } catch {
                    return @{
                        Service = $ServiceName
                        Success = $false
                        Attempts = 1
                        Error = $_.Exception.Message
                    }
                }
            } -ArgumentList $serviceName, $Category, $PSScriptRoot
            
            $jobs += @{
                Job = $job
                Service = $serviceName
                StartTime = Get-Date
            }
        }
        
        # Wait a bit before checking again
        Start-Sleep -Seconds 2
    }
    
    Write-OrchestratorStatus "Parallel execution completed. Results: $($results.Count) services" "INFO" "PARALLEL"
    return $results
}

function Send-Notification {
    param(
        [string]$WebhookUrl,
        [object]$TestResults,
        [string]$WorkflowName
    )
    
    if (-not $WebhookUrl) { return }
    
    Write-OrchestratorStatus "Sending notification to webhook" "INFO" "NOTIFY"
    
    try {
        $totalTests = $TestResults.Services.Values | ForEach-Object { $_.PassedTests + $_.FailedTests + $_.SkippedTests } | Measure-Object -Sum | Select-Object -ExpandProperty Sum
        $passedTests = $TestResults.Services.Values | ForEach-Object { $_.PassedTests } | Measure-Object -Sum | Select-Object -ExpandProperty Sum
        $failedTests = $TestResults.Services.Values | ForEach-Object { $_.FailedTests } | Measure-Object -Sum | Select-Object -ExpandProperty Sum
        
        $passRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }
        $status = if ($failedTests -eq 0) { "SUCCESS" } else { "FAILURE" }
        $color = if ($failedTests -eq 0) { "good" } else { "danger" }
        
        $duration = if ($Script:Orchestration.EndTime) {
            [math]::Round(($Script:Orchestration.EndTime - $Script:Orchestration.StartTime).TotalMinutes, 1)
        } else { 0 }
        
        $payload = @{
            text = "Integration Test Results - $WorkflowName"
            attachments = @(
                @{
                    color = $color
                    title = "Test Execution Summary"
                    fields = @(
                        @{ title = "Status"; value = $status; short = $true }
                        @{ title = "Pass Rate"; value = "$passRate%"; short = $true }
                        @{ title = "Total Tests"; value = $totalTests; short = $true }
                        @{ title = "Duration"; value = "$duration min"; short = $true }
                        @{ title = "Passed"; value = $passedTests; short = $true }
                        @{ title = "Failed"; value = $failedTests; short = $true }
                    )
                    ts = [int][double]::Parse((Get-Date -UFormat %s))
                }
            )
        }
        
        $json = $payload | ConvertTo-Json -Depth 4
        Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $json -ContentType "application/json" -TimeoutSec 10
        
        Write-OrchestratorStatus "Notification sent successfully" "SUCCESS" "NOTIFY"
        
    } catch {
        Write-OrchestratorStatus "Failed to send notification: $($_.Exception.Message)" "WARNING" "NOTIFY"
    }
}

function Show-OrchestrationSummary {
    $Script:Orchestration.EndTime = Get-Date
    $totalDuration = ($Script:Orchestration.EndTime - $Script:Orchestration.StartTime).TotalMinutes
    
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "  INTEGRATION TEST ORCHESTRATION SUMMARY" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
    
    Write-Host ""
    Write-Host "🎯 Workflow: $($Script:Orchestration.Workflow)" -ForegroundColor Cyan
    Write-Host "⏱️  Duration: $([math]::Round($totalDuration, 2)) minutes" -ForegroundColor Cyan
    Write-Host "🔄 Status: $($Script:Orchestration.Status)" -ForegroundColor $(if ($Script:Orchestration.Status -eq "SUCCESS") { "Green" } else { "Red" })
    
    if ($Script:Orchestration.Services.Count -gt 0) {
        Write-Host ""
        Write-Host "📊 Service Results:" -ForegroundColor White
        
        foreach ($serviceName in $Script:Orchestration.Services.Keys) {
            $service = $Script:Orchestration.Services[$serviceName]
            $icon = if ($service.Success) { "✅" } else { "❌" }
            Write-Host "   $icon $serviceName`: $(if ($service.Success) { 'SUCCESS' } else { 'FAILURE' }) ($($service.Attempts) attempts)" -ForegroundColor Cyan
        }
    }
    
    if ($Script:Orchestration.ResourceMetrics.Count -gt 0) {
        Write-Host ""
        Write-Host "📈 Resource Usage:" -ForegroundColor White
        $avgCpu = ($Script:Orchestration.ResourceMetrics | Measure-Object CPU -Average).Average
        $maxMemory = ($Script:Orchestration.ResourceMetrics | Measure-Object Memory -Maximum).Maximum
        
        Write-Host "   Average CPU: $([math]::Round($avgCpu, 1))%" -ForegroundColor Cyan
        Write-Host "   Peak Memory: $([math]::Round($maxMemory, 1))%" -ForegroundColor Cyan
    }
    
    if ($Script:Orchestration.Alerts.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Alerts:" -ForegroundColor Yellow
        foreach ($alert in $Script:Orchestration.Alerts) {
            Write-Host "   • $alert" -ForegroundColor Yellow
        }
    }
    
    $overallSuccess = $Script:Orchestration.Status -eq "SUCCESS"
    
    Write-Host ""
    if ($overallSuccess) {
        Write-Host "🎉 ORCHESTRATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    } else {
        Write-Host "💥 ORCHESTRATION COMPLETED WITH FAILURES" -ForegroundColor Red
    }
    
    return $overallSuccess
}

# Main orchestration function
function Start-IntegrationTestOrchestration {
    param([hashtable]$WorkflowConfig)
    
    Write-Host ""
    Write-Host "🎭 SOC Compliance Platform - Integration Test Orchestrator" -ForegroundColor Magenta
    Write-Host "   Advanced workflow management for enterprise integration testing" -ForegroundColor Gray
    Write-Host "   Workflow: $($WorkflowConfig.Name)" -ForegroundColor Gray
    Write-Host "   Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    
    $Script:Orchestration.Status = "RUNNING"
    
    # Start resource monitoring if enabled
    $monitoringJob = if ($MonitorResources) { Start-ResourceMonitoring } else { $null }
    
    try {
        # Verify infrastructure
        Write-OrchestratorStatus "Verifying infrastructure prerequisites" "INFO" "SETUP"
        
        $verificationScript = Join-Path $PSScriptRoot "verify-integration-infrastructure.ps1"
        if (Test-Path $verificationScript) {
            $verificationResult = & $verificationScript
            if ($LASTEXITCODE -ne 0) {
                throw "Infrastructure verification failed"
            }
        }
        
        # Execute tests based on workflow configuration
        if ($WorkflowConfig.ParallelExecution -and $WorkflowConfig.Services.Count -gt 1) {
            Write-OrchestratorStatus "Using parallel execution strategy" "INFO" "STRATEGY"
            
            foreach ($category in $WorkflowConfig.Categories) {
                Write-OrchestratorStatus "Running $category tests in parallel" "INFO" "EXECUTE"
                
                $parallelResults = Invoke-ParallelServiceTests -Services $WorkflowConfig.Services -Category $category -MaxParallel $MaxParallelServices -AllowRetries $RetryFailedTests
                
                foreach ($serviceName in $parallelResults.Keys) {
                    $result = $parallelResults[$serviceName]
                    $Script:Orchestration.Services[$serviceName] = $result
                }
            }
            
        } else {
            Write-OrchestratorStatus "Using sequential execution strategy" "INFO" "STRATEGY"
            
            foreach ($serviceName in $WorkflowConfig.Services) {
                foreach ($category in $WorkflowConfig.Categories) {
                    Write-OrchestratorStatus "Testing service: $serviceName, category: $category" "INFO" "EXECUTE"
                    
                    if ($RetryFailedTests) {
                        $result = Invoke-ServiceTestWithRetry -ServiceName $serviceName -Category $category -MaxRetries $WorkflowConfig.RetryAttempts
                    } else {
                        # Direct execution
                        $testArgs = @(
                            "-Service", $serviceName
                            "-Category", $category
                            "-FailFast"
                        )
                        
                        $testResult = & "$PSScriptRoot\run-integration-tests.ps1" @testArgs
                        $success = $LASTEXITCODE -eq 0
                        
                        $result = @{
                            Success = $success
                            Attempts = 1
                            FinalResult = $testResult
                        }
                    }
                    
                    $Script:Orchestration.Services[$serviceName] = $result
                    
                    # Check if we should continue on failure
                    if (-not $result.Success -and -not $ContinueOnNonCritical) {
                        if ($WorkflowConfig.CriticalOnly) {
                            throw "Critical service $serviceName failed"
                        }
                    }
                }
            }
        }
        
        # Process resource monitoring data
        if ($monitoringJob) {
            $monitoringData = Receive-Job $monitoringJob -Keep
            foreach ($data in $monitoringData) {
                if ($data.Type -eq "RESOURCE_DATA") {
                    $Script:Orchestration.ResourceMetrics += $data.Data
                    
                    if ($data.Alerts.Count -gt 0) {
                        $Script:Orchestration.Alerts += $data.Alerts
                    }
                }
            }
        }
        
        # Determine overall success
        $failedServices = $Script:Orchestration.Services.Values | Where-Object { -not $_.Success }
        $criticalFailures = if ($WorkflowConfig.CriticalOnly) { $failedServices.Count } else { 0 }
        
        $Script:Orchestration.Status = if ($criticalFailures -eq 0) { "SUCCESS" } else { "FAILURE" }
        
        # Generate comprehensive report if requested
        if ($GenerateMetrics) {
            Write-OrchestratorStatus "Generating comprehensive metrics report" "INFO" "REPORT"
            
            $reportScript = Join-Path $PSScriptRoot "generate-integration-report.ps1"
            if (Test-Path $reportScript) {
                & $reportScript -Format "all" -IncludeHistorical -IncludeInfrastructure -GenerateTrends
            }
        }
        
        # Send notifications
        if ($NotificationWebhook) {
            $testResults = @{
                Services = $Script:Orchestration.Services
            }
            Send-Notification -WebhookUrl $NotificationWebhook -TestResults $testResults -WorkflowName $WorkflowConfig.Name
        }
        
    } catch {
        Write-OrchestratorStatus "Orchestration error: $($_.Exception.Message)" "FAILURE" "ERROR"
        $Script:Orchestration.Status = "ERROR"
        return $false
        
    } finally {
        if ($monitoringJob) {
            Stop-ResourceMonitoring $monitoringJob
        }
    }
    
    return Show-OrchestrationSummary
}

# Main execution
function Main {
    try {
        # Load workflow configuration
        if ($Workflow -eq "custom" -and $CustomConfig) {
            if (Test-Path $CustomConfig) {
                $workflowConfig = Get-Content $CustomConfig | ConvertFrom-Json
            } else {
                throw "Custom configuration file not found: $CustomConfig"
            }
        } elseif ($WorkflowDefinitions.ContainsKey($Workflow)) {
            $workflowConfig = $WorkflowDefinitions[$Workflow]
        } else {
            throw "Unknown workflow: $Workflow"
        }
        
        # Start orchestration
        return Start-IntegrationTestOrchestration $workflowConfig
        
    } catch {
        Write-Host ""
        Write-Host "💥 ORCHESTRATION INITIALIZATION FAILED: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Gray
        return $false
    }
}

# Execute main function and exit with appropriate code
$success = Main
exit $(if ($success) { 0 } else { 1 })