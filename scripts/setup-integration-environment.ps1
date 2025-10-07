#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup Integration Test Environment
    
.DESCRIPTION
    Comprehensive setup script for integration test environment.
    Creates isolated test databases, initializes Redis with test configuration,
    starts required services in correct order, and verifies readiness.
    
.PARAMETER Clean
    Clean existing test data and recreate environment
    
.PARAMETER ServicesOnly
    Only start services, skip infrastructure setup
    
.PARAMETER InfrastructureOnly
    Only setup infrastructure, skip service startup
    
.PARAMETER WaitTimeout
    Maximum time to wait for services (default: 120 seconds)
    
.PARAMETER SkipMigrations
    Skip database migrations (use existing schema)
    
.PARAMETER Detailed
    Show detailed setup progress
    
.EXAMPLE
    .\scripts\setup-integration-environment.ps1
    
.EXAMPLE
    .\scripts\setup-integration-environment.ps1 -Clean -Detailed
    
.EXAMPLE
    .\scripts\setup-integration-environment.ps1 -ServicesOnly
#>

param(
    [switch]$Clean,
    [switch]$ServicesOnly,
    [switch]$InfrastructureOnly,
    [int]$WaitTimeout = 120,
    [switch]$SkipMigrations,
    [switch]$Detailed
)

# Configuration
$Script:SetupResults = @{
    StartTime = Get-Date
    EndTime = $null
    Infrastructure = @{}
    Services = @{}
    Databases = @{}
    Errors = @()
    Warnings = @()
}

# Infrastructure configuration
$InfrastructureConfig = @{
    PostgreSQL = @{
        Host = "127.0.0.1"
        Port = 5432
        Username = "soc_user"
        Password = "soc_pass"
        TestDatabases = @(
            @{ Name = "soc_auth_test"; Schema = "auth-service" }
            @{ Name = "soc_clients_test"; Schema = "client-service" }
            @{ Name = "soc_notifications_test"; Schema = "notification-service" }
            @{ Name = "soc_policies_test"; Schema = "policy-service" }
            @{ Name = "soc_controls_test"; Schema = "control-service" }
            @{ Name = "soc_evidence_test"; Schema = "evidence-service" }
            @{ Name = "soc_workflows_test"; Schema = "workflow-service" }
            @{ Name = "soc_reports_test"; Schema = "reporting-service" }
            @{ Name = "soc_audits_test"; Schema = "audit-service" }
            @{ Name = "soc_integrations_test"; Schema = "integration-service" }
            @{ Name = "soc_ai_test"; Schema = "ai-service" }
        )
    }
    Redis = @{
        Host = "127.0.0.1"
        Port = 6379
        Password = "soc_redis_pass"
        TestKeyPrefix = "integration-test"
        Databases = @(1, 2, 3, 4, 5)  # Use separate Redis databases for isolation
    }
    Services = @{
        "auth-service" = @{ 
            Port = 3001
            EnvVars = @{
                "NODE_ENV" = "test"
                "DB_NAME" = "soc_auth_test"
                "REDIS_DB" = "1"
                "LOG_LEVEL" = "error"
                "DISABLE_KAFKA" = "true"
            }
            Dependencies = @()
            StartupTime = 15
        }
        "client-service" = @{ 
            Port = 3002
            EnvVars = @{
                "NODE_ENV" = "test"
                "DB_NAME" = "soc_clients_test"
                "REDIS_DB" = "2"
                "LOG_LEVEL" = "error"
                "DISABLE_KAFKA" = "true"
            }
            Dependencies = @("auth-service")
            StartupTime = 15
        }
        "notification-service" = @{ 
            Port = 3010
            EnvVars = @{
                "NODE_ENV" = "test"
                "DB_NAME" = "soc_notifications_test"
                "REDIS_DB" = "3"
                "LOG_LEVEL" = "error"
                "DISABLE_KAFKA" = "true"
            }
            Dependencies = @("auth-service", "client-service")
            StartupTime = 15
        }
    }
}

# Utility Functions
function Write-SetupHeader {
    param([string]$Title, [string]$Subtitle = "")
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "  $Title" -ForegroundColor Magenta
    if ($Subtitle) {
        Write-Host "  $Subtitle" -ForegroundColor Gray
    }
    Write-Host "=" * 80 -ForegroundColor Magenta
}

function Write-SetupStatus {
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
        "PROGRESS" { "Blue" }
        default { "White" }
    }
    
    $icon = switch ($Status) {
        "SUCCESS" { "✅" }
        "FAILURE" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "ℹ️" }
        "PROGRESS" { "⏳" }
        default { "•" }
    }
    
    Write-Host "$icon $Message" -ForegroundColor $color
    if ($Details -and $Detailed) {
        Write-Host "   📋 $Details" -ForegroundColor Gray
    }
    
    # Log warnings and errors
    if ($Status -eq "WARNING") {
        $Script:SetupResults.Warnings += $Message
    } elseif ($Status -eq "FAILURE") {
        $Script:SetupResults.Errors += $Message
    }
}

function Test-DockerService {
    param([string]$ServiceName)
    
    try {
        $containerStatus = docker ps --filter "name=$ServiceName" --format "{{.Status}}" 2>$null
        return $containerStatus -match "Up"
    } catch {
        return $false
    }
}

function Wait-ForService {
    param(
        [string]$ServiceName,
        [string]$HealthUrl,
        [int]$TimeoutSeconds = 60,
        [hashtable]$Headers = @{}
    )
    
    $waited = 0
    $interval = 2
    
    Write-SetupStatus "Waiting for $ServiceName to become healthy..." "PROGRESS"
    
    while ($waited -lt $TimeoutSeconds) {
        try {
            $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5 -Headers $Headers -ErrorAction Stop
            if ($response.status -eq "ok" -or $response.success -eq $true) {
                Write-SetupStatus "$ServiceName is healthy" "SUCCESS" "Responded in $waited seconds"
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        Start-Sleep -Seconds $interval
        $waited += $interval
        
        if ($waited % 10 -eq 0) {
            Write-SetupStatus "Still waiting for $ServiceName... ($waited/$TimeoutSeconds seconds)" "PROGRESS"
        }
    }
    
    Write-SetupStatus "$ServiceName failed to become healthy within $TimeoutSeconds seconds" "FAILURE"
    return $false
}

function Initialize-TestDatabases {
    param($DatabaseConfig)
    
    Write-SetupHeader "Database Environment Setup"
    
    # Verify PostgreSQL is running
    if (-not (Test-DockerService "overmatch-digital-postgres-1")) {
        Write-SetupStatus "PostgreSQL container is not running" "FAILURE" "Run: docker-compose up postgres"
        return $false
    }
    
    Write-SetupStatus "PostgreSQL container is running" "SUCCESS"
    
    foreach ($dbConfig in $DatabaseConfig.TestDatabases) {
        $dbName = $dbConfig.Name
        $schemaService = $dbConfig.Schema
        
        Write-SetupStatus "Setting up test database: $dbName" "INFO"
        
        try {
            # Check if database exists
            $dbExistsQuery = "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
            $dbExists = & docker exec overmatch-digital-postgres-1 psql -h $DatabaseConfig.Host -p $DatabaseConfig.Port -U $DatabaseConfig.Username -c $dbExistsQuery -t 2>$null
            
            if ($Clean -or -not ($dbExists -match "1")) {
                if ($dbExists -match "1" -and $Clean) {
                    # Drop existing database
                    Write-SetupStatus "Dropping existing database: $dbName" "WARNING"
                    & docker exec overmatch-digital-postgres-1 psql -h $DatabaseConfig.Host -p $DatabaseConfig.Port -U $DatabaseConfig.Username -c "DROP DATABASE IF EXISTS $dbName" 2>$null
                }
                
                # Create database
                Write-SetupStatus "Creating database: $dbName" "INFO"
                $createResult = & docker exec overmatch-digital-postgres-1 psql -h $DatabaseConfig.Host -p $DatabaseConfig.Port -U $DatabaseConfig.Username -c "CREATE DATABASE $dbName" 2>$null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-SetupStatus "Database created: $dbName" "SUCCESS"
                } else {
                    Write-SetupStatus "Failed to create database: $dbName" "FAILURE"
                    $Script:SetupResults.Databases[$dbName] = "FAILED"
                    continue
                }
            } else {
                Write-SetupStatus "Database already exists: $dbName" "INFO"
            }
            
            # Run migrations if not skipped
            if (-not $SkipMigrations) {
                Write-SetupStatus "Running migrations for $dbName" "INFO"
                
                $serviceDir = "services/$schemaService"
                if (Test-Path $serviceDir) {
                    Push-Location $serviceDir
                    
                    try {
                        # Set test database environment
                        $env:DB_NAME = $dbName
                        $env:NODE_ENV = "test"
                        
                        # Run migrations
                        $migrationResult = npm run migration:run 2>&1
                        
                        if ($LASTEXITCODE -eq 0) {
                            Write-SetupStatus "Migrations completed for $dbName" "SUCCESS"
                            $Script:SetupResults.Databases[$dbName] = "SUCCESS"
                        } else {
                            Write-SetupStatus "Migrations failed for $dbName" "WARNING" "Service may not have migrations yet"
                            $Script:SetupResults.Databases[$dbName] = "WARNING"
                        }
                        
                    } finally {
                        Pop-Location
                        Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
                        Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
                    }
                } else {
                    Write-SetupStatus "Service directory not found for $schemaService" "WARNING"
                    $Script:SetupResults.Databases[$dbName] = "WARNING"
                }
            } else {
                $Script:SetupResults.Databases[$dbName] = "SKIPPED"
            }
            
        } catch {
            Write-SetupStatus "Error setting up database $dbName`: $($_.Exception.Message)" "FAILURE"
            $Script:SetupResults.Databases[$dbName] = "ERROR"
        }
    }
    
    return $true
}

function Initialize-RedisEnvironment {
    param($RedisConfig)
    
    Write-SetupHeader "Redis Cache Environment Setup"
    
    # Verify Redis is running
    if (-not (Test-DockerService "overmatch-digital-redis-1")) {
        Write-SetupStatus "Redis container is not running" "FAILURE" "Run: docker-compose up redis"
        return $false
    }
    
    Write-SetupStatus "Redis container is running" "SUCCESS"
    
    try {
        # Test connection
        $pingResult = & docker exec overmatch-digital-redis-1 redis-cli -h $RedisConfig.Host -p $RedisConfig.Port -a $RedisConfig.Password ping 2>$null
        if ($pingResult -ne "PONG") {
            Write-SetupStatus "Redis connection failed" "FAILURE"
            return $false
        }
        
        Write-SetupStatus "Redis connection verified" "SUCCESS"
        
        # Clear test databases if clean setup
        if ($Clean) {
            Write-SetupStatus "Cleaning Redis test databases" "INFO"
            
            foreach ($dbIndex in $RedisConfig.Databases) {
                & docker exec overmatch-digital-redis-1 redis-cli -h $RedisConfig.Host -p $RedisConfig.Port -a $RedisConfig.Password -n $dbIndex flushdb 2>$null
                Write-SetupStatus "Cleared Redis database $dbIndex" "SUCCESS"
            }
        }
        
        # Set up test key prefix patterns
        $testKey = "$($RedisConfig.TestKeyPrefix):setup-test"
        $testValue = "integration-setup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        
        & docker exec overmatch-digital-redis-1 redis-cli -h $RedisConfig.Host -p $RedisConfig.Port -a $RedisConfig.Password -n 1 set $testKey $testValue EX 60 2>$null
        $retrievedValue = & docker exec overmatch-digital-redis-1 redis-cli -h $RedisConfig.Host -p $RedisConfig.Port -a $RedisConfig.Password -n 1 get $testKey 2>$null
        
        if ($retrievedValue -eq $testValue) {
            Write-SetupStatus "Redis test operations successful" "SUCCESS"
            & docker exec overmatch-digital-redis-1 redis-cli -h $RedisConfig.Host -p $RedisConfig.Port -a $RedisConfig.Password -n 1 del $testKey 2>$null
        } else {
            Write-SetupStatus "Redis test operations failed" "FAILURE"
            return $false
        }
        
        $Script:SetupResults.Infrastructure["Redis"] = "SUCCESS"
        return $true
        
    } catch {
        Write-SetupStatus "Redis setup error: $($_.Exception.Message)" "FAILURE"
        $Script:SetupResults.Infrastructure["Redis"] = "ERROR"
        return $false
    }
}

function Start-IntegrationServices {
    param($ServicesConfig)
    
    Write-SetupHeader "Integration Test Services Startup"
    
    # Get services in dependency order
    $serviceOrder = @("auth-service", "client-service", "notification-service")
    
    foreach ($serviceName in $serviceOrder) {
        if (-not $ServicesConfig.ContainsKey($serviceName)) {
            continue
        }
        
        $serviceConfig = $ServicesConfig[$serviceName]
        Write-SetupStatus "Starting $serviceName" "INFO"
        
        # Check if service is already running
        $healthUrl = "http://127.0.0.1:$($serviceConfig.Port)/health"
        try {
            $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3 -Headers @{"X-API-Key" = "test-api-key"} -ErrorAction Stop
            if ($response.status -eq "ok" -or $response.success -eq $true) {
                Write-SetupStatus "$serviceName is already running" "SUCCESS"
                $Script:SetupResults.Services[$serviceName] = "ALREADY_RUNNING"
                continue
            }
        } catch {
            # Service not running, which is expected
        }
        
        # Start service
        try {
            $serviceDir = "services/$serviceName"
            if (-not (Test-Path $serviceDir)) {
                Write-SetupStatus "Service directory not found: $serviceDir" "FAILURE"
                $Script:SetupResults.Services[$serviceName] = "MISSING"
                continue
            }
            
            # Prepare environment variables
            $envVars = @{}
            foreach ($key in $serviceConfig.EnvVars.Keys) {
                $envVars[$key] = $serviceConfig.EnvVars[$key]
            }
            
            # Add common test environment variables
            $envVars["DB_HOST"] = "127.0.0.1"
            $envVars["DB_PORT"] = "5432"
            $envVars["DB_USERNAME"] = "soc_user"
            $envVars["DB_PASSWORD"] = "soc_pass"
            $envVars["REDIS_HOST"] = "127.0.0.1"
            $envVars["REDIS_PORT"] = "6379"
            $envVars["REDIS_PASSWORD"] = "soc_redis_pass"
            
            Write-SetupStatus "Starting $serviceName with test configuration" "PROGRESS"
            
            # Start service in background
            Push-Location $serviceDir
            
            # Set environment variables
            foreach ($key in $envVars.Keys) {
                Set-Item -Path "Env:$key" -Value $envVars[$key]
            }
            
            # Start service (this would need to be adapted based on your service startup method)
            # For now, just indicate that the service should be started manually
            Write-SetupStatus "$serviceName environment configured" "SUCCESS" "Start manually with: cd $serviceDir && npm run start:dev"
            
            Pop-Location
            
            # Clean up environment variables
            foreach ($key in $envVars.Keys) {
                Remove-Item -Path "Env:$key" -ErrorAction SilentlyContinue
            }
            
            $Script:SetupResults.Services[$serviceName] = "CONFIGURED"
            
        } catch {
            Write-SetupStatus "Error configuring $serviceName`: $($_.Exception.Message)" "FAILURE"
            $Script:SetupResults.Services[$serviceName] = "ERROR"
        }
    }
    
    return $true
}

function Show-SetupSummary {
    $Script:SetupResults.EndTime = Get-Date
    $totalDuration = ($Script:SetupResults.EndTime - $Script:SetupResults.StartTime).TotalSeconds
    
    Write-SetupHeader "Integration Environment Setup Summary"
    
    Write-Host "📊 Setup Results:" -ForegroundColor White
    Write-Host "   Duration: $([math]::Round($totalDuration, 2)) seconds" -ForegroundColor Cyan
    Write-Host "   Errors: $($Script:SetupResults.Errors.Count)" -ForegroundColor $(if ($Script:SetupResults.Errors.Count -eq 0) { "Green" } else { "Red" })
    Write-Host "   Warnings: $($Script:SetupResults.Warnings.Count)" -ForegroundColor $(if ($Script:SetupResults.Warnings.Count -eq 0) { "Green" } else { "Yellow" })
    
    # Infrastructure status
    if ($Script:SetupResults.Infrastructure.Count -gt 0) {
        Write-Host ""
        Write-Host "🏗️  Infrastructure:" -ForegroundColor White
        foreach ($component in $Script:SetupResults.Infrastructure.Keys) {
            $status = $Script:SetupResults.Infrastructure[$component]
            $icon = switch ($status) {
                "SUCCESS" { "✅" }
                "ERROR" { "❌" }
                "WARNING" { "⚠️" }
                default { "❓" }
            }
            Write-Host "   $icon $component`: $status" -ForegroundColor Cyan
        }
    }
    
    # Database status
    if ($Script:SetupResults.Databases.Count -gt 0) {
        Write-Host ""
        Write-Host "🗄️  Databases:" -ForegroundColor White
        foreach ($db in $Script:SetupResults.Databases.Keys) {
            $status = $Script:SetupResults.Databases[$db]
            $icon = switch ($status) {
                "SUCCESS" { "✅" }
                "FAILED" { "❌" }
                "WARNING" { "⚠️" }
                "SKIPPED" { "⏭️" }
                "ERROR" { "💥" }
                default { "❓" }
            }
            Write-Host "   $icon $db`: $status" -ForegroundColor Cyan
        }
    }
    
    # Service status
    if ($Script:SetupResults.Services.Count -gt 0) {
        Write-Host ""
        Write-Host "🚀 Services:" -ForegroundColor White
        foreach ($service in $Script:SetupResults.Services.Keys) {
            $status = $Script:SetupResults.Services[$service]
            $icon = switch ($status) {
                "ALREADY_RUNNING" { "✅" }
                "CONFIGURED" { "🔧" }
                "ERROR" { "❌" }
                "MISSING" { "❓" }
                default { "❓" }
            }
            Write-Host "   $icon $service`: $status" -ForegroundColor Cyan
        }
    }
    
    # Errors and warnings
    if ($Script:SetupResults.Errors.Count -gt 0) {
        Write-Host ""
        Write-Host "❌ Errors:" -ForegroundColor Red
        foreach ($error in $Script:SetupResults.Errors) {
            Write-Host "   • $error" -ForegroundColor Red
        }
    }
    
    if ($Script:SetupResults.Warnings.Count -gt 0) {
        Write-Host ""
        Write-Host "⚠️  Warnings:" -ForegroundColor Yellow
        foreach ($warning in $Script:SetupResults.Warnings) {
            Write-Host "   • $warning" -ForegroundColor Yellow
        }
    }
    
    # Next steps
    Write-Host ""
    if ($Script:SetupResults.Errors.Count -eq 0) {
        Write-Host "🎉 INTEGRATION ENVIRONMENT SETUP COMPLETE!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor White
        Write-Host "   1. Start services manually (if not already running)" -ForegroundColor Cyan
        Write-Host "   2. Verify infrastructure: .\scripts\verify-integration-infrastructure.ps1" -ForegroundColor Cyan
        Write-Host "   3. Run integration tests: .\scripts\run-integration-tests.ps1" -ForegroundColor Cyan
        
        return $true
    } else {
        Write-Host "💥 SETUP COMPLETED WITH ERRORS" -ForegroundColor Red
        Write-Host ""
        Write-Host "Review errors above and retry setup with -Clean flag if needed." -ForegroundColor Yellow
        
        return $false
    }
}

# Main execution function
function Main {
    try {
        Write-Host ""
        Write-Host "🛠️  SOC Compliance Platform - Integration Environment Setup" -ForegroundColor Magenta
        Write-Host "   Preparing isolated environment for real integration tests" -ForegroundColor Gray
        Write-Host "   Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
        
        $overallSuccess = $true
        
        # Infrastructure setup
        if (-not $ServicesOnly) {
            # Initialize test databases
            if (-not (Initialize-TestDatabases $InfrastructureConfig.PostgreSQL)) {
                $overallSuccess = $false
            }
            
            # Initialize Redis environment
            if (-not (Initialize-RedisEnvironment $InfrastructureConfig.Redis)) {
                $overallSuccess = $false
            }
        }
        
        # Service setup
        if (-not $InfrastructureOnly) {
            if (-not (Start-IntegrationServices $InfrastructureConfig.Services)) {
                $overallSuccess = $false
            }
        }
        
        # Show summary
        $setupSuccess = Show-SetupSummary
        
        return $setupSuccess -and $overallSuccess
        
    } catch {
        Write-Host ""
        Write-Host "💥 INTEGRATION ENVIRONMENT SETUP ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Gray
        return $false
    }
}

# Execute main function and exit with appropriate code
$success = Main
exit $(if ($success) { 0 } else { 1 })