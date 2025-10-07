# Diagnose Service Issues Script
Write-Host "SOC Compliance Platform - Service Diagnostics" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Function to check service health
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [string]$Port,
        [string]$HealthPath = "/health"
    )
    
    Write-Host "`n Testing $ServiceName on port $Port..." -ForegroundColor Yellow
    
    # Check if port is listening
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue
    if (-not $connection.TcpTestSucceeded) {
        Write-Host "   Port $Port is not listening" -ForegroundColor Red
        return $false
    }
    
    Write-Host "   Port $Port is open" -ForegroundColor Green
    
    # Try health endpoint
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:${Port}${HealthPath}" -Method Get -TimeoutSec 5
        Write-Host "   Health endpoint responded" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "   Health endpoint failed: $_" -ForegroundColor Red
        return $false
    }
}

# Function to check Docker container status
function Get-DockerStatus {
    param([string]$ServiceName)
    
    $container = docker ps --filter "name=$ServiceName" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String $ServiceName
    if ($container) {
        Write-Host "   Docker: $container" -ForegroundColor Cyan
        
        # Get last 10 lines of logs
        Write-Host "   Recent logs:" -ForegroundColor Yellow
        docker logs $ServiceName --tail 10 2>&1 | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    } else {
        Write-Host "   Container not running" -ForegroundColor Red
    }
}

# 1. Check Infrastructure Services
Write-Host "`nInfrastructure Services" -ForegroundColor Magenta
Write-Host "=========================" -ForegroundColor Magenta

# PostgreSQL
Write-Host "`nPostgreSQL (5432)" -ForegroundColor Yellow
$pgRunning = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
if ($pgRunning.TcpTestSucceeded) {
    Write-Host "   PostgreSQL is running" -ForegroundColor Green
    
    # Check databases
    Write-Host "   Checking databases..." -ForegroundColor Yellow
    $databases = docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_compliance -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'soc_%';" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dbList = $databases -split "`n"
        $dbList | Where-Object { $_.Trim() } | ForEach-Object {
            Write-Host "      Database: $($_.Trim())" -ForegroundColor Green
        }
    } else {
        Write-Host "   Could not list databases" -ForegroundColor Red
    }
} else {
    Write-Host "   PostgreSQL is not running" -ForegroundColor Red
}

# Redis
Write-Host "`nRedis (6379)" -ForegroundColor Yellow
$redisRunning = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
if ($redisRunning.TcpTestSucceeded) {
    Write-Host "   Redis is running" -ForegroundColor Green
    
    # Test Redis auth
    $redisPing = docker exec overmatch-digital-redis-1 redis-cli -a soc_redis_pass ping 2>&1
    if ($redisPing -match "PONG") {
        Write-Host "   Redis authentication working" -ForegroundColor Green
    } else {
        Write-Host "   Redis authentication failed" -ForegroundColor Red
    }
} else {
    Write-Host "   Redis is not running" -ForegroundColor Red
}

# Kafka
Write-Host "`nKafka (9092)" -ForegroundColor Yellow
$kafkaRunning = Test-NetConnection -ComputerName localhost -Port 9092 -WarningAction SilentlyContinue
if ($kafkaRunning.TcpTestSucceeded) {
    Write-Host "   Kafka is running" -ForegroundColor Green
} else {
    Write-Host "   Kafka is not running" -ForegroundColor Red
}

# Kong
Write-Host "`nKong Gateway (8000/8001)" -ForegroundColor Yellow
$kongProxy = Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue
$kongAdmin = Test-NetConnection -ComputerName localhost -Port 8001 -WarningAction SilentlyContinue
if ($kongProxy.TcpTestSucceeded -and $kongAdmin.TcpTestSucceeded) {
    Write-Host "   Kong is running" -ForegroundColor Green
    
    # Check Kong routes
    try {
        $routes = Invoke-RestMethod -Uri "http://localhost:8001/routes" -Method Get
        Write-Host "   Kong has $($routes.data.Count) routes configured" -ForegroundColor Cyan
    } catch {
        Write-Host "   Could not fetch Kong routes" -ForegroundColor Red
    }
} else {
    Write-Host "   Kong is not running properly" -ForegroundColor Red
}

# 2. Check Microservices
Write-Host "`nMicroservices Status" -ForegroundColor Magenta
Write-Host "======================" -ForegroundColor Magenta

$services = @(
    @{Name="Auth Service"; Port=3001; Container="overmatch-digital-auth-service-1"},
    @{Name="Client Service"; Port=3002; Container="overmatch-digital-client-service-1"; HealthPath="/api/v1/health"},
    @{Name="Policy Service"; Port=3003; Container="overmatch-digital-policy-service-1"},
    @{Name="Control Service"; Port=3004; Container="overmatch-digital-control-service-1"},
    @{Name="Evidence Service"; Port=3005; Container="overmatch-digital-evidence-service-1"},
    @{Name="Audit Service"; Port=3008; Container="overmatch-digital-audit-service-1"}
)

$workingServices = 0
$failedServices = 0

foreach ($service in $services) {
    $healthy = Test-ServiceHealth -ServiceName $service.Name -Port $service.Port -HealthPath $service.HealthPath
    Get-DockerStatus -ServiceName $service.Container
    
    if ($healthy) {
        $workingServices++
    } else {
        $failedServices++
    }
}

# 3. Test Kong Routes
Write-Host "`nKong Gateway Routes" -ForegroundColor Magenta
Write-Host "=====================" -ForegroundColor Magenta

$kongRoutes = @(
    @{Name="Auth Service"; Path="/api/auth/health"},
    @{Name="Client Service"; Path="/api/clients/health"},
    @{Name="Policy Service"; Path="/api/policies/health"},
    @{Name="Control Service"; Path="/api/controls/health"},
    @{Name="Evidence Service"; Path="/api/evidence/health"},
    @{Name="Audit Service"; Path="/api/audits/health"}
)

foreach ($route in $kongRoutes) {
    Write-Host "`nTesting Kong route: $($route.Path)" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000$($route.Path)" -Method Get -TimeoutSec 5
        Write-Host "   Route working" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "   Route not found (404)" -ForegroundColor Red
        } else {
            Write-Host "   Route failed: $_" -ForegroundColor Red
        }
    }
}

# 4. Summary
Write-Host "`nSummary" -ForegroundColor Magenta
Write-Host "=========" -ForegroundColor Magenta
Write-Host "Working Services: $workingServices" -ForegroundColor Green
Write-Host "Failed Services: $failedServices" -ForegroundColor Red

# 5. Recommendations
Write-Host "`nRecommendations" -ForegroundColor Magenta
Write-Host "=================" -ForegroundColor Magenta

if ($failedServices -gt 0) {
    Write-Host "1. Check docker-compose logs for failed services:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs [service-name]" -ForegroundColor Gray
    
    Write-Host "`n2. Ensure all databases are created:" -ForegroundColor Yellow
    Write-Host "   .\scripts\create-all-databases.ps1" -ForegroundColor Gray
    
    Write-Host "`n3. Rebuild services with latest code:" -ForegroundColor Yellow
    Write-Host "   docker-compose build --no-cache [service-name]" -ForegroundColor Gray
    
    Write-Host "`n4. Check environment variables:" -ForegroundColor Yellow
    Write-Host "   Ensure JWT_SECRET and other required vars are set" -ForegroundColor Gray
}

Write-Host "`nDiagnostics complete!" -ForegroundColor Green