# PowerShell script to run control service tests with Docker
Write-Host "Control Service Test Runner" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Step 1: Start test containers
Write-Host "`nStarting test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml up -d

# Wait for containers to be ready
Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 2: Update .env.test with correct ports
Write-Host "`nConfiguring test environment..." -ForegroundColor Yellow
$env:NODE_ENV = "test"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5433"
$env:DB_USERNAME = "soc_user"
$env:DB_PASSWORD = "soc_pass"
$env:DB_NAME = "soc_controls_test"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6380"
$env:REDIS_PASSWORD = "soc_redis_pass"

# Step 3: Run unit tests first
Write-Host "`nRunning unit tests..." -ForegroundColor Cyan
npm test

# Step 4: Run integration tests
Write-Host "`nRunning integration tests..." -ForegroundColor Cyan
npm run test:integration

# Step 5: Generate coverage report
Write-Host "`nGenerating coverage report..." -ForegroundColor Cyan
npm run test:cov

# Step 6: Cleanup
Write-Host "`nCleaning up test containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml down -v

Write-Host "`nTest run completed!" -ForegroundColor Green