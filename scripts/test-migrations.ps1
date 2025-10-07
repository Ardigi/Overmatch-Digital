# Database Migration Test Framework
# Tests migration up/down, data integrity, and rollback capabilities
# Usage: .\test-migrations.ps1 -Service [name|all] [-TestRollback] [-Verbose]

param(
    [string]$Service = "all",
    [switch]$TestRollback,
    [switch]$TestData,
    [switch]$DryRun,
    [switch]$Verbose,
    [switch]$GenerateReport
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Step { Write-Host "`n→ $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $($args[0])" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $($args[0])" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $($args[0])" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $($args[0])" -ForegroundColor Blue }

# Banner
Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║           Database Migration Test Framework                 ║
║           Comprehensive Migration Testing Suite             ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if ($DryRun) {
    Write-Warning "DRY RUN MODE - No actual migrations will be executed"
}

# Service configuration
$services = @{
    "auth" = @{
        Name = "Auth Service"
        Path = "services/auth-service"
        Database = "soc_auth_test"
        MigrationPath = "src/migrations"
    }
    "client" = @{
        Name = "Client Service"
        Path = "services/client-service"
        Database = "soc_clients_test"
        MigrationPath = "src/migrations"
    }
    "policy" = @{
        Name = "Policy Service"
        Path = "services/policy-service"
        Database = "soc_policies_test"
        MigrationPath = "src/migrations"
    }
    "control" = @{
        Name = "Control Service"
        Path = "services/control-service"
        Database = "soc_controls_test"
        MigrationPath = "src/migrations"
    }
    "evidence" = @{
        Name = "Evidence Service"
        Path = "services/evidence-service"
        Database = "soc_evidence_test"
        MigrationPath = "src/migrations"
    }
    "workflow" = @{
        Name = "Workflow Service"
        Path = "services/workflow-service"
        Database = "soc_workflows_test"
        MigrationPath = "src/migrations"
    }
    "reporting" = @{
        Name = "Reporting Service"
        Path = "services/reporting-service"
        Database = "soc_reporting_test"
        MigrationPath = "src/migrations"
    }
    "audit" = @{
        Name = "Audit Service"
        Path = "services/audit-service"
        Database = "soc_audits_test"
        MigrationPath = "src/migrations"
    }
    "integration" = @{
        Name = "Integration Service"
        Path = "services/integration-service"
        Database = "soc_integrations_test"
        MigrationPath = "src/migrations"
    }
    "notification" = @{
        Name = "Notification Service"
        Path = "services/notification-service"
        Database = "soc_notifications_test"
        MigrationPath = "src/migrations"
    }
    "ai" = @{
        Name = "AI Service"
        Path = "services/ai-service"
        Database = "soc_ai_test"
        MigrationPath = "src/migrations"
    }
}

# Test results storage
$testResults = @()

# Function to create test database
function Create-TestDatabase {
    param([string]$DatabaseName)
    
    if ($DryRun) {
        Write-Info "Would create database: $DatabaseName"
        return $true
    }
    
    try {
        $exists = docker exec overmatch-digital-postgres-1 psql -U soc_user -lqt 2>$null | Select-String $DatabaseName
        
        if ($exists) {
            Write-Info "Dropping existing test database: $DatabaseName"
            docker exec overmatch-digital-postgres-1 psql -U soc_user -c "DROP DATABASE IF EXISTS `"$DatabaseName`";" 2>$null
        }
        
        Write-Info "Creating test database: $DatabaseName"
        docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE `"$DatabaseName`";" 2>$null
        
        return $true
    } catch {
        Write-Error "Failed to create test database: $_"
        return $false
    }
}

# Function to test migration files
function Test-MigrationFiles {
    param(
        [string]$ServicePath,
        [string]$MigrationPath
    )
    
    $fullPath = Join-Path (Get-Location) $ServicePath $MigrationPath
    Write-Info "Checking migration files in: $fullPath"
    
    if (!(Test-Path $fullPath)) {
        Write-Error "Migration directory not found"
        return @{
            Success = $false
            Files = @()
            Error = "Migration directory not found"
        }
    }
    
    $migrationFiles = Get-ChildItem -Path $fullPath -Filter "*.ts" -File 2>$null
    
    if ($migrationFiles.Count -eq 0) {
        Write-Warning "No migration files found"
        return @{
            Success = $true
            Files = @()
            Warning = "No migration files"
        }
    }
    
    Write-Success "Found $($migrationFiles.Count) migration files"
    
    # Validate migration file structure
    $validFiles = @()
    foreach ($file in $migrationFiles) {
        $content = Get-Content $file.FullName -Raw
        
        # Check for required methods
        $hasUp = $content -match "async up\s*\("
        $hasDown = $content -match "async down\s*\("
        
        if ($hasUp -and $hasDown) {
            $validFiles += $file.Name
            if ($Verbose) {
                Write-Success "  ✓ $($file.Name) - Valid structure"
            }
        } else {
            Write-Warning "  ⚠ $($file.Name) - Missing up() or down() method"
        }
    }
    
    return @{
        Success = $true
        Files = $validFiles
        Total = $migrationFiles.Count
        Valid = $validFiles.Count
    }
}

# Function to run migrations
function Run-Migration {
    param(
        [string]$ServicePath,
        [string]$Database,
        [string]$Direction = "up"
    )
    
    if ($DryRun) {
        Write-Info "Would run migration $Direction for $Database"
        return @{ Success = $true; DryRun = $true }
    }
    
    Push-Location $ServicePath
    
    try {
        # Set test database environment
        $env:DB_NAME = $Database
        $env:NODE_ENV = "test"
        
        Write-Info "Running migration:$Direction"
        
        if ($Direction -eq "up") {
            $output = npm run migration:run 2>&1
        } else {
            $output = npm run migration:revert 2>&1
        }
        
        $success = $LASTEXITCODE -eq 0
        
        if ($success) {
            Write-Success "Migration $Direction completed successfully"
        } else {
            Write-Error "Migration $Direction failed"
            if ($Verbose) {
                Write-Host $output -ForegroundColor Red
            }
        }
        
        return @{
            Success = $success
            Output = $output
            Direction = $Direction
        }
    } catch {
        Write-Error "Exception during migration: $_"
        return @{
            Success = $false
            Error = $_.Exception.Message
            Direction = $Direction
        }
    } finally {
        Pop-Location
        Remove-Item Env:\DB_NAME -ErrorAction SilentlyContinue
        Remove-Item Env:\NODE_ENV -ErrorAction SilentlyContinue
    }
}

# Function to verify database schema
function Verify-DatabaseSchema {
    param([string]$Database)
    
    if ($DryRun) {
        Write-Info "Would verify schema for $Database"
        return @{ Success = $true; DryRun = $true }
    }
    
    try {
        # Check if migrations table exists
        $migrationsTable = docker exec overmatch-digital-postgres-1 `
            psql -U soc_user -d $Database -c "\dt migrations" 2>$null
        
        if ($migrationsTable -match "migrations") {
            Write-Success "Migrations table exists"
            
            # Get executed migrations
            $executedMigrations = docker exec overmatch-digital-postgres-1 `
                psql -U soc_user -d $Database -c "SELECT name FROM migrations;" 2>$null
            
            $migrationCount = ($executedMigrations -split "`n" | Where-Object { $_ -match "\d+" }).Count
            Write-Info "Executed migrations: $migrationCount"
            
            # Get table count
            $tables = docker exec overmatch-digital-postgres-1 `
                psql -U soc_user -d $Database -c "\dt" 2>$null
            
            $tableCount = ($tables -split "`n" | Where-Object { $_ -match "table" }).Count
            Write-Info "Total tables: $tableCount"
            
            return @{
                Success = $true
                MigrationCount = $migrationCount
                TableCount = $tableCount
            }
        } else {
            Write-Warning "Migrations table not found"
            return @{
                Success = $false
                Error = "Migrations table not found"
            }
        }
    } catch {
        Write-Error "Failed to verify schema: $_"
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Function to test data integrity
function Test-DataIntegrity {
    param(
        [string]$Database,
        [string]$ServiceName
    )
    
    if (!$TestData -or $DryRun) {
        return @{ Skipped = $true }
    }
    
    Write-Info "Testing data integrity"
    
    try {
        # Insert test data
        $testData = @{
            "auth" = "INSERT INTO users (email, password, firstName, lastName) VALUES ('test@example.com', 'hash', 'Test', 'User');"
            "client" = "INSERT INTO organizations (name, industry) VALUES ('Test Org', 'Technology');"
            "policy" = "INSERT INTO policies (name, content, status) VALUES ('Test Policy', 'Content', 'draft');"
        }
        
        if ($testData.ContainsKey($ServiceName)) {
            $insertQuery = $testData[$ServiceName]
            
            Write-Info "Inserting test data"
            docker exec overmatch-digital-postgres-1 `
                psql -U soc_user -d $Database -c $insertQuery 2>$null
            
            # Verify data exists
            $table = switch ($ServiceName) {
                "auth" { "users" }
                "client" { "organizations" }
                "policy" { "policies" }
                default { $null }
            }
            
            if ($table) {
                $count = docker exec overmatch-digital-postgres-1 `
                    psql -U soc_user -d $Database -c "SELECT COUNT(*) FROM $table;" 2>$null
                
                if ($count -match "1") {
                    Write-Success "Test data inserted and verified"
                    return @{ Success = $true }
                }
            }
        }
        
        return @{ Success = $true; NoTestData = $true }
    } catch {
        Write-Error "Data integrity test failed: $_"
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

# Main test execution
Write-Step "Starting Migration Tests"

# Determine which services to test
$servicesToTest = if ($Service -eq "all") {
    $services.Keys
} else {
    if ($services.ContainsKey($Service)) {
        @($Service)
    } else {
        Write-Error "Unknown service: $Service"
        Write-Host "Available services: $($services.Keys -join ', ')"
        exit 1
    }
}

Write-Info "Testing services: $($servicesToTest -join ', ')"

# Test each service
foreach ($svcKey in $servicesToTest) {
    $svc = $services[$svcKey]
    
    Write-Step "Testing $($svc.Name)"
    
    $result = @{
        Service = $svc.Name
        Database = $svc.Database
        Tests = @{}
        StartTime = Get-Date
    }
    
    # Test 1: Check migration files
    Write-Info "Test 1: Migration file validation"
    $fileTest = Test-MigrationFiles -ServicePath $svc.Path -MigrationPath $svc.MigrationPath
    $result.Tests["FileValidation"] = $fileTest
    
    if (!$fileTest.Success -or $fileTest.Files.Count -eq 0) {
        Write-Warning "Skipping further tests due to missing migrations"
        $testResults += $result
        continue
    }
    
    # Test 2: Create test database
    Write-Info "Test 2: Database creation"
    $dbCreated = Create-TestDatabase -DatabaseName $svc.Database
    $result.Tests["DatabaseCreation"] = @{ Success = $dbCreated }
    
    if (!$dbCreated) {
        Write-Error "Failed to create test database"
        $testResults += $result
        continue
    }
    
    # Test 3: Run migrations up
    Write-Info "Test 3: Migration execution (up)"
    $upResult = Run-Migration -ServicePath $svc.Path -Database $svc.Database -Direction "up"
    $result.Tests["MigrationUp"] = $upResult
    
    if ($upResult.Success) {
        # Test 4: Verify schema
        Write-Info "Test 4: Schema verification"
        $schemaResult = Verify-DatabaseSchema -Database $svc.Database
        $result.Tests["SchemaVerification"] = $schemaResult
        
        # Test 5: Data integrity
        if ($TestData) {
            Write-Info "Test 5: Data integrity"
            $dataResult = Test-DataIntegrity -Database $svc.Database -ServiceName $svcKey
            $result.Tests["DataIntegrity"] = $dataResult
        }
        
        # Test 6: Rollback test
        if ($TestRollback) {
            Write-Info "Test 6: Migration rollback (down)"
            $downResult = Run-Migration -ServicePath $svc.Path -Database $svc.Database -Direction "down"
            $result.Tests["MigrationDown"] = $downResult
            
            if ($downResult.Success) {
                # Verify rollback
                $rollbackSchema = Verify-DatabaseSchema -Database $svc.Database
                $result.Tests["RollbackVerification"] = $rollbackSchema
                
                # Re-run migrations for final state
                Write-Info "Re-running migrations after rollback test"
                Run-Migration -ServicePath $svc.Path -Database $svc.Database -Direction "up" | Out-Null
            }
        }
    }
    
    $result.EndTime = Get-Date
    $result.Duration = $result.EndTime - $result.StartTime
    $testResults += $result
    
    # Summary for this service
    $passed = ($result.Tests.Values | Where-Object { $_.Success -eq $true }).Count
    $total = $result.Tests.Count
    
    if ($passed -eq $total) {
        Write-Success "$($svc.Name): All tests passed ($passed/$total)"
    } else {
        Write-Warning "$($svc.Name): $passed/$total tests passed"
    }
}

# Generate report
Write-Step "Test Summary"

$totalTests = 0
$passedTests = 0
$failedTests = 0

foreach ($result in $testResults) {
    foreach ($test in $result.Tests.Values) {
        $totalTests++
        if ($test.Success -eq $true) {
            $passedTests++
        } elseif ($test.Success -eq $false) {
            $failedTests++
        }
    }
}

Write-Host "`nOverall Results:" -ForegroundColor Cyan
Write-Success "Passed: $passedTests"
if ($failedTests -gt 0) {
    Write-Error "Failed: $failedTests"
}
Write-Info "Total: $totalTests"

# Generate detailed report if requested
if ($GenerateReport) {
    $reportPath = "migration-test-report.html"
    
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Migration Test Report</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        h1 { color: #333; }
        .service { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background: #f0f0f0; }
    </style>
</head>
<body>
    <h1>Migration Test Report</h1>
    <p>Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
    
    <h2>Summary</h2>
    <p>Total Tests: $totalTests | Passed: $passedTests | Failed: $failedTests</p>
    
    <h2>Service Results</h2>
"@

    foreach ($result in $testResults) {
        $serviceStatus = if (($result.Tests.Values | Where-Object { $_.Success -eq $false }).Count -eq 0) { 
            "success" 
        } else { 
            "failure" 
        }
        
        $html += @"
    <div class="service">
        <h3 class="$serviceStatus">$($result.Service)</h3>
        <table>
            <tr><th>Test</th><th>Result</th><th>Details</th></tr>
"@

        foreach ($testName in $result.Tests.Keys) {
            $test = $result.Tests[$testName]
            $status = if ($test.Success) { "✓" } elseif ($test.Skipped) { "-" } else { "✗" }
            $class = if ($test.Success) { "success" } elseif ($test.Skipped) { "warning" } else { "failure" }
            $details = if ($test.Error) { $test.Error } elseif ($test.Warning) { $test.Warning } else { "OK" }
            
            $html += @"
            <tr>
                <td>$testName</td>
                <td class="$class">$status</td>
                <td>$details</td>
            </tr>
"@
        }
        
        $html += @"
        </table>
        <p>Duration: $([math]::Round($result.Duration.TotalSeconds, 2)) seconds</p>
    </div>
"@
    }

    $html += @"
</body>
</html>
"@

    $html | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Success "Report generated: $reportPath"
    
    if (!$DryRun) {
        Start-Process $reportPath
    }
}

# Cleanup test databases if not in dry run
if (!$DryRun -and !$KeepTestDatabases) {
    Write-Step "Cleaning up test databases"
    
    foreach ($svcKey in $servicesToTest) {
        $svc = $services[$svcKey]
        docker exec overmatch-digital-postgres-1 `
            psql -U soc_user -c "DROP DATABASE IF EXISTS `"$($svc.Database)`";" 2>$null
    }
    
    Write-Success "Test databases cleaned up"
}

# Exit code based on results
if ($failedTests -gt 0) {
    exit 1
} else {
    exit 0
}