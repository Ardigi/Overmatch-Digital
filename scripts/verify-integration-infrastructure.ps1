#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify Integration Test Infrastructure
    
.DESCRIPTION
    Comprehensive verification script for integration test prerequisites.
    Checks Redis, PostgreSQL, services health, and database schemas.
    Implements fail-fast approach - exits immediately if any requirement is missing.
    
.PARAMETER Detailed
    Show detailed output for each check
    
.PARAMETER WaitForServices
    Wait for services to become healthy (up to 60 seconds)
    
.PARAMETER SkipServices
    Skip service health checks (only verify infrastructure)
    
.EXAMPLE
    .\scripts\verify-integration-infrastructure.ps1
    
.EXAMPLE
    .\scripts\verify-integration-infrastructure.ps1 -Detailed -WaitForServices
#>

param(
    [switch]$Detailed,
    [switch]$WaitForServices,
    [switch]$SkipServices
)

# Configuration
$Script:ChecksPassed = 0
$Script:ChecksFailed = 0
$Script:FailedChecks = @()

# Infrastructure Configuration
$InfrastructureConfig = @{
    Redis = @{
        Host = "127.0.0.1"
        Port = 6379
        Password = "soc_redis_pass"
        TestKey = "integration-test-health-check"
    }
    PostgreSQL = @{
        Host = "127.0.0.1"
        Port = 5432
        Username = "soc_user"
        Password = "soc_pass"
        TestDatabases = @(
            "soc_auth", "soc_clients", "soc_notifications", 
            "soc_policies", "soc_controls", "soc_evidence",
            "soc_workflows", "soc_reports", "soc_audits",
            "soc_integrations", "soc_ai"
        )
    }
    Services = @{
        "auth-service" = @{ Port = 3001; HealthPath = "/health"; Critical = $true }
        "client-service" = @{ Port = 3002; HealthPath = "/health"; Critical = $true }
        "notification-service" = @{ Port = 3010; HealthPath = "/health"; Critical = $true }
        "policy-service" = @{ Port = 3003; HealthPath = "/health"; Critical = $false }
        "control-service" = @{ Port = 3004; HealthPath = "/health"; Critical = $false }
        "evidence-service" = @{ Port = 3005; HealthPath = "/health"; Critical = $false }
        "workflow-service" = @{ Port = 3006; HealthPath = "/health"; Critical = $false }
        "reporting-service" = @{ Port = 3007; HealthPath = "/health"; Critical = $false }
        "audit-service" = @{ Port = 3008; HealthPath = "/health"; Critical = $false }
        "integration-service" = @{ Port = 3009; HealthPath = "/health"; Critical = $false }
        "ai-service" = @{ Port = 3011; HealthPath = "/health"; Critical = $false }
    }
    Kafka = @{
        Host = "127.0.0.1"
        Port = 9092
        TestTopic = "integration-test-health"
    }
    MongoDB = @{
        Host = "127.0.0.1"
        Port = 27017
        Username = "soc_user"
        TestDatabase = "soc_documents"
    }
    Elasticsearch = @{
        Host = "127.0.0.1"
        Port = 9200
        TestIndex = "integration-test-health"
    }
}

# Utility Functions
function Write-CheckHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Cyan
}

function Write-CheckResult {
    param(
        [string]$Check,
        [bool]$Success,
        [string]$Details = "",
        [bool]$Critical = $true
    )
    
    if ($Success) {
        Write-Host "✅ $Check" -ForegroundColor Green
        if ($Detailed -and $Details) {
            Write-Host "   📋 $Details" -ForegroundColor Gray
        }
        $Script:ChecksPassed++
    } else {
        $icon = if ($Critical) { "❌" } else { "⚠️" }
        $color = if ($Critical) { "Red" } else { "Yellow" }
        
        Write-Host "$icon $Check" -ForegroundColor $color
        if ($Details) {
            Write-Host "   💡 $Details" -ForegroundColor Gray
        }
        
        $Script:ChecksFailed++
        $Script:FailedChecks += @{
            Check = $Check
            Details = $Details
            Critical = $Critical
        }
        
        if ($Critical) {
            Write-Host ""
            Write-Host "🛑 CRITICAL FAILURE: Integration tests cannot proceed without this requirement." -ForegroundColor Red
            return $false
        }
    }
    return $true
}

function Test-TCPConnection {
    param(
        [string]$Host,
        [int]$Port,
        [int]$TimeoutMs = 5000
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connectTask = $tcpClient.ConnectAsync($Host, $Port)
        
        if ($connectTask.Wait($TimeoutMs)) {
            $tcpClient.Close()
            return $true
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

function Test-RedisConnection {
    param($Config)
    
    Write-CheckHeader "Redis Cache Infrastructure"
    
    # Test TCP connection
    $tcpResult = Test-TCPConnection -Host $Config.Host -Port $Config.Port
    if (-not (Write-CheckResult "Redis TCP Connection ($($Config.Host):$($Config.Port))" $tcpResult "Required for cache operations" $true)) {
        return $false
    }
    
    # Test Redis commands using redis-cli
    try {
        $pingResult = & docker exec overmatch-digital-redis-1 redis-cli -h $Config.Host -p $Config.Port -a $Config.Password ping 2>$null
        $pingSuccess = $pingResult -eq "PONG"
        
        if (-not (Write-CheckResult "Redis PING Command" $pingSuccess "Authentication and command execution" $true)) {
            return $false
        }
        
        # Test SET/GET operations
        $testValue = "integration-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        $setResult = & docker exec overmatch-digital-redis-1 redis-cli -h $Config.Host -p $Config.Port -a $Config.Password set $Config.TestKey $testValue 2>$null
        $setSuccess = $setResult -eq "OK"
        
        if ($setSuccess) {
            $getValue = & docker exec overmatch-digital-redis-1 redis-cli -h $Config.Host -p $Config.Port -a $Config.Password get $Config.TestKey 2>$null
            $getSuccess = $getValue -eq $testValue
            
            Write-CheckResult "Redis SET/GET Operations" $getSuccess "Cache write/read functionality" $true
            
            # Cleanup test key
            & docker exec overmatch-digital-redis-1 redis-cli -h $Config.Host -p $Config.Port -a $Config.Password del $Config.TestKey 2>$null | Out-Null
        } else {
            Write-CheckResult "Redis SET Operation" $false "Cache write functionality failed" $true
            return $false
        }
        
    } catch {
        Write-CheckResult "Redis Commands" $false "Error executing Redis commands: $($_.Exception.Message)" $true
        return $false
    }
    
    return $true
}

function Test-PostgreSQLConnection {
    param($Config)
    
    Write-CheckHeader "PostgreSQL Database Infrastructure"
    
    # Test TCP connection
    $tcpResult = Test-TCPConnection -Host $Config.Host -Port $Config.Port
    if (-not (Write-CheckResult "PostgreSQL TCP Connection ($($Config.Host):$($Config.Port))" $tcpResult "Required for database operations" $true)) {
        return $false
    }
    
    # Test database connectivity and schemas
    foreach ($database in $Config.TestDatabases) {
        try {
            $connectionString = "Host=$($Config.Host);Port=$($Config.Port);Database=$database;Username=$($Config.Username);Password=$($Config.Password);Timeout=10"
            
            # Test connection using psql via Docker
            $testQuery = "SELECT 1 as test_connection"
            $queryResult = & docker exec overmatch-digital-postgres-1 psql -h $Config.Host -p $Config.Port -U $Config.Username -d $database -c $testQuery -t 2>$null
            
            $connectionSuccess = $queryResult -match "1"
            Write-CheckResult "Database Connection: $database" $connectionSuccess "Service-specific database access" $true
            
            if ($connectionSuccess) {
                # Test schema by checking for tables
                $schemaQuery = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
                $schemaResult = & docker exec overmatch-digital-postgres-1 psql -h $Config.Host -p $Config.Port -U $Config.Username -d $database -c $schemaQuery -t 2>$null
                
                if ($schemaResult -match '\d+') {
                    $tableCount = [int]($schemaResult.Trim())
                    Write-CheckResult "Database Schema: $database" ($tableCount -gt 0) "Found $tableCount tables in schema" $false
                } else {
                    Write-CheckResult "Database Schema: $database" $false "Could not verify schema" $false
                }
            }
            
        } catch {
            Write-CheckResult "Database Connection: $database" $false "Connection error: $($_.Exception.Message)" $true
            return $false
        }
    }
    
    return $true
}

function Test-ServiceHealth {
    param($Services)
    
    if ($SkipServices) {
        Write-Host ""
        Write-Host "⏭️  Skipping service health checks (SkipServices flag)" -ForegroundColor Yellow
        return $true
    }
    
    Write-CheckHeader "Microservices Health Checks"
    
    $maxWaitTime = if ($WaitForServices) { 60 } else { 0 }
    $allCriticalHealthy = $true
    
    foreach ($serviceName in $Services.Keys) {
        $service = $Services[$serviceName]
        $url = "http://127.0.0.1:$($service.Port)$($service.HealthPath)"
        $waited = 0
        $healthy = $false
        
        do {
            try {
                $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 5 -Headers @{"X-API-Key" = "test-api-key"} -ErrorAction Stop
                $healthy = ($response.status -eq "ok" -or $response.success -eq $true)
                
                if ($healthy) {
                    $details = if ($response.version) { "Version: $($response.version)" } else { "Service responsive" }
                    Write-CheckResult "Service Health: $serviceName" $true $details $service.Critical
                    break
                } else {
                    throw "Unhealthy response: $($response | ConvertTo-Json -Compress)"
                }
                
            } catch {
                if ($WaitForServices -and $waited -lt $maxWaitTime) {
                    if ($waited -eq 0) {
                        Write-Host "⏳ Waiting for $serviceName to become healthy..." -ForegroundColor Yellow
                    }
                    Start-Sleep -Seconds 2
                    $waited += 2
                } else {
                    $details = "Service not responding at $url. Start with: cd services/$serviceName && npm run start:dev"
                    Write-CheckResult "Service Health: $serviceName" $false $details $service.Critical
                    
                    if ($service.Critical) {
                        $allCriticalHealthy = $false
                    }
                    break
                }
            }
        } while ($waited -lt $maxWaitTime)
    }
    
    return $allCriticalHealthy
}

function Test-OptionalInfrastructure {
    Write-CheckHeader "Optional Infrastructure Components"
    
    # Kafka
    $kafkaConfig = $InfrastructureConfig.Kafka
    $kafkaTcpResult = Test-TCPConnection -Host $kafkaConfig.Host -Port $kafkaConfig.Port
    Write-CheckResult "Kafka TCP Connection ($($kafkaConfig.Host):$($kafkaConfig.Port))" $kafkaTcpResult "Event streaming (optional for most integration tests)" $false
    
    # MongoDB
    $mongoConfig = $InfrastructureConfig.MongoDB
    $mongoTcpResult = Test-TCPConnection -Host $mongoConfig.Host -Port $mongoConfig.Port
    Write-CheckResult "MongoDB TCP Connection ($($mongoConfig.Host):$($mongoConfig.Port))" $mongoTcpResult "Document storage (required for evidence/ai services)" $false
    
    # Elasticsearch
    $elasticConfig = $InfrastructureConfig.Elasticsearch
    $elasticTcpResult = Test-TCPConnection -Host $elasticConfig.Host -Port $elasticConfig.Port
    Write-CheckResult "Elasticsearch TCP Connection ($($elasticConfig.Host):$($elasticConfig.Port))" $elasticTcpResult "Search engine (required for ai service)" $false
    
    return $true
}

function Show-Summary {
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "  INTEGRATION TEST INFRASTRUCTURE SUMMARY" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
    
    Write-Host ""
    Write-Host "📊 Check Results:" -ForegroundColor White
    Write-Host "   ✅ Passed: $Script:ChecksPassed" -ForegroundColor Green
    Write-Host "   ❌ Failed: $Script:ChecksFailed" -ForegroundColor Red
    
    if ($Script:FailedChecks.Count -gt 0) {
        Write-Host ""
        Write-Host "🔧 Failed Checks:" -ForegroundColor Red
        
        $criticalFailures = $Script:FailedChecks | Where-Object { $_.Critical }
        $nonCriticalFailures = $Script:FailedChecks | Where-Object { -not $_.Critical }
        
        if ($criticalFailures.Count -gt 0) {
            Write-Host ""
            Write-Host "   🛑 CRITICAL (must fix):" -ForegroundColor Red
            foreach ($failure in $criticalFailures) {
                Write-Host "      • $($failure.Check)" -ForegroundColor Red
                if ($failure.Details) {
                    Write-Host "        💡 $($failure.Details)" -ForegroundColor Gray
                }
            }
        }
        
        if ($nonCriticalFailures.Count -gt 0) {
            Write-Host ""
            Write-Host "   ⚠️  NON-CRITICAL (optional):" -ForegroundColor Yellow
            foreach ($failure in $nonCriticalFailures) {
                Write-Host "      • $($failure.Check)" -ForegroundColor Yellow
                if ($failure.Details) {
                    Write-Host "        💡 $($failure.Details)" -ForegroundColor Gray
                }
            }
        }
    }
    
    Write-Host ""
    $criticalFailures = ($Script:FailedChecks | Where-Object { $_.Critical }).Count
    
    if ($criticalFailures -eq 0) {
        Write-Host "🎉 INTEGRATION TEST INFRASTRUCTURE IS READY!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor White
        Write-Host "   1. Run integration tests: .\scripts\run-integration-tests.ps1" -ForegroundColor Cyan
        Write-Host "   2. Run specific service: .\scripts\run-integration-tests.ps1 -Service auth" -ForegroundColor Cyan
        Write-Host "   3. Generate reports: .\scripts\generate-integration-report.ps1" -ForegroundColor Cyan
        
        return $true
    } else {
        Write-Host "🛑 CRITICAL FAILURES DETECTED - Integration tests cannot proceed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Quick fixes:" -ForegroundColor White
        Write-Host "   1. Start infrastructure: .\start-docker-services.ps1" -ForegroundColor Cyan
        Write-Host "   2. Start critical services: npm run dev:services" -ForegroundColor Cyan
        Write-Host "   3. Check service logs: docker-compose logs -f [service-name]" -ForegroundColor Cyan
        
        return $false
    }
}

# Main Execution
function Main {
    Write-Host ""
    Write-Host "🔍 SOC Compliance Platform - Integration Test Infrastructure Verification" -ForegroundColor Magenta
    Write-Host "   Checking prerequisites for real integration tests..." -ForegroundColor Gray
    Write-Host "   Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    
    # Core Infrastructure Checks
    $redisHealthy = Test-RedisConnection -Config $InfrastructureConfig.Redis
    $postgresHealthy = Test-PostgreSQLConnection -Config $InfrastructureConfig.PostgreSQL
    $servicesHealthy = Test-ServiceHealth -Services $InfrastructureConfig.Services
    
    # Optional Infrastructure
    Test-OptionalInfrastructure | Out-Null
    
    # Show results
    $overallSuccess = Show-Summary
    
    # Exit with appropriate code
    if ($overallSuccess) {
        exit 0
    } else {
        exit 1
    }
}

# Error handling
trap {
    Write-Host ""
    Write-Host "💥 UNEXPECTED ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please ensure Docker is running and services are accessible." -ForegroundColor Yellow
    exit 1
}

# Execute main function
Main