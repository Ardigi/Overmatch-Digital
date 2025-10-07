# PowerShell script to create all service databases
Write-Host "Creating databases for SOC Compliance Platform" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check if Docker PostgreSQL is running
$postgresContainer = docker ps --filter "name=overmatch-digital-postgres-1" --format "{{.Names}}"
if (-not $postgresContainer) {
    Write-Host "PostgreSQL container not found. Starting Docker services..." -ForegroundColor Yellow
    docker-compose up -d postgres redis kafka
    Start-Sleep -Seconds 10
}

# Create databases
Write-Host "" -ForegroundColor Yellow
Write-Host "Creating service databases..." -ForegroundColor Yellow

$databases = @(
    "soc_auth_db",
    "soc_client_db", 
    "soc_audit_db",
    "soc_policy_db",
    "soc_controls",
    "soc_evidence",
    "soc_workflow",
    "soc_reporting",
    "soc_notification",
    "soc_integration",
    "soc_ai"
)

foreach ($db in $databases) {
    Write-Host "Creating database: $db" -ForegroundColor Cyan
    
    # Create database
    docker exec overmatch-digital-postgres-1 psql -U soc_user -d postgres -c "CREATE DATABASE $db;" 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Database $db created successfully" -ForegroundColor Green
    } else {
        # Database might already exist
        Write-Host "  Database $db already exists or error occurred" -ForegroundColor Yellow
    }
    
    # Grant privileges
    docker exec overmatch-digital-postgres-1 psql -U soc_user -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $db TO soc_user;" 2>$null
}

# Verify databases
Write-Host "" -ForegroundColor Yellow
Write-Host "Verifying databases..." -ForegroundColor Yellow
docker exec overmatch-digital-postgres-1 psql -U soc_user -d postgres -c '\l' | Select-String "soc_"

Write-Host "" -ForegroundColor Green
Write-Host "Database creation completed!" -ForegroundColor Green