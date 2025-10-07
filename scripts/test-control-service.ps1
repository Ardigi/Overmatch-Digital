# PowerShell script to test Control Service locally
Write-Host "Testing Control Service Startup" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Set environment variables
$env:NODE_ENV = "development"
$env:PORT = "3004"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_USERNAME = "soc_user"
$env:DB_PASSWORD = "soc_password"
$env:DB_NAME = "soc_controls"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
$env:REDIS_PASSWORD = "soc_redis_pass"
$env:JWT_SECRET = "your-jwt-secret"

Write-Host "`nEnvironment variables set:" -ForegroundColor Yellow
Write-Host "DB_HOST: $env:DB_HOST" -ForegroundColor Cyan
Write-Host "DB_NAME: $env:DB_NAME" -ForegroundColor Cyan
Write-Host "REDIS_HOST: $env:REDIS_HOST" -ForegroundColor Cyan
Write-Host "PORT: $env:PORT" -ForegroundColor Cyan

# Navigate to control service
Push-Location services\control-service

try {
    Write-Host "`nStarting Control Service..." -ForegroundColor Yellow
    npm run start:dev
}
finally {
    Pop-Location
}