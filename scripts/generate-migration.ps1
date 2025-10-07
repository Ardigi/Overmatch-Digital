# generate-migration.ps1
# Script to generate TypeORM migrations for microservices

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("auth", "client", "policy", "control", "evidence", "workflow", "reporting", "audit", "integration", "notification", "ai")]
    [string]$Service,
    
    [Parameter(Mandatory=$true)]
    [string]$MigrationName,
    
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Service configuration
$services = @{
    "auth" = @{
        "path" = "services/auth-service"
        "database" = "soc_auth"
    }
    "client" = @{
        "path" = "services/client-service"
        "database" = "soc_clients"
    }
    "policy" = @{
        "path" = "services/policy-service"
        "database" = "soc_policies"
    }
    "control" = @{
        "path" = "services/control-service"
        "database" = "soc_controls"
    }
    "evidence" = @{
        "path" = "services/evidence-service"
        "database" = "soc_evidence"
    }
    "workflow" = @{
        "path" = "services/workflow-service"
        "database" = "soc_workflows"
    }
    "reporting" = @{
        "path" = "services/reporting-service"
        "database" = "soc_reporting"
    }
    "audit" = @{
        "path" = "services/audit-service"
        "database" = "soc_audits"
    }
    "integration" = @{
        "path" = "services/integration-service"
        "database" = "soc_integrations"
    }
    "notification" = @{
        "path" = "services/notification-service"
        "database" = "soc_notifications"
    }
    "ai" = @{
        "path" = "services/ai-service"
        "database" = "soc_ai"
    }
}

$serviceConfig = $services[$Service]
$servicePath = $serviceConfig.path
$databaseName = $serviceConfig.database

Write-Host "🔧 Generating migration for $Service service" -ForegroundColor Cyan
Write-Host "📁 Service path: $servicePath" -ForegroundColor Gray
Write-Host "🗄️  Database: $databaseName" -ForegroundColor Gray

# Check if service directory exists
if (-not (Test-Path $servicePath)) {
    Write-Host "❌ Service directory not found: $servicePath" -ForegroundColor Red
    exit 1
}

# Navigate to service directory
Push-Location $servicePath

try {
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
        npm install
    }

    # Ensure migrations directory exists
    $migrationsPath = "src/migrations"
    if (-not (Test-Path $migrationsPath)) {
        Write-Host "📁 Creating migrations directory..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $migrationsPath -Force | Out-Null
    }

    # Generate timestamp for migration
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $migrationClass = $MigrationName -replace '[^a-zA-Z0-9]', ''
    $migrationFileName = "$timestamp-$MigrationName"

    Write-Host "⏱️  Timestamp: $timestamp" -ForegroundColor Gray
    Write-Host "📝 Migration name: $migrationFileName" -ForegroundColor Gray

    if ($DryRun) {
        Write-Host "🏃 DRY RUN - Would generate migration: $migrationFileName" -ForegroundColor Yellow
        
        # Show TypeORM command that would be run
        Write-Host "`nCommand that would be executed:" -ForegroundColor Cyan
        Write-Host "npm run typeorm migration:generate -- -n $migrationFileName" -ForegroundColor White
    } else {
        # Generate migration using TypeORM CLI
        Write-Host "🚀 Generating migration..." -ForegroundColor Green
        
        # Set environment variables for database connection
        $env:DB_HOST = "127.0.0.1"
        $env:DB_PORT = "5432"
        $env:DB_USERNAME = "postgres"
        $env:DB_PASSWORD = "postgres"
        $env:DB_NAME = $databaseName
        
        # Run TypeORM migration generation
        $migrationCommand = "npx typeorm-ts-node-commonjs migration:generate -d src/data-source.ts src/migrations/$migrationFileName"
        
        Write-Host "Executing: $migrationCommand" -ForegroundColor Gray
        Invoke-Expression $migrationCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration generated successfully!" -ForegroundColor Green
            
            # Find the generated migration file
            $generatedFile = Get-ChildItem -Path $migrationsPath -Filter "*$migrationFileName.ts" | Select-Object -First 1
            
            if ($generatedFile) {
                Write-Host "📄 Generated file: $($generatedFile.Name)" -ForegroundColor Green
                Write-Host "`nNext steps:" -ForegroundColor Yellow
                Write-Host "1. Review the generated migration in: $migrationsPath/$($generatedFile.Name)" -ForegroundColor White
                Write-Host "2. Make any necessary adjustments" -ForegroundColor White
                Write-Host "3. Run the migration: .\scripts\run-migrations.ps1 -Service $Service" -ForegroundColor White
            }
        } else {
            Write-Host "❌ Migration generation failed!" -ForegroundColor Red
            Write-Host "Make sure the database is running and accessible" -ForegroundColor Yellow
            Write-Host "You can start the databases with: .\start-docker-services.ps1" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Error generating migration: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# Migration template reference
if ($DryRun) {
    Write-Host "`n📋 Migration Template Reference:" -ForegroundColor Cyan
    Write-Host @"
import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class $migrationClass$timestamp implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create table
    await queryRunner.createTable(
      new Table({
        name: 'table_name',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          // ... other columns
        ],
      }),
      true
    );

    // Create index
    await queryRunner.createIndex('table_name', new Index({
      name: 'IDX_table_name_field',
      columnNames: ['field'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('table_name');
  }
}
"@ -ForegroundColor Gray
}