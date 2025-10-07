# Start SOC Compliance Platform
Write-Host "Starting SOC Compliance Platform" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# 1. Check if Docker Desktop is running
Write-Host "`nChecking Docker Desktop..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker version | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
        Write-Host "Docker Desktop is running" -ForegroundColor Green
    }
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "`nStarting Docker Desktop..." -ForegroundColor Yellow
    
    # Try to start Docker Desktop
    $dockerPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process "$dockerPath"
        Write-Host "Waiting for Docker to start (this may take 30-60 seconds)..." -ForegroundColor Yellow
        
        # Wait for Docker to be ready
        $attempts = 0
        $maxAttempts = 30
        while ($attempts -lt $maxAttempts) {
            Start-Sleep -Seconds 2
            try {
                docker version 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Docker Desktop is now running!" -ForegroundColor Green
                    $dockerRunning = $true
                    break
                }
            } catch {}
            $attempts++
            Write-Host "." -NoNewline
        }
        Write-Host ""
    } else {
        Write-Host "Docker Desktop not found at expected location" -ForegroundColor Red
        Write-Host "Please start Docker Desktop manually and run this script again" -ForegroundColor Yellow
        exit 1
    }
}

if (-not $dockerRunning) {
    Write-Host "Docker Desktop failed to start" -ForegroundColor Red
    Write-Host "Please start Docker Desktop manually and run this script again" -ForegroundColor Yellow
    exit 1
}

# 2. Start infrastructure services
Write-Host "`nStarting infrastructure services..." -ForegroundColor Yellow
Write-Host "This includes PostgreSQL, Redis, Kafka, MongoDB, Elasticsearch, and Kong" -ForegroundColor Gray

docker-compose up -d postgres redis kafka zookeeper mongodb elasticsearch kong kafka-ui

# Wait for PostgreSQL to be ready
Write-Host "`nWaiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$attempts = 0
$maxAttempts = 30
while ($attempts -lt $maxAttempts) {
    $result = docker exec overmatch-digital-postgres-1 pg_isready -U soc_user 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
    $attempts++
    Write-Host "." -NoNewline
}
Write-Host ""

# 3. Create databases
Write-Host "`nCreating databases..." -ForegroundColor Yellow
& ".\scripts\create-all-databases.ps1"

# 4. Start microservices
Write-Host "`nStarting microservices..." -ForegroundColor Yellow
docker-compose up -d auth-service client-service policy-service control-service evidence-service audit-service

# 5. Wait for services to be healthy
Write-Host "`nWaiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 6. Run diagnostics
Write-Host "`nRunning diagnostics..." -ForegroundColor Yellow
& ".\scripts\diagnose-services.ps1"

Write-Host "`nPlatform startup complete!" -ForegroundColor Green
Write-Host "`nQuick Links:" -ForegroundColor Cyan
Write-Host "   Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "   Kong Admin:  http://localhost:8001" -ForegroundColor White
Write-Host "   Kafka UI:    http://localhost:8080" -ForegroundColor White
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "   1. Start frontend: npm run dev" -ForegroundColor White
Write-Host "   2. Check logs: docker-compose logs -f [service-name]" -ForegroundColor White
Write-Host "   3. Stop all: docker-compose down" -ForegroundColor White