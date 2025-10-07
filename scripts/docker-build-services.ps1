# PowerShell script to build Docker images for all services
Write-Host "Building Docker Images for All Services" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# First, ensure shared packages are built
Write-Host "`n1. Building shared packages..." -ForegroundColor Yellow
& ./scripts/build-shared-packages.ps1

# Build services one by one
Write-Host "`n2. Building Auth Service..." -ForegroundColor Yellow
docker-compose build auth-service

Write-Host "`n3. Building Client Service..." -ForegroundColor Yellow
docker-compose build client-service

Write-Host "`n4. Building Control Service..." -ForegroundColor Yellow
docker-compose build control-service

Write-Host "`n5. Building Policy Service..." -ForegroundColor Yellow
docker-compose build policy-service

Write-Host "`n6. Building Evidence Service (using optimized Dockerfile)..." -ForegroundColor Yellow
docker build -t overmatch-digital-evidence-service:latest -f ./services/evidence-service/Dockerfile.optimized .

Write-Host "`n7. Building Audit Service..." -ForegroundColor Yellow
docker-compose build audit-service

Write-Host "`n8. Building Workflow Service..." -ForegroundColor Yellow
docker-compose build workflow-service

Write-Host "`n9. Building Reporting Service..." -ForegroundColor Yellow
docker-compose build reporting-service

Write-Host "`n10. Building AI Service..." -ForegroundColor Yellow
docker-compose build ai-service

Write-Host "`n11. Building Integration Service..." -ForegroundColor Yellow
docker-compose build integration-service

Write-Host "`n12. Building Notification Service..." -ForegroundColor Yellow
docker-compose build notification-service

Write-Host "`n`nAll services built!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green

# Show built images
Write-Host "`nDocker images:" -ForegroundColor Cyan
docker images | Select-String "overmatch"