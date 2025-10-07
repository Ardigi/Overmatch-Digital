# Build All Docker Images Script
# This script builds Docker images for all services

Write-Host "Building Docker images for all services..." -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $projectRoot

# List of services to build
$services = @(
    @{Name="auth-service"; Path="services/auth-service"},
    @{Name="client-service"; Path="services/client-service"},
    @{Name="policy-service"; Path="services/policy-service"},
    @{Name="control-service"; Path="services/control-service"},
    @{Name="evidence-service"; Path="services/evidence-service"},
    @{Name="workflow-service"; Path="services/workflow-service"},
    @{Name="reporting-service"; Path="services/reporting-service"},
    @{Name="audit-service"; Path="services/audit-service"},
    @{Name="integration-service"; Path="services/integration-service"},
    @{Name="notification-service"; Path="services/notification-service"},
    @{Name="ai-service"; Path="services/ai-service"}
)

$successCount = 0
$failCount = 0

foreach ($service in $services) {
    Write-Host "Building $($service.Name)..." -ForegroundColor Yellow
    
    # Check if optimized Dockerfile exists
    $dockerfilePath = "$($service.Path)/Dockerfile"
    if (Test-Path "$($service.Path)/Dockerfile.optimized") {
        $dockerfilePath = "$($service.Path)/Dockerfile.optimized"
        Write-Host "  Using optimized Dockerfile" -ForegroundColor DarkGray
    }
    
    # Build the Docker image
    $imageName = "soc-compliance/$($service.Name):latest"
    Write-Host "  Building image: $imageName" -ForegroundColor DarkGray
    
    # Run docker build
    $buildCommand = "docker build -t `"$imageName`" -f `"$dockerfilePath`" `"$($service.Path)`""
    Write-Host "  Command: $buildCommand" -ForegroundColor DarkGray
    
    $result = Invoke-Expression $buildCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $($service.Name) built successfully!" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ❌ $($service.Name) build failed!" -ForegroundColor Red
        $failCount++
        # Show last few lines of error
        $result | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
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
Write-Host "Docker images created:" -ForegroundColor Cyan
docker images | Select-String "soc-compliance"

Write-Host ""
Write-Host "Build process completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray