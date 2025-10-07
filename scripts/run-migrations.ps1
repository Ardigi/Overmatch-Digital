# run-migrations.ps1
# Script to run TypeORM migrations for microservices

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("auth", "client", "policy", "control", "evidence", "workflow", "reporting", "audit", "integration", "notification", "ai", "all")]
    [string]$Service = "all",
    
    [switch]$Revert,
    [switch]$Show,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Service configuration
$services = @{
    "auth" = @{
        "path" = "services/auth-service"
        "database" = "soc_auth"
        "port" = 3001
    }
    "client" = @{
        "path" = "services/client-service"
        "database" = "soc_clients"
        "port" = 3002
    }
    "policy" = @{
        "path" = "services/policy-service"
        "database" = "soc_policies"
        "port" = 3003
    }
    "control" = @{
        "path" = "services/control-service"
        "database" = "soc_controls"
        "port" = 3004
    }
    "evidence" = @{
        "path" = "services/evidence-service"
        "database" = "soc_evidence"
        "port" = 3005
    }
    "workflow" = @{
        "path" = "services/workflow-service"
        "database" = "soc_workflows"
        "port" = 3006
    }
    "reporting" = @{
        "path" = "services/reporting-service"
        "database" = "soc_reporting"
        "port" = 3007
    }
    "audit" = @{
        "path" = "services/audit-service"
        "database" = "soc_audits"
        "port" = 3008
    }
    "integration" = @{
        "path" = "services/integration-service"
        "database" = "soc_integrations"
        "port" = 3009
    }
    "notification" = @{
        "path" = "services/notification-service"
        "database" = "soc_notifications"
        "port" = 3010
    }
    "ai" = @{
        "path" = "services/ai-service"
        "database" = "soc_ai"
        "port" = 3011
    }
}

function Run-ServiceMigration {
    param(
        [string]$ServiceName,
        [hashtable]$Config
    )
    
    $servicePath = $Config.path
    $databaseName = $Config.database
    
    Write-Host "`n🔧 Processing $ServiceName service" -ForegroundColor Cyan
    Write-Host "📁 Path: $servicePath" -ForegroundColor Gray
    Write-Host "🗄️  Database: $databaseName" -ForegroundColor Gray
    
    # Check if service directory exists
    if (-not (Test-Path $servicePath)) {
        Write-Host "⚠️  Service directory not found: $servicePath" -ForegroundColor Yellow
        return
    }
    
    # Navigate to service directory
    Push-Location $servicePath
    
    try {
        # Check if migrations directory exists
        $migrationsPath = "src/migrations"
        if (-not (Test-Path $migrationsPath)) {
            Write-Host "⚠️  No migrations directory found" -ForegroundColor Yellow
            return
        }
        
        # Count migration files
        $migrationFiles = Get-ChildItem -Path $migrationsPath -Filter "*.ts" | Where-Object { $_.Name -notmatch "\.spec\.ts$" }
        if ($migrationFiles.Count -eq 0) {
            Write-Host "⚠️  No migration files found" -ForegroundColor Yellow
            return
        }
        
        Write-Host "📄 Found $($migrationFiles.Count) migration file(s)" -ForegroundColor Gray
        
        # Set environment variables
        $env:DB_HOST = "127.0.0.1"
        $env:DB_PORT = "5432"
        $env:DB_USERNAME = "postgres"
        $env:DB_PASSWORD = "postgres"
        $env:DB_NAME = $databaseName
        $env:NODE_ENV = "development"
        
        if ($Show) {
            # Show migrations
            Write-Host "📋 Showing migrations..." -ForegroundColor Yellow
            npx typeorm-ts-node-commonjs migration:show -d src/data-source.ts
        } elseif ($Revert) {
            # Revert last migration
            if ($DryRun) {
                Write-Host "🏃 DRY RUN - Would revert last migration" -ForegroundColor Yellow
            } else {
                Write-Host "⏪ Reverting last migration..." -ForegroundColor Yellow
                npx typeorm-ts-node-commonjs migration:revert -d src/data-source.ts
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Migration reverted successfully!" -ForegroundColor Green
                } else {
                    Write-Host "❌ Migration revert failed!" -ForegroundColor Red
                }
            }
        } else {
            # Run pending migrations
            if ($DryRun) {
                Write-Host "🏃 DRY RUN - Would run pending migrations" -ForegroundColor Yellow
                npx typeorm-ts-node-commonjs migration:show -d src/data-source.ts
            } else {
                Write-Host "🚀 Running migrations..." -ForegroundColor Green
                npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Migrations completed successfully!" -ForegroundColor Green
                } else {
                    Write-Host "❌ Migration failed!" -ForegroundColor Red
                }
            }
        }
    } catch {
        Write-Host "❌ Error running migration: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

# Check if databases are running
Write-Host "🔍 Checking database connection..." -ForegroundColor Cyan
$pgCheck = docker ps --filter "name=postgres" --filter "status=running" --format "{{.Names}}"
if (-not $pgCheck) {
    Write-Host "❌ PostgreSQL is not running!" -ForegroundColor Red
    Write-Host "Please start the databases first: .\start-docker-services.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Database is running" -ForegroundColor Green

# Process services
if ($Service -eq "all") {
    Write-Host "`n🚀 Running migrations for all services" -ForegroundColor Cyan
    
    foreach ($serviceName in $services.Keys | Sort-Object) {
        Run-ServiceMigration -ServiceName $serviceName -Config $services[$serviceName]
    }
    
    Write-Host "`n✅ All migrations completed!" -ForegroundColor Green
} else {
    if ($services.ContainsKey($Service)) {
        Run-ServiceMigration -ServiceName $Service -Config $services[$Service]
    } else {
        Write-Host "❌ Unknown service: $Service" -ForegroundColor Red
        exit 1
    }
}

# Summary
Write-Host "`n📊 Migration Summary:" -ForegroundColor Cyan
Write-Host "- Use -Show to view migration status" -ForegroundColor Gray
Write-Host "- Use -Revert to undo the last migration" -ForegroundColor Gray
Write-Host "- Use -DryRun to preview without executing" -ForegroundColor Gray