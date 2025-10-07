# PowerShell script to build Evidence Service with extended timeout

Write-Host "Building Evidence Service with extended timeout" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Set environment variable for Docker build timeout
$env:DOCKER_BUILDKIT = "1"
$env:BUILDKIT_PROGRESS = "plain"

Write-Host "`n1. Building Evidence Service..." -ForegroundColor Yellow
Write-Host "This may take several minutes due to large dependencies (AWS SDK, Puppeteer, etc.)" -ForegroundColor Cyan

# Build with extended timeout and no cache to ensure fresh build
try {
    # Use docker build directly with extended timeout
    docker build `
        --no-cache `
        --progress=plain `
        -t overmatch-digital-evidence-service:latest `
        -f ./services/evidence-service/Dockerfile.optimized `
        .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nBuild successful!" -ForegroundColor Green
        
        # Tag the image
        docker tag overmatch-digital-evidence-service:latest overmatch-digital-evidence-service:latest
        
        Write-Host "`n2. Image created:" -ForegroundColor Yellow
        docker images | Select-String "evidence-service"
    } else {
        Write-Host "`nBuild failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "`nBuild error: $_" -ForegroundColor Red
}

Write-Host "`nBuild process completed!" -ForegroundColor Green