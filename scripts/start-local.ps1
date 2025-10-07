# PowerShell script to start all services locally without Docker
# This script starts infrastructure services and microservices for local development

param(
    [string]$PostgresPassword = "postgres",
    [switch]$SkipInfrastructure,
    [switch]$ServicesOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Continue"

Write-Host "=== SOC Compliance Platform - Local Development Startup ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator (needed for some services)
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Warning: Not running as administrator. Some services may fail to start." -ForegroundColor Yellow
    Write-Host "Consider running: Start-Process powershell -Verb RunAs" -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    } catch {
        return $false
    }
}

# Function to start a service in a new window
function Start-ServiceWindow {
    param(
        [string]$ServiceName,
        [string]$WorkingDirectory,
        [string]$Command,
        [int]$Port
    )
    
    Write-Host "Starting $ServiceName..." -ForegroundColor Yellow
    
    # Check if port is already in use
    if (Test-Port -Port $Port) {
        Write-Host "  Port $Port is already in use. $ServiceName may already be running." -ForegroundColor DarkYellow
        return
    }
    
    # Start the service in a new PowerShell window
    $scriptBlock = "cd '$WorkingDirectory'; Write-Host 'Starting $ServiceName on port $Port' -ForegroundColor Green; $Command"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $scriptBlock
    
    Write-Host "  $ServiceName starting on port $Port" -ForegroundColor Green
}

# Infrastructure Services
if (-not $ServicesOnly -and -not $FrontendOnly) {
    Write-Host "=== Starting Infrastructure Services ===" -ForegroundColor Cyan
    Write-Host ""
    
    # PostgreSQL
    Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
    if (Test-Port -Port 5432) {
        Write-Host "  PostgreSQL is already running on port 5432" -ForegroundColor Green
    } else {
        Write-Host "  PostgreSQL is not running. Please start it manually." -ForegroundColor Red
        Write-Host "  Windows: Start PostgreSQL service from Services panel" -ForegroundColor Yellow
        Write-Host "  Or run: net start postgresql-x64-15" -ForegroundColor Yellow
    }
    
    # Redis
    if (-not $SkipInfrastructure) {
        if (-not (Test-Port -Port 6379)) {
            Write-Host ""
            Write-Host "Starting Redis..." -ForegroundColor Yellow
            $redisPath = "C:\Program Files\Redis"
            if (Test-Path $redisPath) {
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$redisPath'; .\redis-server.exe --requirepass soc_redis_pass"
                Write-Host "  Redis starting on port 6379" -ForegroundColor Green
            } else {
                Write-Host "  Redis not found. Please install Redis or update the path." -ForegroundColor Red
                Write-Host "  Download from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  Redis is already running on port 6379" -ForegroundColor Green
        }
    }
    
    # MongoDB
    if (-not $SkipInfrastructure) {
        if (-not (Test-Port -Port 27017)) {
            Write-Host ""
            Write-Host "Starting MongoDB..." -ForegroundColor Yellow
            $mongoPath = "C:\Program Files\MongoDB\Server\7.0\bin"
            if (Test-Path $mongoPath) {
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mongoPath'; .\mongod.exe --dbpath 'C:\data\db'"
                Write-Host "  MongoDB starting on port 27017" -ForegroundColor Green
            } else {
                Write-Host "  MongoDB not found. Please install MongoDB or update the path." -ForegroundColor Red
            }
        } else {
            Write-Host "  MongoDB is already running on port 27017" -ForegroundColor Green
        }
    }
    
    # Elasticsearch
    if (-not $SkipInfrastructure) {
        if (-not (Test-Port -Port 9200)) {
            Write-Host ""
            Write-Host "Starting Elasticsearch..." -ForegroundColor Yellow
            $elasticPath = "C:\elasticsearch-8.11.0"
            if (Test-Path $elasticPath) {
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$elasticPath\bin'; .\elasticsearch.bat"
                Write-Host "  Elasticsearch starting on port 9200" -ForegroundColor Green
            } else {
                Write-Host "  Elasticsearch not found. Please install or update the path." -ForegroundColor Red
            }
        } else {
            Write-Host "  Elasticsearch is already running on port 9200" -ForegroundColor Green
        }
    }
    
    # Kafka
    if (-not $SkipInfrastructure) {
        if (-not (Test-Port -Port 9092)) {
            Write-Host ""
            Write-Host "Starting Kafka..." -ForegroundColor Yellow
            $kafkaPath = "C:\kafka_2.13-3.5.0"
            if (Test-Path $kafkaPath) {
                # Start Zookeeper first
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$kafkaPath'; .\bin\windows\zookeeper-server-start.bat .\config\zookeeper.properties"
                Start-Sleep -Seconds 5
                # Then start Kafka
                Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$kafkaPath'; .\bin\windows\kafka-server-start.bat .\config\server.properties"
                Write-Host "  Kafka starting on port 9092" -ForegroundColor Green
            } else {
                Write-Host "  Kafka not found. Please install or update the path." -ForegroundColor Red
            }
        } else {
            Write-Host "  Kafka is already running on port 9092" -ForegroundColor Green
        }
    }
    
    # Wait for infrastructure to be ready
    Write-Host ""
    Write-Host "Waiting for infrastructure services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Create databases if needed
if (-not $ServicesOnly -and -not $FrontendOnly -and -not $SkipInfrastructure) {
    Write-Host ""
    Write-Host "=== Setting up databases ===" -ForegroundColor Cyan
    & "$PSScriptRoot\setup-local-databases.ps1" -PostgresPassword $PostgresPassword
}

# Microservices
if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "=== Starting Microservices ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Build shared packages first
    Write-Host "Building shared packages..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot\..
    npm run build --workspace=packages/auth-common 2>$null
    npm run build --workspace=shared/contracts 2>$null
    npm run build --workspace=shared/events 2>$null
    Write-Host "  Shared packages built" -ForegroundColor Green
    
    # Start Auth Service
    Start-ServiceWindow -ServiceName "Auth Service" `
        -WorkingDirectory "$PSScriptRoot\..\services\auth-service" `
        -Command "npm run start:dev" `
        -Port 3001
    
    Start-Sleep -Seconds 2
    
    # Start Client Service
    Start-ServiceWindow -ServiceName "Client Service" `
        -WorkingDirectory "$PSScriptRoot\..\services\client-service" `
        -Command "npm run start:dev" `
        -Port 3002
    
    # Optionally start other services
    # Start-ServiceWindow -ServiceName "Policy Service" `
    #     -WorkingDirectory "$PSScriptRoot\..\services\policy-service" `
    #     -Command "npm run start:dev" `
    #     -Port 3003
}

# Frontend
if (-not $ServicesOnly) {
    Write-Host ""
    Write-Host "=== Starting Frontend ===" -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    
    Start-ServiceWindow -ServiceName "Frontend Application" `
        -WorkingDirectory $PSScriptRoot\.. `
        -Command "npm run dev" `
        -Port 3000
}

# Final status
Write-Host ""
Write-Host "=== Startup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Services should be available at:" -ForegroundColor Cyan
Write-Host "  Frontend:        http://localhost:3000" -ForegroundColor White
Write-Host "  Auth Service:    http://localhost:3001/health" -ForegroundColor White
Write-Host "  Client Service:  http://localhost:3002/health" -ForegroundColor White
Write-Host ""
Write-Host "Infrastructure:" -ForegroundColor Cyan
Write-Host "  PostgreSQL:      localhost:5432" -ForegroundColor White
Write-Host "  Redis:           localhost:6379" -ForegroundColor White
Write-Host "  MongoDB:         localhost:27017" -ForegroundColor White
Write-Host "  Elasticsearch:   localhost:9200" -ForegroundColor White
Write-Host "  Kafka:           localhost:9092" -ForegroundColor White
Write-Host ""
Write-Host "To stop all services, close the PowerShell windows." -ForegroundColor Yellow
Write-Host ""
Write-Host "Troubleshooting:" -ForegroundColor Yellow
Write-Host "  - If a service fails, check its window for error messages" -ForegroundColor White
Write-Host "  - Ensure all infrastructure services are installed" -ForegroundColor White
Write-Host "  - Check that .env.local files exist in each service directory" -ForegroundColor White
Write-Host "  - Run 'npm install' if you see module not found errors" -ForegroundColor White