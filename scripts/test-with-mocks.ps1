# Test services with mock infrastructure
Write-Host "=== Testing Services with Mock Infrastructure ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Create mock environment files
Write-Host "Creating mock environment configuration..." -ForegroundColor Yellow

# Auth Service mock env
$authEnvContent = @"
NODE_ENV=development
PORT=3001

# Mock database (service will fail but we can test startup)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=soc_auth

# Mock Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=test

# Mock Kafka
KAFKA_BROKERS=localhost:9092

# JWT
JWT_SECRET=test-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=test-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Mock email
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_FROM=test@test.com

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
"@

# Save mock env for Auth Service
$authEnvPath = "$projectRoot\services\auth-service\.env"
$authEnvContent | Out-File -FilePath $authEnvPath -Encoding UTF8
Write-Host "✓ Created Auth Service .env" -ForegroundColor Green

# Client Service mock env
$clientEnvContent = @"
NODE_ENV=development
PORT=3002

# Mock database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=soc_clients

# Mock Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=test

# Mock Kafka
KAFKA_BROKERS=localhost:9092

# Auth Service
AUTH_SERVICE_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000
"@

# Save mock env for Client Service
$clientEnvPath = "$projectRoot\services\client-service\.env"
$clientEnvContent | Out-File -FilePath $clientEnvPath -Encoding UTF8
Write-Host "✓ Created Client Service .env" -ForegroundColor Green

Write-Host ""
Write-Host "Testing service startup (will fail to connect to DB/Redis but should start)..." -ForegroundColor Yellow
Write-Host ""

# Test Auth Service
Write-Host "Testing Auth Service startup..." -ForegroundColor Cyan
Set-Location "$projectRoot\services\auth-service"

$authJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run start:dev 2>&1
} -ArgumentList (Get-Location).Path

# Wait a bit and check output
Start-Sleep -Seconds 10
$authOutput = Receive-Job -Job $authJob
Stop-Job -Job $authJob
Remove-Job -Job $authJob

Write-Host "Auth Service output:" -ForegroundColor Gray
Write-Host $authOutput -ForegroundColor Gray

if ($authOutput -match "Nest application successfully started" -or $authOutput -match "Auth Service is running") {
    Write-Host "✓ Auth Service can start (but may have connection errors)" -ForegroundColor Green
} else {
    Write-Host "✗ Auth Service failed to start" -ForegroundColor Red
}

# Test Client Service
Write-Host ""
Write-Host "Testing Client Service startup..." -ForegroundColor Cyan
Set-Location "$projectRoot\services\client-service"

$clientJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run start:dev 2>&1
} -ArgumentList (Get-Location).Path

# Wait a bit and check output
Start-Sleep -Seconds 10
$clientOutput = Receive-Job -Job $clientJob
Stop-Job -Job $clientJob
Remove-Job -Job $clientJob

Write-Host "Client Service output:" -ForegroundColor Gray
Write-Host $clientOutput -ForegroundColor Gray

if ($clientOutput -match "Nest application successfully started" -or $clientOutput -match "Client Service is running") {
    Write-Host "✓ Client Service can start (but may have connection errors)" -ForegroundColor Green
} else {
    Write-Host "✗ Client Service failed to start" -ForegroundColor Red
}

Set-Location $projectRoot

Write-Host ""
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Services are built and can attempt to start." -ForegroundColor Yellow
Write-Host "They will fail to connect to PostgreSQL/Redis until those are installed." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait for PostgreSQL installation to complete" -ForegroundColor White
Write-Host "2. Install Redis (optional for basic testing)" -ForegroundColor White
Write-Host "3. Run .\scripts\setup-local-databases.ps1" -ForegroundColor White
Write-Host "4. Run .\scripts\start-local.ps1" -ForegroundColor White