# Start Docker Services for SOC Compliance Platform
Write-Host "Starting Docker Services for Authentication Testing..." -ForegroundColor Green

# Check if Docker is running
docker version > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop first!" -ForegroundColor Red
    Write-Host "You can start Docker Desktop from the Start Menu or system tray." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDocker is running. Starting services..." -ForegroundColor Green

# Navigate to project root
cd $PSScriptRoot

# Stop any existing containers
Write-Host "`nStopping any existing containers..." -ForegroundColor Yellow
docker-compose down

# Start infrastructure services first
Write-Host "`nStarting infrastructure services (PostgreSQL, Redis, Kafka, etc.)..." -ForegroundColor Cyan
docker-compose up -d postgres redis kafka zookeeper mongodb elasticsearch

# Wait for PostgreSQL to be ready
Write-Host "`nWaiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    $result = docker exec overmatch-digital-postgres-1 pg_isready -U soc_user 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    $attempt++
}

# Create databases
Write-Host "`nCreating databases..." -ForegroundColor Cyan
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -c "CREATE DATABASE soc_auth;" 2>&1 | Out-Null
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -c "CREATE DATABASE soc_clients;" 2>&1 | Out-Null
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -c "CREATE DATABASE soc_controls;" 2>&1 | Out-Null
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -c "CREATE DATABASE soc_policies;" 2>&1 | Out-Null
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -c "CREATE DATABASE soc_evidence;" 2>&1 | Out-Null

# Build auth service
Write-Host "`nBuilding auth service..." -ForegroundColor Cyan
docker-compose build auth-service

# Start auth service
Write-Host "`nStarting auth service..." -ForegroundColor Cyan
docker-compose up -d auth-service

# Wait for auth service to be ready
Write-Host "`nWaiting for auth service to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -ErrorAction Stop
        if ($response.status -eq "ok") {
            Write-Host "`nAuth service is ready!" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline
    }
    Start-Sleep -Seconds 2
    $attempt++
}

# Show status
Write-Host "`n`nService Status:" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n`nAll services started! You can now:" -ForegroundColor Green
Write-Host "1. Create initial admin: POST http://localhost:3001/auth/setup" -ForegroundColor Yellow
Write-Host "2. Register users: POST http://localhost:3001/auth/register" -ForegroundColor Yellow
Write-Host "3. Login: POST http://localhost:3001/auth/login" -ForegroundColor Yellow
Write-Host "`nTo view logs: docker-compose logs -f auth-service" -ForegroundColor Gray
Write-Host "To stop all: docker-compose down" -ForegroundColor Gray