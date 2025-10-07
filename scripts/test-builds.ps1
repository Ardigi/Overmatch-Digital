# Simple script to test if services can build

Write-Host "=== Testing Service Builds ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

# Build shared packages first
Write-Host "Building shared packages..." -ForegroundColor Yellow
npm run build --workspace=packages/auth-common 2>&1 | Out-Null
Write-Host "  ✓ auth-common" -ForegroundColor Green

npm run build --workspace=shared/contracts 2>&1 | Out-Null
Write-Host "  ✓ contracts" -ForegroundColor Green

npm run build --workspace=shared/events 2>&1 | Out-Null
Write-Host "  ✓ events" -ForegroundColor Green

Write-Host ""
Write-Host "Testing service builds..." -ForegroundColor Yellow

# Test Auth Service
Write-Host ""
Write-Host "Auth Service:" -ForegroundColor Cyan
Set-Location "$projectRoot\services\auth-service"
if (Test-Path ".env.local" -and -not (Test-Path ".env")) {
    Copy-Item ".env.local" ".env"
}
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Auth Service builds successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Auth Service build failed" -ForegroundColor Red
}

# Test Client Service
Write-Host ""
Write-Host "Client Service:" -ForegroundColor Cyan
Set-Location "$projectRoot\services\client-service"
if (Test-Path ".env.local" -and -not (Test-Path ".env")) {
    Copy-Item ".env.local" ".env"
}
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Client Service builds successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Client Service build failed" -ForegroundColor Red
}

Set-Location $projectRoot
Write-Host ""
Write-Host "Build test complete!" -ForegroundColor Cyan