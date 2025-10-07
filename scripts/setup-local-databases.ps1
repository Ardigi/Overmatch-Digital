# PowerShell script to set up PostgreSQL databases for local development
# Run this script with administrator privileges

param(
    [string]$PostgresUser = "postgres",
    [string]$PostgresPassword = "",
    [string]$PostgresHost = "localhost",
    [string]$PostgresPort = "5432"
)

Write-Host "=== SOC Compliance Platform - Local Database Setup ===" -ForegroundColor Cyan
Write-Host ""

# Function to execute PostgreSQL command
function Execute-PostgresCommand {
    param(
        [string]$Command,
        [string]$Database = "postgres"
    )
    
    # Try to find psql in common locations
    $psqlPath = $null
    $possiblePaths = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "psql"  # Try PATH as fallback
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path -ErrorAction SilentlyContinue) {
            $psqlPath = $path
            break
        } elseif (Get-Command $path -ErrorAction SilentlyContinue) {
            $psqlPath = $path
            break
        }
    }
    
    if (-not $psqlPath) {
        Write-Host "Error: psql.exe not found. Please ensure PostgreSQL is installed." -ForegroundColor Red
        return $false
    }
    
    $env:PGPASSWORD = $PostgresPassword
    $result = & $psqlPath -h $PostgresHost -p $PostgresPort -U $PostgresUser -d $Database -c $Command 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        return $true
    } else {
        Write-Host "Error: $result" -ForegroundColor Red
        return $false
    }
}

# Check if PostgreSQL is accessible
Write-Host "Checking PostgreSQL connection..." -ForegroundColor Yellow
$testConnection = Execute-PostgresCommand -Command "SELECT version();"

if (-not $testConnection) {
    Write-Host "Failed to connect to PostgreSQL. Please ensure:" -ForegroundColor Red
    Write-Host "1. PostgreSQL is installed and running"
    Write-Host "2. The connection parameters are correct"
    Write-Host "3. You have the correct password"
    exit 1
}

Write-Host "PostgreSQL connection successful!" -ForegroundColor Green
Write-Host ""

# List of databases to create
$databases = @(
    "soc_auth",
    "soc_clients", 
    "soc_policies",
    "soc_controls",
    "soc_evidence",
    "soc_workflows",
    "soc_reporting",
    "soc_audits",
    "soc_integrations",
    "soc_notifications",
    "soc_ai"
)

# Create each database
foreach ($db in $databases) {
    Write-Host "Creating database: $db" -ForegroundColor Yellow
    
    # Check if database exists
    $checkExists = Execute-PostgresCommand -Command "SELECT 1 FROM pg_database WHERE datname = '$db';"
    
    if ($checkExists -and $result -match "1 row") {
        Write-Host "  Database '$db' already exists, skipping..." -ForegroundColor DarkYellow
    } else {
        $created = Execute-PostgresCommand -Command "CREATE DATABASE $db;"
        if ($created) {
            Write-Host "  Database '$db' created successfully!" -ForegroundColor Green
            
            # Grant all privileges to the user
            Execute-PostgresCommand -Command "GRANT ALL PRIVILEGES ON DATABASE $db TO $PostgresUser;" | Out-Null
        }
    }
}

Write-Host ""
Write-Host "=== Database Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Databases created:" -ForegroundColor Cyan
foreach ($db in $databases) {
    Write-Host "  - $db"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your .env files with the database connection details"
Write-Host "2. Run the services with 'npm run start:dev' in each service directory"
Write-Host "3. The services will automatically create their tables on first run"
Write-Host ""
Write-Host "Connection string format:" -ForegroundColor Cyan
Write-Host "  postgres://${PostgresUser}:${PostgresPassword}@${PostgresHost}:${PostgresPort}/<database_name>"