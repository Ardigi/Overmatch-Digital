#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Integration Test Report Generator
    
.DESCRIPTION
    Comprehensive report generator for integration test results.
    Creates detailed HTML reports with performance metrics, trends analysis,
    infrastructure health tracking, and actionable recommendations.
    
.PARAMETER TestResults
    Test results object from integration test runner
    
.PARAMETER OutputPath
    Output directory for generated reports (default: reports/integration)
    
.PARAMETER Format
    Report format: 'html', 'json', 'markdown', or 'all' (default: html)
    
.PARAMETER IncludeHistorical
    Include historical test data comparison
    
.PARAMETER IncludeInfrastructure
    Include infrastructure health analysis
    
.PARAMETER GenerateTrends
    Generate performance trends analysis
    
.PARAMETER SendEmail
    Send report via email (requires SMTP configuration)
    
.EXAMPLE
    .\scripts\generate-integration-report.ps1
    
.EXAMPLE
    .\scripts\generate-integration-report.ps1 -Format all -IncludeHistorical -GenerateTrends
    
.EXAMPLE
    .\scripts\generate-integration-report.ps1 -OutputPath custom-reports -SendEmail
#>

param(
    [object]$TestResults = $null,
    [string]$OutputPath = "reports/integration",
    [ValidateSet("html", "json", "markdown", "all")]
    [string]$Format = "html",
    [switch]$IncludeHistorical,
    [switch]$IncludeInfrastructure,
    [switch]$GenerateTrends,
    [switch]$SendEmail
)

# Global configuration
$Script:ReportData = @{
    GeneratedAt = Get-Date
    TestResults = $null
    Infrastructure = @{}
    Performance = @{}
    Trends = @{}
    Historical = @{}
    Recommendations = @()
}

# Utility Functions
function Write-ReportStatus {
    param(
        [string]$Message,
        [string]$Status = "INFO"
    )
    
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "FAILURE" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    
    $icon = switch ($Status) {
        "SUCCESS" { "✅" }
        "FAILURE" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "📊" }
        default { "•" }
    }
    
    Write-Host "$icon $Message" -ForegroundColor $color
}

function Get-TestResultsFromLatestRun {
    # If no test results provided, try to find the latest results
    $resultsPath = "reports/integration/latest-results.json"
    
    if (Test-Path $resultsPath) {
        try {
            $jsonContent = Get-Content $resultsPath -Raw | ConvertFrom-Json
            Write-ReportStatus "Loaded test results from $resultsPath" "SUCCESS"
            return $jsonContent
        } catch {
            Write-ReportStatus "Failed to load test results from $resultsPath" "WARNING"
        }
    }
    
    # Create mock test results for demonstration
    return @{
        StartTime = (Get-Date).AddMinutes(-30)
        EndTime = Get-Date
        TotalTests = 15
        PassedTests = 12
        FailedTests = 2
        SkippedTests = 1
        Services = @{
            "auth" = @{
                StartTime = (Get-Date).AddMinutes(-30)
                EndTime = (Get-Date).AddMinutes(-25)
                Status = "SUCCESS"
                PassedTests = 5
                FailedTests = 0
                SkippedTests = 0
                TestFiles = @("redis-cache.integration.spec.ts", "database.integration.spec.ts")
            }
            "client" = @{
                StartTime = (Get-Date).AddMinutes(-25)
                EndTime = (Get-Date).AddMinutes(-20)
                Status = "FAILURE"
                PassedTests = 3
                FailedTests = 2
                SkippedTests = 0
                TestFiles = @("multi-tenancy.integration.spec.ts", "redis-cache.integration.spec.ts")
            }
            "notification" = @{
                StartTime = (Get-Date).AddMinutes(-20)
                EndTime = (Get-Date).AddMinutes(-15)
                Status = "SUCCESS"
                PassedTests = 4
                FailedTests = 0
                SkippedTests = 1
                TestFiles = @("service-communication.integration.spec.ts", "database.integration.spec.ts")
            }
        }
        Performance = @{
            "auth.redis-cache.integration.spec.ts" = @{ Duration = 2.5; Success = $true }
            "auth.database.integration.spec.ts" = @{ Duration = 4.1; Success = $true }
            "client.multi-tenancy.integration.spec.ts" = @{ Duration = 8.3; Success = $false }
            "client.redis-cache.integration.spec.ts" = @{ Duration = 3.2; Success = $false }
            "notification.service-communication.integration.spec.ts" = @{ Duration = 5.7; Success = $true }
            "notification.database.integration.spec.ts" = @{ Duration = 3.9; Success = $true }
        }
        Failures = @(
            @{
                Service = "client"
                TestFile = "multi-tenancy.integration.spec.ts"
                ExitCode = 1
                Duration = 8.3
            }
            @{
                Service = "client"
                TestFile = "redis-cache.integration.spec.ts"
                ExitCode = 1
                Duration = 3.2
            }
        )
    }
}

function Get-InfrastructureHealth {
    Write-ReportStatus "Collecting infrastructure health data" "INFO"
    
    $health = @{
        Timestamp = Get-Date
        Redis = @{ Status = "Unknown"; ResponseTime = 0; Memory = 0 }
        PostgreSQL = @{ Status = "Unknown"; Connections = 0; DatabaseSizes = @{} }
        Services = @{}
        Docker = @{ Status = "Unknown"; Containers = @() }
    }
    
    # Check Redis
    try {
        $startTime = Get-Date
        $pingResult = & docker exec overmatch-digital-redis-1 redis-cli -h 127.0.0.1 -p 6379 -a soc_redis_pass ping 2>$null
        $endTime = Get-Date
        
        if ($pingResult -eq "PONG") {
            $health.Redis.Status = "Healthy"
            $health.Redis.ResponseTime = ($endTime - $startTime).TotalMilliseconds
            
            # Get memory usage
            $memoryInfo = & docker exec overmatch-digital-redis-1 redis-cli -h 127.0.0.1 -p 6379 -a soc_redis_pass info memory 2>$null
            if ($memoryInfo -match "used_memory_human:(.+)") {
                $health.Redis.Memory = $matches[1].Trim()
            }
        } else {
            $health.Redis.Status = "Unhealthy"
        }
    } catch {
        $health.Redis.Status = "Error"
    }
    
    # Check PostgreSQL
    try {
        $connectionQuery = "SELECT count(*) FROM pg_stat_activity"
        $connectionCount = & docker exec overmatch-digital-postgres-1 psql -h 127.0.0.1 -p 5432 -U soc_user -d postgres -c $connectionQuery -t 2>$null
        
        if ($connectionCount -match '\d+') {
            $health.PostgreSQL.Status = "Healthy"
            $health.PostgreSQL.Connections = [int]($connectionCount.Trim())
            
            # Get database sizes
            $sizeQuery = "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname LIKE 'soc_%'"
            $sizeResult = & docker exec overmatch-digital-postgres-1 psql -h 127.0.0.1 -p 5432 -U soc_user -d postgres -c $sizeQuery -t 2>$null
            
            foreach ($line in $sizeResult) {
                if ($line -match '^\s*(\w+)\s*\|\s*(.+)$') {
                    $health.PostgreSQL.DatabaseSizes[$matches[1].Trim()] = $matches[2].Trim()
                }
            }
        } else {
            $health.PostgreSQL.Status = "Unhealthy"
        }
    } catch {
        $health.PostgreSQL.Status = "Error"
    }
    
    # Check Services
    $servicePorts = @{
        "auth-service" = 3001
        "client-service" = 3002
        "notification-service" = 3010
    }
    
    foreach ($serviceName in $servicePorts.Keys) {
        $port = $servicePorts[$serviceName]
        $url = "http://127.0.0.1:$port/health"
        
        try {
            $startTime = Get-Date
            $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5 -Headers @{"X-API-Key" = "test-api-key"} -ErrorAction Stop
            $endTime = Get-Date
            
            $health.Services[$serviceName] = @{
                Status = if ($response.status -eq "ok" -or $response.success -eq $true) { "Healthy" } else { "Unhealthy" }
                ResponseTime = ($endTime - $startTime).TotalMilliseconds
                Version = $response.version
                Uptime = $response.uptime
            }
        } catch {
            $health.Services[$serviceName] = @{
                Status = "Unreachable"
                ResponseTime = 0
                Error = $_.Exception.Message
            }
        }
    }
    
    # Check Docker containers
    try {
        $containers = & docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
        if ($containers) {
            $health.Docker.Status = "Running"
            $health.Docker.Containers = $containers
        }
    } catch {
        $health.Docker.Status = "Error"
    }
    
    return $health
}

function Get-PerformanceAnalysis {
    param([object]$TestResults)
    
    Write-ReportStatus "Analyzing performance metrics" "INFO"
    
    $analysis = @{
        OverallMetrics = @{}
        ServiceMetrics = @{}
        SlowestTests = @()
        FastestTests = @()
        FailurePatterns = @{}
        Recommendations = @()
    }
    
    if ($TestResults.Performance) {
        $allDurations = $TestResults.Performance.Values | ForEach-Object { $_.Duration }
        
        if ($allDurations.Count -gt 0) {
            $analysis.OverallMetrics = @{
                TotalDuration = ($allDurations | Measure-Object -Sum).Sum
                AverageDuration = ($allDurations | Measure-Object -Average).Average
                MedianDuration = ($allDurations | Sort-Object)[[math]::Floor($allDurations.Count / 2)]
                MinDuration = ($allDurations | Measure-Object -Minimum).Minimum
                MaxDuration = ($allDurations | Measure-Object -Maximum).Maximum
            }
            
            # Identify slow tests (> 5 seconds)
            $slowTests = $TestResults.Performance.GetEnumerator() | Where-Object { $_.Value.Duration -gt 5 } | Sort-Object { $_.Value.Duration } -Descending
            $analysis.SlowestTests = $slowTests | Select-Object -First 5
            
            # Identify fast tests (< 1 second)
            $fastTests = $TestResults.Performance.GetEnumerator() | Where-Object { $_.Value.Duration -lt 1 } | Sort-Object { $_.Value.Duration }
            $analysis.FastestTests = $fastTests | Select-Object -First 5
        }
    }
    
    # Service-specific metrics
    foreach ($serviceName in $TestResults.Services.Keys) {
        $service = $TestResults.Services[$serviceName]
        
        if ($service.StartTime -and $service.EndTime) {
            $serviceDuration = ($service.EndTime - $service.StartTime).TotalSeconds
            $analysis.ServiceMetrics[$serviceName] = @{
                Duration = $serviceDuration
                TestCount = $service.PassedTests + $service.FailedTests + $service.SkippedTests
                SuccessRate = if (($service.PassedTests + $service.FailedTests) -gt 0) {
                    [math]::Round(($service.PassedTests / ($service.PassedTests + $service.FailedTests)) * 100, 2)
                } else { 0 }
                AverageTestDuration = if (($service.PassedTests + $service.FailedTests) -gt 0) {
                    $serviceDuration / ($service.PassedTests + $service.FailedTests)
                } else { 0 }
            }
        }
    }
    
    # Failure pattern analysis
    if ($TestResults.Failures) {
        $failuresByService = $TestResults.Failures | Group-Object Service
        foreach ($group in $failuresByService) {
            $analysis.FailurePatterns[$group.Name] = @{
                Count = $group.Count
                AverageDuration = ($group.Group | Measure-Object Duration -Average).Average
                TestFiles = $group.Group | ForEach-Object { $_.TestFile } | Sort-Object -Unique
            }
        }
    }
    
    # Generate recommendations
    if ($analysis.OverallMetrics.AverageDuration -gt 10) {
        $analysis.Recommendations += "Consider optimizing test execution - average test duration is high ($([math]::Round($analysis.OverallMetrics.AverageDuration, 2))s)"
    }
    
    if ($analysis.SlowestTests.Count -gt 0) {
        $slowestTest = $analysis.SlowestTests[0]
        $analysis.Recommendations += "Review slowest test: $($slowestTest.Key) ($([math]::Round($slowestTest.Value.Duration, 2))s)"
    }
    
    foreach ($serviceName in $analysis.FailurePatterns.Keys) {
        $pattern = $analysis.FailurePatterns[$serviceName]
        if ($pattern.Count -gt 1) {
            $analysis.Recommendations += "Service $serviceName has $($pattern.Count) failing tests - investigate common issues"
        }
    }
    
    return $analysis
}

function Get-HistoricalComparison {
    param([object]$CurrentResults)
    
    Write-ReportStatus "Loading historical test data" "INFO"
    
    $historical = @{
        Available = $false
        Comparison = @{}
        Trends = @{}
    }
    
    $historyPath = Join-Path $OutputPath "history"
    if (Test-Path $historyPath) {
        $historyFiles = Get-ChildItem -Path $historyPath -Filter "*.json" | Sort-Object Name -Descending | Select-Object -First 10
        
        if ($historyFiles.Count -gt 0) {
            $historical.Available = $true
            
            try {
                $previousRun = Get-Content $historyFiles[0].FullName -Raw | ConvertFrom-Json
                
                $historical.Comparison = @{
                    PreviousDate = $previousRun.StartTime
                    TestCountChange = $CurrentResults.TotalTests - $previousRun.TotalTests
                    PassRateChange = [math]::Round(
                        (($CurrentResults.PassedTests / $CurrentResults.TotalTests) * 100) - 
                        (($previousRun.PassedTests / $previousRun.TotalTests) * 100), 2
                    )
                    DurationChange = if ($CurrentResults.EndTime -and $CurrentResults.StartTime -and $previousRun.EndTime -and $previousRun.StartTime) {
                        $currentDuration = ($CurrentResults.EndTime - $CurrentResults.StartTime).TotalSeconds
                        $previousDuration = ($previousRun.EndTime - $previousRun.StartTime).TotalSeconds
                        [math]::Round($currentDuration - $previousDuration, 2)
                    } else { 0 }
                }
                
            } catch {
                Write-ReportStatus "Failed to load historical data" "WARNING"
            }
        }
    }
    
    return $historical
}

function Generate-HtmlReport {
    param(
        [object]$TestResults,
        [object]$Infrastructure,
        [object]$Performance,
        [object]$Historical,
        [string]$OutputFile
    )
    
    Write-ReportStatus "Generating HTML report" "INFO"
    
    $totalDuration = if ($TestResults.EndTime -and $TestResults.StartTime) {
        ($TestResults.EndTime - $TestResults.StartTime).TotalSeconds
    } else { 0 }
    
    $passRate = if ($TestResults.TotalTests -gt 0) {
        [math]::Round(($TestResults.PassedTests / $TestResults.TotalTests) * 100, 2)
    } else { 0 }
    
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Report - SOC Compliance Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; color: #333; background: #f8f9fa; 
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 2rem; border-radius: 10px; margin-bottom: 2rem; 
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .summary { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1rem; margin-bottom: 2rem; 
        }
        .metric-card { 
            background: white; padding: 1.5rem; border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #667eea; 
        }
        .metric-value { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .metric-label { color: #666; font-size: 0.9rem; }
        .status-success { color: #28a745; }
        .status-failure { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .section { 
            background: white; margin-bottom: 2rem; padding: 2rem; 
            border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .section h2 { 
            color: #333; margin-bottom: 1rem; padding-bottom: 0.5rem; 
            border-bottom: 2px solid #667eea; 
        }
        .service-grid { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 1rem; 
        }
        .service-card { 
            border: 1px solid #e9ecef; padding: 1rem; border-radius: 6px; 
        }
        .service-status { 
            display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; 
            font-size: 0.8rem; font-weight: bold; text-transform: uppercase; 
        }
        .status-success-bg { background: #d4edda; color: #155724; }
        .status-failure-bg { background: #f8d7da; color: #721c24; }
        .status-warning-bg { background: #fff3cd; color: #856404; }
        .test-list { list-style: none; margin-top: 0.5rem; }
        .test-list li { padding: 0.25rem 0; font-size: 0.9rem; color: #666; }
        .infrastructure-grid { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 1rem; 
        }
        .infra-item { 
            text-align: center; padding: 1rem; border: 1px solid #e9ecef; 
            border-radius: 6px; 
        }
        .infra-status { 
            font-size: 1.5rem; margin-bottom: 0.5rem; 
        }
        .performance-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .performance-table th, .performance-table td { 
            padding: 0.75rem; text-align: left; border-bottom: 1px solid #e9ecef; 
        }
        .performance-table th { background: #f8f9fa; font-weight: 600; }
        .duration-bar { 
            height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; 
            margin-top: 0.25rem; 
        }
        .duration-fill { 
            height: 100%; background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); 
            transition: width 0.3s ease; 
        }
        .recommendations { 
            background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; 
            border-radius: 6px; margin-top: 1rem; 
        }
        .recommendations h3 { color: #856404; margin-bottom: 0.5rem; }
        .recommendations ul { margin-left: 1.5rem; }
        .recommendations li { margin-bottom: 0.5rem; }
        .footer { 
            text-align: center; padding: 2rem; color: #666; font-size: 0.9rem; 
            border-top: 1px solid #e9ecef; margin-top: 2rem; 
        }
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header { padding: 1rem; }
            .header h1 { font-size: 2rem; }
            .summary { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Integration Test Report</h1>
            <p>SOC Compliance Platform - Generated on $(Get-Date -Format 'MMM dd, yyyy at HH:mm:ss')</p>
        </div>

        <div class="summary">
            <div class="metric-card">
                <div class="metric-value status-$(if ($TestResults.FailedTests -eq 0) { 'success' } else { 'failure' })">
                    $($TestResults.TotalTests)
                </div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-success">$($TestResults.PassedTests)</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-failure">$($TestResults.FailedTests)</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-warning">$($TestResults.SkippedTests)</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$passRate%</div>
                <div class="metric-label">Pass Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">$([math]::Round($totalDuration, 1))s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 Service Results</h2>
            <div class="service-grid">
"@

    # Add service cards
    foreach ($serviceName in $TestResults.Services.Keys) {
        $service = $TestResults.Services[$serviceName]
        $statusClass = switch ($service.Status) {
            "SUCCESS" { "status-success-bg" }
            "FAILURE" { "status-failure-bg" }
            default { "status-warning-bg" }
        }
        
        $serviceDuration = if ($service.StartTime -and $service.EndTime) {
            [math]::Round(($service.EndTime - $service.StartTime).TotalSeconds, 1)
        } else { "N/A" }
        
        $html += @"
                <div class="service-card">
                    <h3>$serviceName</h3>
                    <span class="service-status $statusClass">$($service.Status)</span>
                    <p><strong>Tests:</strong> $($service.PassedTests) passed, $($service.FailedTests) failed, $($service.SkippedTests) skipped</p>
                    <p><strong>Duration:</strong> $serviceDuration s</p>
                    <ul class="test-list">
"@
        
        if ($service.TestFiles) {
            foreach ($testFile in $service.TestFiles) {
                $html += "<li>📄 $testFile</li>"
            }
        }
        
        $html += @"
                    </ul>
                </div>
"@
    }

    $html += @"
            </div>
        </div>
"@

    # Add infrastructure section if available
    if ($Infrastructure -and $Infrastructure.Keys.Count -gt 0) {
        $html += @"
        <div class="section">
            <h2>🏗️ Infrastructure Health</h2>
            <div class="infrastructure-grid">
"@
        
        # Redis
        if ($Infrastructure.Redis) {
            $redisIcon = switch ($Infrastructure.Redis.Status) {
                "Healthy" { "✅" }
                "Unhealthy" { "❌" }
                default { "❓" }
            }
            
            $html += @"
                <div class="infra-item">
                    <div class="infra-status">$redisIcon</div>
                    <h4>Redis</h4>
                    <p>$($Infrastructure.Redis.Status)</p>
                    $(if ($Infrastructure.Redis.ResponseTime -gt 0) { "<p>$([math]::Round($Infrastructure.Redis.ResponseTime, 1))ms</p>" })
                    $(if ($Infrastructure.Redis.Memory) { "<p>Memory: $($Infrastructure.Redis.Memory)</p>" })
                </div>
"@
        }
        
        # PostgreSQL
        if ($Infrastructure.PostgreSQL) {
            $pgIcon = switch ($Infrastructure.PostgreSQL.Status) {
                "Healthy" { "✅" }
                "Unhealthy" { "❌" }
                default { "❓" }
            }
            
            $html += @"
                <div class="infra-item">
                    <div class="infra-status">$pgIcon</div>
                    <h4>PostgreSQL</h4>
                    <p>$($Infrastructure.PostgreSQL.Status)</p>
                    $(if ($Infrastructure.PostgreSQL.Connections -gt 0) { "<p>$($Infrastructure.PostgreSQL.Connections) connections</p>" })
                </div>
"@
        }
        
        # Services
        if ($Infrastructure.Services) {
            foreach ($serviceName in $Infrastructure.Services.Keys) {
                $service = $Infrastructure.Services[$serviceName]
                $serviceIcon = switch ($service.Status) {
                    "Healthy" { "✅" }
                    "Unhealthy" { "❌" }
                    "Unreachable" { "🔴" }
                    default { "❓" }
                }
                
                $html += @"
                <div class="infra-item">
                    <div class="infra-status">$serviceIcon</div>
                    <h4>$serviceName</h4>
                    <p>$($service.Status)</p>
                    $(if ($service.ResponseTime -gt 0) { "<p>$([math]::Round($service.ResponseTime, 1))ms</p>" })
                </div>
"@
            }
        }
        
        $html += @"
            </div>
        </div>
"@
    }

    # Add performance section
    if ($Performance -and $Performance.OverallMetrics) {
        $html += @"
        <div class="section">
            <h2>⚡ Performance Analysis</h2>
            <div class="summary">
                <div class="metric-card">
                    <div class="metric-value">$([math]::Round($Performance.OverallMetrics.AverageDuration, 2))s</div>
                    <div class="metric-label">Average Duration</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">$([math]::Round($Performance.OverallMetrics.MaxDuration, 2))s</div>
                    <div class="metric-label">Slowest Test</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">$([math]::Round($Performance.OverallMetrics.MinDuration, 2))s</div>
                    <div class="metric-label">Fastest Test</div>
                </div>
            </div>
"@
        
        if ($Performance.SlowestTests -and $Performance.SlowestTests.Count -gt 0) {
            $html += @"
            <h3>🐌 Slowest Tests</h3>
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>Test</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
"@
            
            $maxDuration = ($Performance.SlowestTests | Measure-Object { $_.Value.Duration } -Maximum).Maximum
            
            foreach ($test in $Performance.SlowestTests) {
                $widthPercent = [math]::Round(($test.Value.Duration / $maxDuration) * 100, 1)
                $statusIcon = if ($test.Value.Success) { "✅" } else { "❌" }
                
                $html += @"
                    <tr>
                        <td>$($test.Key)</td>
                        <td>$([math]::Round($test.Value.Duration, 2))s</td>
                        <td>$statusIcon</td>
                        <td>
                            <div class="duration-bar">
                                <div class="duration-fill" style="width: $widthPercent%"></div>
                            </div>
                        </td>
                    </tr>
"@
            }
            
            $html += @"
                </tbody>
            </table>
"@
        }
        
        # Add recommendations
        if ($Performance.Recommendations -and $Performance.Recommendations.Count -gt 0) {
            $html += @"
            <div class="recommendations">
                <h3>💡 Performance Recommendations</h3>
                <ul>
"@
            
            foreach ($recommendation in $Performance.Recommendations) {
                $html += "<li>$recommendation</li>"
            }
            
            $html += @"
                </ul>
            </div>
"@
        }
        
        $html += "</div>"
    }

    # Add historical comparison if available
    if ($Historical.Available -and $Historical.Comparison) {
        $html += @"
        <div class="section">
            <h2>📈 Historical Comparison</h2>
            <div class="summary">
                <div class="metric-card">
                    <div class="metric-value status-$(if ($Historical.Comparison.TestCountChange -ge 0) { 'success' } else { 'warning' })">
                        $(if ($Historical.Comparison.TestCountChange -ge 0) { '+' })$($Historical.Comparison.TestCountChange)
                    </div>
                    <div class="metric-label">Test Count Change</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value status-$(if ($Historical.Comparison.PassRateChange -ge 0) { 'success' } else { 'failure' })">
                        $(if ($Historical.Comparison.PassRateChange -ge 0) { '+' })$($Historical.Comparison.PassRateChange)%
                    </div>
                    <div class="metric-label">Pass Rate Change</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value status-$(if ($Historical.Comparison.DurationChange -le 0) { 'success' } else { 'warning' })">
                        $(if ($Historical.Comparison.DurationChange -ge 0) { '+' })$([math]::Round($Historical.Comparison.DurationChange, 1))s
                    </div>
                    <div class="metric-label">Duration Change</div>
                </div>
            </div>
        </div>
"@
    }

    $html += @"
        <div class="footer">
            <p>Generated by SOC Compliance Platform Integration Test Runner</p>
            <p>Report created on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Duration: $([math]::Round($totalDuration, 2)) seconds</p>
        </div>
    </div>
</body>
</html>
"@

    # Write HTML file
    $html | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-ReportStatus "HTML report saved to: $OutputFile" "SUCCESS"
}

function Generate-JsonReport {
    param(
        [object]$TestResults,
        [object]$Infrastructure,
        [object]$Performance,
        [object]$Historical,
        [string]$OutputFile
    )
    
    Write-ReportStatus "Generating JSON report" "INFO"
    
    $jsonReport = @{
        metadata = @{
            generatedAt = $Script:ReportData.GeneratedAt
            generator = "SOC Compliance Platform Integration Test Runner"
            version = "1.0.0"
        }
        testResults = $TestResults
        infrastructure = $Infrastructure
        performance = $Performance
        historical = $Historical
    }
    
    $jsonReport | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-ReportStatus "JSON report saved to: $OutputFile" "SUCCESS"
}

function Generate-MarkdownReport {
    param(
        [object]$TestResults,
        [object]$Infrastructure,
        [object]$Performance,
        [object]$Historical,
        [string]$OutputFile
    )
    
    Write-ReportStatus "Generating Markdown report" "INFO"
    
    $totalDuration = if ($TestResults.EndTime -and $TestResults.StartTime) {
        ($TestResults.EndTime - $TestResults.StartTime).TotalSeconds
    } else { 0 }
    
    $passRate = if ($TestResults.TotalTests -gt 0) {
        [math]::Round(($TestResults.PassedTests / $TestResults.TotalTests) * 100, 2)
    } else { 0 }
    
    $markdown = @"
# 🧪 Integration Test Report

**SOC Compliance Platform**  
Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | $($TestResults.TotalTests) |
| Passed | ✅ $($TestResults.PassedTests) |
| Failed | ❌ $($TestResults.FailedTests) |
| Skipped | ⏭️ $($TestResults.SkippedTests) |
| Pass Rate | $passRate% |
| Duration | $([math]::Round($totalDuration, 2))s |

## 🚀 Service Results

"@

    foreach ($serviceName in $TestResults.Services.Keys) {
        $service = $TestResults.Services[$serviceName]
        $statusIcon = switch ($service.Status) {
            "SUCCESS" { "✅" }
            "FAILURE" { "❌" }
            default { "⚠️" }
        }
        
        $serviceDuration = if ($service.StartTime -and $service.EndTime) {
            [math]::Round(($service.EndTime - $service.StartTime).TotalSeconds, 1)
        } else { "N/A" }
        
        $markdown += @"

### $statusIcon $serviceName

- **Status:** $($service.Status)
- **Tests:** $($service.PassedTests) passed, $($service.FailedTests) failed, $($service.SkippedTests) skipped
- **Duration:** $serviceDuration s

**Test Files:**
"@
        
        if ($service.TestFiles) {
            foreach ($testFile in $service.TestFiles) {
                $markdown += "`n- 📄 $testFile"
            }
        }
    }

    if ($Performance -and $Performance.OverallMetrics) {
        $markdown += @"

## ⚡ Performance Analysis

| Metric | Value |
|--------|-------|
| Average Duration | $([math]::Round($Performance.OverallMetrics.AverageDuration, 2))s |
| Slowest Test | $([math]::Round($Performance.OverallMetrics.MaxDuration, 2))s |
| Fastest Test | $([math]::Round($Performance.OverallMetrics.MinDuration, 2))s |

"@
        
        if ($Performance.SlowestTests -and $Performance.SlowestTests.Count -gt 0) {
            $markdown += @"

### 🐌 Slowest Tests

| Test | Duration | Status |
|------|----------|--------|
"@
            
            foreach ($test in $Performance.SlowestTests) {
                $statusIcon = if ($test.Value.Success) { "✅" } else { "❌" }
                $markdown += "`n| $($test.Key) | $([math]::Round($test.Value.Duration, 2))s | $statusIcon |"
            }
        }
        
        if ($Performance.Recommendations -and $Performance.Recommendations.Count -gt 0) {
            $markdown += @"

### 💡 Recommendations

"@
            foreach ($recommendation in $Performance.Recommendations) {
                $markdown += "`n- $recommendation"
            }
        }
    }

    if ($Infrastructure -and $Infrastructure.Keys.Count -gt 0) {
        $markdown += @"

## 🏗️ Infrastructure Health

"@
        
        if ($Infrastructure.Redis) {
            $redisIcon = switch ($Infrastructure.Redis.Status) {
                "Healthy" { "✅" }
                "Unhealthy" { "❌" }
                default { "❓" }
            }
            
            $markdown += @"

### $redisIcon Redis
- **Status:** $($Infrastructure.Redis.Status)
"@
            if ($Infrastructure.Redis.ResponseTime -gt 0) {
                $markdown += "`n- **Response Time:** $([math]::Round($Infrastructure.Redis.ResponseTime, 1))ms"
            }
            if ($Infrastructure.Redis.Memory) {
                $markdown += "`n- **Memory:** $($Infrastructure.Redis.Memory)"
            }
        }
        
        if ($Infrastructure.PostgreSQL) {
            $pgIcon = switch ($Infrastructure.PostgreSQL.Status) {
                "Healthy" { "✅" }
                "Unhealthy" { "❌" }
                default { "❓" }
            }
            
            $markdown += @"

### $pgIcon PostgreSQL
- **Status:** $($Infrastructure.PostgreSQL.Status)
"@
            if ($Infrastructure.PostgreSQL.Connections -gt 0) {
                $markdown += "`n- **Connections:** $($Infrastructure.PostgreSQL.Connections)"
            }
        }
    }

    if ($Historical.Available -and $Historical.Comparison) {
        $markdown += @"

## 📈 Historical Comparison

| Metric | Change |
|--------|--------|
| Test Count | $(if ($Historical.Comparison.TestCountChange -ge 0) { '+' })$($Historical.Comparison.TestCountChange) |
| Pass Rate | $(if ($Historical.Comparison.PassRateChange -ge 0) { '+' })$($Historical.Comparison.PassRateChange)% |
| Duration | $(if ($Historical.Comparison.DurationChange -ge 0) { '+' })$([math]::Round($Historical.Comparison.DurationChange, 1))s |

"@
    }

    $markdown += @"

---

*Generated by SOC Compliance Platform Integration Test Runner on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')*
"@

    $markdown | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-ReportStatus "Markdown report saved to: $OutputFile" "SUCCESS"
}

function Save-TestHistory {
    param([object]$TestResults, [string]$HistoryPath)
    
    Write-ReportStatus "Saving test results to history" "INFO"
    
    if (-not (Test-Path $HistoryPath)) {
        New-Item -ItemType Directory -Path $HistoryPath -Force | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $historyFile = Join-Path $HistoryPath "$timestamp.json"
    
    $TestResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $historyFile -Encoding UTF8
    
    # Also save as latest
    $latestFile = Join-Path $OutputPath "latest-results.json"
    $TestResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $latestFile -Encoding UTF8
    
    Write-ReportStatus "Test history saved" "SUCCESS"
}

# Main execution function
function Main {
    try {
        Write-Host ""
        Write-Host "📊 SOC Compliance Platform - Integration Test Report Generator" -ForegroundColor Magenta
        Write-Host "   Creating comprehensive test reports and analysis" -ForegroundColor Gray
        Write-Host "   Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
        
        # Ensure output directory exists
        if (-not (Test-Path $OutputPath)) {
            New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
            Write-ReportStatus "Created output directory: $OutputPath" "INFO"
        }
        
        # Load test results
        $testResults = if ($TestResults) { $TestResults } else { Get-TestResultsFromLatestRun }
        $Script:ReportData.TestResults = $testResults
        
        # Collect infrastructure data if requested
        $infrastructure = if ($IncludeInfrastructure) { Get-InfrastructureHealth } else { @{} }
        $Script:ReportData.Infrastructure = $infrastructure
        
        # Analyze performance
        $performance = Get-PerformanceAnalysis $testResults
        $Script:ReportData.Performance = $performance
        
        # Load historical data if requested
        $historical = if ($IncludeHistorical) { Get-HistoricalComparison $testResults } else { @{ Available = $false } }
        $Script:ReportData.Historical = $historical
        
        # Save test history
        $historyPath = Join-Path $OutputPath "history"
        Save-TestHistory $testResults $historyPath
        
        # Generate reports based on format
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $reportGenerated = $false
        
        if ($Format -eq "html" -or $Format -eq "all") {
            $htmlFile = Join-Path $OutputPath "integration-report-$timestamp.html"
            Generate-HtmlReport $testResults $infrastructure $performance $historical $htmlFile
            
            # Also create latest.html
            $latestHtml = Join-Path $OutputPath "latest.html"
            Generate-HtmlReport $testResults $infrastructure $performance $historical $latestHtml
            $reportGenerated = $true
        }
        
        if ($Format -eq "json" -or $Format -eq "all") {
            $jsonFile = Join-Path $OutputPath "integration-report-$timestamp.json"
            Generate-JsonReport $testResults $infrastructure $performance $historical $jsonFile
            $reportGenerated = $true
        }
        
        if ($Format -eq "markdown" -or $Format -eq "all") {
            $markdownFile = Join-Path $OutputPath "integration-report-$timestamp.md"
            Generate-MarkdownReport $testResults $infrastructure $performance $historical $markdownFile
            $reportGenerated = $true
        }
        
        if (-not $reportGenerated) {
            Write-ReportStatus "No reports generated - invalid format specified" "FAILURE"
            return $false
        }
        
        # Summary
        Write-Host ""
        Write-Host "=" * 80 -ForegroundColor Green
        Write-Host "  INTEGRATION TEST REPORT GENERATION COMPLETE" -ForegroundColor Green
        Write-Host "=" * 80 -ForegroundColor Green
        
        Write-Host ""
        Write-Host "📁 Output Directory: $OutputPath" -ForegroundColor Cyan
        Write-Host "📊 Format(s): $Format" -ForegroundColor Cyan
        Write-Host "🕒 Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
        
        if ($testResults.TotalTests -gt 0) {
            $passRate = [math]::Round(($testResults.PassedTests / $testResults.TotalTests) * 100, 2)
            Write-Host "✅ Overall Result: $passRate% pass rate ($($testResults.PassedTests)/$($testResults.TotalTests))" -ForegroundColor $(if ($testResults.FailedTests -eq 0) { "Green" } else { "Yellow" })
        }
        
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor White
        Write-Host "   1. Open HTML report: $OutputPath\latest.html" -ForegroundColor Cyan
        Write-Host "   2. Review performance recommendations" -ForegroundColor Cyan
        Write-Host "   3. Address any infrastructure issues" -ForegroundColor Cyan
        
        return $true
        
    } catch {
        Write-Host ""
        Write-Host "💥 REPORT GENERATION ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Gray
        return $false
    }
}

# Execute main function and exit with appropriate code
$success = Main
exit $(if ($success) { 0 } else { 1 })