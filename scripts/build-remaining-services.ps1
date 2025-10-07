# Build Remaining Services Script
# This script builds Docker images for services that don't have images yet

Write-Host "Building remaining service Docker images..." -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $projectRoot

# Check which images already exist
Write-Host "Checking existing images..." -ForegroundColor Yellow
$existingImages = docker images --format "{{.Repository}}" | Where-Object { $_ -match "soc-compliance" }

# Services to build
$allServices = @(
    "auth-service",
    "client-service",
    "policy-service",
    "control-service",
    "evidence-service",
    "workflow-service",
    "reporting-service",
    "audit-service",
    "integration-service",
    "notification-service",
    "ai-service"
)

$servicesToBuild = @()
foreach ($service in $allServices) {
    $imageName = "soc-compliance/$service"
    if ($existingImages -notcontains $imageName) {
        $servicesToBuild += $service
    } else {
        Write-Host "✅ $service already has an image" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Services to build: $($servicesToBuild -join ', ')" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($service in $servicesToBuild) {
    Write-Host "Building $service..." -ForegroundColor Yellow
    
    $servicePath = "services/$service"
    
    # Check if optimized Dockerfile exists
    $dockerfilePath = "$servicePath/Dockerfile"
    if (Test-Path "$servicePath/Dockerfile.optimized") {
        $dockerfilePath = "$servicePath/Dockerfile.optimized"
        Write-Host "  Using optimized Dockerfile" -ForegroundColor DarkGray
    }
    
    # Build the Docker image
    $imageName = "soc-compliance/${service}:latest"
    Write-Host "  Building image: $imageName" -ForegroundColor DarkGray
    
    # Build with proper context
    $buildResult = docker build -t $imageName -f $dockerfilePath $servicePath 2>&1 | Out-String
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $service built successfully!" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ❌ $service build failed!" -ForegroundColor Red
        $failCount++
        # Show error details
        Write-Host "  Error details:" -ForegroundColor Red
        $buildResult -split "`n" | Select-Object -Last 10 | ForEach-Object { 
            Write-Host "    $_" -ForegroundColor DarkRed 
        }
    }
    Write-Host ""
}

# Summary
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Build Summary:" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host ""

# List all Docker images
Write-Host "All SOC Compliance Docker images:" -ForegroundColor Cyan
docker images | Select-String "soc-compliance" | Sort-Object

Write-Host ""
Write-Host "Build process completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray

# Next steps
if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "All services built successfully! Next steps:" -ForegroundColor Green
    Write-Host "1. Update docker-compose.services.yml with correct image names" -ForegroundColor White
    Write-Host "2. Run: docker-compose -f docker-compose.yml -f docker-compose.services.yml up -d" -ForegroundColor White
    Write-Host "3. Check health endpoints for all services" -ForegroundColor White
}