# Deploy Enhanced Services Script
# This script builds and deploys all enhanced microservices with enterprise features

param(
    [Parameter()]
    [ValidateSet("Development", "Staging", "Production")]
    [string]$Environment = "Development",
    
    [Parameter()]
    [switch]$BuildOnly,
    
    [Parameter()]
    [switch]$SkipTests,
    
    [Parameter()]
    [switch]$Force
)

Write-Host "🚀 SOC Compliance Platform - Enhanced Services Deployment" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Cyan

# Check Docker
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if infrastructure is running
$postgresRunning = docker ps --filter "name=postgres" --filter "status=running" -q
$kafkaRunning = docker ps --filter "name=kafka" --filter "status=running" -q
$redisRunning = docker ps --filter "name=redis" --filter "status=running" -q

if (-not $postgresRunning -or -not $kafkaRunning -or -not $redisRunning) {
    Write-Host "⚠️ Infrastructure services not fully running" -ForegroundColor Yellow
    Write-Host "Starting infrastructure services..." -ForegroundColor Cyan
    docker-compose up -d postgres redis kafka zookeeper mongodb
    Start-Sleep -Seconds 10
}

# Build shared packages
Write-Host ""
Write-Host "📦 Building shared packages..." -ForegroundColor Cyan
npm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build shared packages" -ForegroundColor Red
    if (-not $Force) { exit 1 }
}

# Run tests unless skipped
if (-not $SkipTests) {
    Write-Host ""
    Write-Host "🧪 Running tests..." -ForegroundColor Cyan
    
    # Test Auth Service
    Write-Host "Testing Auth Service..." -ForegroundColor Yellow
    Set-Location services/auth-service
    npm test
    if ($LASTEXITCODE -ne 0 -and -not $Force) {
        Write-Host "❌ Auth Service tests failed" -ForegroundColor Red
        Set-Location ../..
        exit 1
    }
    Set-Location ../..
    
    # Test Control Service
    Write-Host "Testing Control Service..." -ForegroundColor Yellow
    Set-Location services/control-service
    npm test
    if ($LASTEXITCODE -ne 0 -and -not $Force) {
        Write-Host "❌ Control Service tests failed" -ForegroundColor Red
        Set-Location ../..
        exit 1
    }
    Set-Location ../..
    
    # Test Policy Service
    Write-Host "Testing Policy Service..." -ForegroundColor Yellow
    Set-Location services/policy-service
    npm test
    if ($LASTEXITCODE -ne 0 -and -not $Force) {
        Write-Host "❌ Policy Service tests failed" -ForegroundColor Red
        Set-Location ../..
        exit 1
    }
    Set-Location ../..
}

# Build Docker images
Write-Host ""
Write-Host "🐳 Building Docker images..." -ForegroundColor Cyan

$services = @(
    "auth-service",
    "control-service",
    "policy-service",
    "client-service",
    "evidence-service"
)

foreach ($service in $services) {
    Write-Host "Building $service..." -ForegroundColor Yellow
    docker-compose build --no-cache $service
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️ Failed to build $service" -ForegroundColor Yellow
        if (-not $Force) { exit 1 }
    }
}

if ($BuildOnly) {
    Write-Host ""
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    exit 0
}

# Stop existing services
Write-Host ""
Write-Host "🛑 Stopping existing services..." -ForegroundColor Cyan
docker-compose down

# Start all services
Write-Host ""
Write-Host "🚀 Starting enhanced services..." -ForegroundColor Cyan
docker-compose up -d

# Wait for services to be healthy
Write-Host ""
Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Cyan
$maxWaitTime = 60
$waitTime = 0

while ($waitTime -lt $maxWaitTime) {
    $healthyServices = 0
    
    foreach ($service in $services) {
        $containerName = "overmatch-digital-$service-1"
        $health = docker inspect --format='{{.State.Health.Status}}' $containerName 2>$null
        
        if ($health -eq "healthy") {
            $healthyServices++
        }
    }
    
    if ($healthyServices -eq $services.Count) {
        Write-Host "✅ All services are healthy!" -ForegroundColor Green
        break
    }
    
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    $waitTime += 2
}

if ($waitTime -ge $maxWaitTime) {
    Write-Host ""
    Write-Host "⚠️ Some services did not become healthy in time" -ForegroundColor Yellow
}

# Verify Kafka topics
Write-Host ""
Write-Host "📊 Verifying Kafka topics..." -ForegroundColor Cyan
$topics = docker exec overmatch-digital-kafka-1 kafka-topics --list --bootstrap-server localhost:9092
$requiredTopics = @(
    "auth-events",
    "client-events",
    "policy-events",
    "control-events",
    "audit-events"
)

$missingTopics = @()
foreach ($topic in $requiredTopics) {
    if ($topics -notcontains $topic) {
        $missingTopics += $topic
    }
}

if ($missingTopics.Count -gt 0) {
    Write-Host "Creating missing Kafka topics..." -ForegroundColor Yellow
    & .\scripts\create-all-topics.ps1
}

# Run migrations
Write-Host ""
Write-Host "🗄️ Running database migrations..." -ForegroundColor Cyan
& .\scripts\run-migrations.ps1

# Display service status
Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Cyan
Write-Host ""

$statusTable = @()
foreach ($service in $services) {
    $containerName = "overmatch-digital-$service-1"
    $status = docker ps --filter "name=$containerName" --format "table {{.Status}}" | Select-Object -Last 1
    $health = docker inspect --format='{{.State.Health.Status}}' $containerName 2>$null
    
    $statusTable += [PSCustomObject]@{
        Service = $service
        Status = if ($status) { "Running" } else { "Stopped" }
        Health = if ($health) { $health } else { "N/A" }
    }
}

$statusTable | Format-Table -AutoSize

# Display service URLs
Write-Host ""
Write-Host "🌐 Service URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:        http://localhost:3000" -ForegroundColor Green
Write-Host "  Auth Service:    http://localhost:3001/api/docs" -ForegroundColor Green
Write-Host "  Client Service:  http://localhost:3002/api/docs" -ForegroundColor Green
Write-Host "  Policy Service:  http://localhost:3003/api/docs" -ForegroundColor Green
Write-Host "  Control Service: http://localhost:3004/api/docs" -ForegroundColor Green
Write-Host "  Evidence Service: http://localhost:3005/api/docs" -ForegroundColor Green
Write-Host "  Kong Gateway:    http://localhost:8000" -ForegroundColor Green
Write-Host "  Kafka UI:        http://localhost:8080" -ForegroundColor Green
Write-Host ""

# Display monitoring URLs
Write-Host "📊 Monitoring URLs:" -ForegroundColor Cyan
Write-Host "  Prometheus:      http://localhost:9090" -ForegroundColor Yellow
Write-Host "  Grafana:         http://localhost:3030" -ForegroundColor Yellow
Write-Host "  Jaeger:          http://localhost:16686" -ForegroundColor Yellow
Write-Host ""

# Display helpful commands
Write-Host "💡 Helpful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:       docker-compose logs -f [service-name]"
Write-Host "  Stop services:   docker-compose down"
Write-Host "  Health check:    .\scripts\check-local-health-fixed.ps1 -Detailed"
Write-Host "  Run tests:       .\scripts\test-all-services.ps1"
Write-Host ""

# Final status
$runningContainers = docker ps --filter "label=com.docker.compose.project=overmatch-digital" -q | Measure-Object -Line
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "$($runningContainers.Lines) containers running" -ForegroundColor Cyan
Write-Host ""

# Check for any errors in logs
Write-Host "🔍 Checking for errors in service logs..." -ForegroundColor Cyan
$hasErrors = $false

foreach ($service in $services) {
    $errors = docker-compose logs --tail=50 $service 2>&1 | Select-String -Pattern "ERROR|FATAL|Exception" -Quiet
    if ($errors) {
        Write-Host "⚠️ $service has errors in logs" -ForegroundColor Yellow
        $hasErrors = $true
    }
}

if (-not $hasErrors) {
    Write-Host "✅ No errors detected in service logs" -ForegroundColor Green
} else {
    Write-Host "⚠️ Some services have errors. Run 'docker-compose logs [service-name]' to investigate" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Enhanced SOC Compliance Platform is ready!" -ForegroundColor Green
Write-Host "   Environment: $Environment" -ForegroundColor Cyan
Write-Host "   All critical services have been enhanced with:" -ForegroundColor Cyan
Write-Host "   ✅ Kafka event streaming" -ForegroundColor Green
Write-Host "   ✅ Dead letter queues" -ForegroundColor Green
Write-Host "   ✅ Circuit breakers" -ForegroundColor Green
Write-Host "   ✅ Enterprise validation" -ForegroundColor Green
Write-Host "   ✅ Distributed tracing ready" -ForegroundColor Green
Write-Host "   ✅ Health checks" -ForegroundColor Green
Write-Host "   ✅ Production-grade Dockerfiles" -ForegroundColor Green