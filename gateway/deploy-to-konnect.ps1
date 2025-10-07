# Kong Konnect Deployment Script
# Usage: .\gateway\deploy-to-konnect.ps1 -Token "YOUR_PAT_TOKEN"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

# Set environment variable for decK
$env:KONNECT_TOKEN = $Token
$env:KONNECT_ADDR = "https://us.api.konghq.com"

Write-Host "Deploying Kong configuration to Konnect..." -ForegroundColor Green

# Validate the configuration first
Write-Host "Validating configuration..." -ForegroundColor Yellow
.\tools\deck.exe validate --config gateway\kong-konnect.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "Configuration validation failed!" -ForegroundColor Red
    exit 1
}

# Deploy to Konnect
Write-Host "Deploying to Kong Konnect..." -ForegroundColor Yellow
.\tools\deck.exe sync --config gateway\kong-konnect.yaml --konnect-token $Token --konnect-addr https://us.api.konghq.com

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully deployed to Kong Konnect!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Kong Konnect Proxy URL: https://kong-5413db5061usoi9gc.kongcloud.dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test endpoints:" -ForegroundColor Yellow
    Write-Host "  Auth:    https://kong-5413db5061usoi9gc.kongcloud.dev/auth/health"
    Write-Host "  Login:   https://kong-5413db5061usoi9gc.kongcloud.dev/auth/login"
    Write-Host "  Clients: https://kong-5413db5061usoi9gc.kongcloud.dev/clients (requires JWT)"
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}