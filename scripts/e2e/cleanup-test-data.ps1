# PowerShell script to cleanup E2E test data
# This script cleans up test databases and containers after E2E tests

param(
    [switch]$DropDatabases,
    [switch]$RemoveContainers,
    [switch]$RemoveVolumes,
    [switch]$Full
)

Write-Host "=== SOC Compliance Platform - E2E Test Cleanup ===" -ForegroundColor Cyan
Write-Host ""

# Function to execute PostgreSQL command
function Execute-PostgresCommand {
    param(
        [string]$Command,
        [string]$Database = "postgres",
        [string]$Host = "localhost",
        [string]$Port = "5433",
        [string]$User = "test_user",
        [string]$Password = "test_pass"
    )
    
    $env:PGPASSWORD = $Password
    docker exec overmatch-digital-postgres-test-1 psql -U $User -d $Database -c $Command 2>&1
}

# Stop and remove test containers
if ($RemoveContainers -or $Full) {
    Write-Host "Stopping and removing test containers..." -ForegroundColor Yellow
    docker-compose -f docker/testing/docker-compose.e2e.yml down
    Write-Host "Test containers removed." -ForegroundColor Green
}

# Remove test volumes
if ($RemoveVolumes -or $Full) {
    Write-Host "Removing test volumes..." -ForegroundColor Yellow
    docker volume prune -f --filter "label=com.docker.compose.project=overmatch-digital-e2e"
    Write-Host "Test volumes removed." -ForegroundColor Green
}

# Drop test databases
if ($DropDatabases -or $Full) {
    Write-Host "Dropping test databases..." -ForegroundColor Yellow
    
    # Check if test PostgreSQL is running
    $testPgRunning = docker ps --format "{{.Names}}" | Select-String "postgres-test"
    
    if ($testPgRunning) {
        $databases = @(
            "soc_auth_test",
            "soc_clients_test",
            "soc_policies_test",
            "soc_controls_test",
            "soc_evidence_test",
            "soc_workflows_test",
            "soc_reporting_test",
            "soc_audits_test",
            "soc_integrations_test",
            "soc_notifications_test",
            "soc_ai_test"
        )
        
        foreach ($db in $databases) {
            Write-Host "  Dropping database: $db" -ForegroundColor DarkYellow
            Execute-PostgresCommand -Command "DROP DATABASE IF EXISTS $db;"
        }
        
        Write-Host "Test databases dropped." -ForegroundColor Green
    } else {
        Write-Host "Test PostgreSQL not running. Skipping database cleanup." -ForegroundColor DarkYellow
    }
}

# Clean up local test files
Write-Host "Cleaning up local test files..." -ForegroundColor Yellow

# Remove test evidence files
$testEvidencePath = "C:\tmp\evidence-test"
if (Test-Path $testEvidencePath) {
    Remove-Item -Path $testEvidencePath -Recurse -Force
    Write-Host "  Removed test evidence files" -ForegroundColor Green
}

# Remove test report files
$testReportsPath = "C:\tmp\reports-test"
if (Test-Path $testReportsPath) {
    Remove-Item -Path $testReportsPath -Recurse -Force
    Write-Host "  Removed test report files" -ForegroundColor Green
}

# Remove test logs
$testLogsPath = ".\logs\e2e-test-*.log"
if (Test-Path $testLogsPath) {
    Remove-Item -Path $testLogsPath -Force
    Write-Host "  Removed test logs" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Green
Write-Host ""

if (-not ($RemoveContainers -or $RemoveVolumes -or $DropDatabases -or $Full)) {
    Write-Host "No cleanup actions specified. Use one of the following flags:" -ForegroundColor Yellow
    Write-Host "  -DropDatabases    : Drop all test databases"
    Write-Host "  -RemoveContainers : Remove all test containers"
    Write-Host "  -RemoveVolumes    : Remove all test volumes"
    Write-Host "  -Full            : Perform all cleanup actions"
    Write-Host ""
    Write-Host "Example: .\cleanup-test-data.ps1 -Full"
}