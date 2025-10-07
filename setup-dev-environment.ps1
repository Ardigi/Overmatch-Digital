# Master Development Environment Setup Script
# One command to set up everything for SOC Compliance Platform development
# Usage: .\setup-dev-environment.ps1 [-Quick] [-SkipDocker] [-SkipMigrations]

param(
    [switch]$Quick,        # Skip confirmations and use defaults
    [switch]$SkipDocker,   # Skip Docker setup (if already running)
    [switch]$SkipMigrations, # Skip database migrations
    [switch]$Clean        # Clean install (remove node_modules, volumes)
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
║                                                              ║
║           SOC Compliance Platform Setup                     ║
║           Development Environment Installer                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "This script will set up your complete development environment"
Write-Info "Estimated time: 5-10 minutes"

if (!$Quick) {
    Write-Host "`nPress any key to continue or Ctrl+C to cancel..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Track timing
$startTime = Get-Date

# Step 1: Check prerequisites
Write-Step "Step 1/8: Checking Prerequisites"

# Check Node.js
try {
    $nodeVersion = node --version
    if ($nodeVersion -match "v(\d+)") {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -ge 20) {
            Write-Success "Node.js $nodeVersion installed"
        } else {
            Write-Error "Node.js version 20+ required (found $nodeVersion)"
            exit 1
        }
    }
} catch {
    Write-Error "Node.js not found. Please install Node.js 20+ from https://nodejs.org"
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Success "npm $npmVersion installed"
} catch {
    Write-Error "npm not found"
    exit 1
}

# Check Docker
if (!$SkipDocker) {
    try {
        $dockerVersion = docker --version
        Write-Success "Docker installed: $dockerVersion"
        
        # Check if Docker is running
        $dockerRunning = docker ps 2>$null
        if (!$dockerRunning) {
            Write-Warning "Docker Desktop not running. Starting..."
            Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
            Write-Info "Waiting for Docker to start (30 seconds)..."
            Start-Sleep -Seconds 30
        }
    } catch {
        Write-Error "Docker not found. Please install Docker Desktop"
        exit 1
    }
}

# Check Git
try {
    $gitVersion = git --version
    Write-Success "Git installed: $gitVersion"
} catch {
    Write-Warning "Git not found (optional but recommended)"
}

# Step 2: Clean if requested
if ($Clean) {
    Write-Step "Step 2/8: Cleaning Previous Installation"
    
    Write-Info "Stopping all containers..."
    docker-compose down -v 2>$null
    
    Write-Info "Removing node_modules..."
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force
    }
    Get-ChildItem -Path "services" -Directory | ForEach-Object {
        $nodeModulesPath = Join-Path $_.FullName "node_modules"
        if (Test-Path $nodeModulesPath) {
            Write-Info "Removing $($_.Name)/node_modules..."
            Remove-Item -Path $nodeModulesPath -Recurse -Force
        }
    }
    
    Write-Info "Removing package-lock files..."
    Get-ChildItem -Path . -Filter "package-lock.json" -Recurse | Remove-Item -Force
    
    Write-Success "Clean complete"
} else {
    Write-Step "Step 2/8: Skipping Clean (use -Clean flag to clean)"
}

# Step 3: Install dependencies
Write-Step "Step 3/8: Installing Dependencies"

Write-Info "Installing root dependencies..."
npm install

Write-Success "Dependencies installed"

# Step 4: Build shared packages
Write-Step "Step 4/8: Building Shared Packages"

Write-Info "Building shared packages (this is critical!)..."
npm run build:shared

# Verify packages built
$packagesToCheck = @(
    "packages/auth-common/dist",
    "packages/cache-common/dist",
    "packages/http-common/dist",
    "packages/monitoring/dist",
    "packages/secrets/dist"
)

$allBuilt = $true
foreach ($package in $packagesToCheck) {
    if (Test-Path $package) {
        Write-Success "$package built"
    } else {
        Write-Error "$package not found"
        $allBuilt = $false
    }
}

if (!$allBuilt) {
    Write-Error "Some packages failed to build. Please check for errors above."
    exit 1
}

# Step 5: Start Docker services
if (!$SkipDocker) {
    Write-Step "Step 5/8: Starting Docker Services"
    
    Write-Info "Starting infrastructure services..."
    docker-compose up -d
    
    Write-Info "Waiting for services to initialize (30 seconds)..."
    Start-Sleep -Seconds 30
    
    # Check critical services
    $criticalServices = @("postgres", "redis", "kafka", "mongodb")
    foreach ($service in $criticalServices) {
        $container = "overmatch-digital-$service-1"
        $status = docker ps --filter "name=$container" --format "{{.Status}}"
        if ($status -like "Up*") {
            Write-Success "$service is running"
        } else {
            Write-Error "$service failed to start"
        }
    }
} else {
    Write-Step "Step 5/8: Skipping Docker Setup (use without -SkipDocker to set up)"
}

# Step 6: Create databases
Write-Step "Step 6/8: Setting Up Databases"

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

Write-Info "Creating databases..."
foreach ($db in $databases) {
    $exists = docker exec overmatch-digital-postgres-1 psql -U soc_user -lqt 2>$null | Select-String $db
    if (!$exists) {
        Write-Info "Creating database $db..."
        docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE `"$db`";" 2>$null
        Write-Success "Database $db created"
    } else {
        Write-Success "Database $db already exists"
    }
}

# Step 7: Run migrations
if (!$SkipMigrations) {
    Write-Step "Step 7/8: Running Database Migrations"
    
    if (Test-Path "scripts/run-migrations.ps1") {
        Write-Info "Running migrations..."
        & .\scripts\run-migrations.ps1
    } else {
        Write-Warning "Migration script not found. You may need to run migrations manually."
    }
} else {
    Write-Step "Step 7/8: Skipping Migrations (use without -SkipMigrations to run)"
}

# Step 8: Health check
Write-Step "Step 8/8: Running Health Check"

if (Test-Path "scripts/check-all-services-health.ps1") {
    & .\scripts\check-all-services-health.ps1
} else {
    Write-Warning "Health check script not found"
}

# Setup complete
$endTime = Get-Date
$duration = $endTime - $startTime
$minutes = [math]::Round($duration.TotalMinutes, 1)

Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║              ✓ SETUP COMPLETE!                              ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Success "`nEnvironment ready in $minutes minutes!"

# Next steps
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Start the frontend:    " -NoNewline
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host "2. Open browser:         " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host "3. Login with:           " -NoNewline
Write-Host "admin@soc-platform.com / SecurePass123!" -ForegroundColor Yellow

Write-Host "`n🛠️ Useful Commands:" -ForegroundColor Cyan
Write-Host "Health check:            " -NoNewline
Write-Host ".\scripts\check-all-services-health.ps1" -ForegroundColor Yellow
Write-Host "View logs:              " -NoNewline
Write-Host "docker-compose logs -f [service-name]" -ForegroundColor Yellow
Write-Host "Run tests:              " -NoNewline
Write-Host "npm test" -ForegroundColor Yellow
Write-Host "Stop everything:        " -NoNewline
Write-Host "docker-compose down" -ForegroundColor Yellow

Write-Host "`n📚 Documentation:" -ForegroundColor Cyan
Write-Host "Quick Start:            " -NoNewline
Write-Host "QUICK_START_5MIN.md" -ForegroundColor Yellow
Write-Host "Architecture:           " -NoNewline
Write-Host "docs/ARCHITECTURE.md" -ForegroundColor Yellow
Write-Host "Troubleshooting:        " -NoNewline
Write-Host "docs/TROUBLESHOOTING.md" -ForegroundColor Yellow

# Create .env file if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Info "`nCreating .env file with defaults..."
    @"
# PostgreSQL
POSTGRES_USER=soc_user
POSTGRES_PASSWORD=soc_pass
POSTGRES_DB=soc_compliance

# MongoDB
MONGO_ROOT_USERNAME=soc_user
MONGO_ROOT_PASSWORD=soc_pass
MONGO_INITDB_DATABASE=soc_documents

# Redis
REDIS_PASSWORD=soc_redis_pass

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Node Environment
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Success ".env file created with defaults"
}

Write-Host "`n" -NoNewline
Write-Info "Happy coding! 🚀"