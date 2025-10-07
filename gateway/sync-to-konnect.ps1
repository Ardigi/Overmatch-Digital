# Load Kong Konnect token from .env file and deploy configuration

# Read the .env file and extract KONNECT_TOKEN
$envContent = Get-Content .env
$tokenLine = $envContent | Where-Object { $_ -match "^KONNECT_TOKEN" }

if (-not $tokenLine) {
    Write-Host "ERROR: KONNECT_TOKEN not found in .env file!" -ForegroundColor Red
    exit 1
}

# Extract the token value (handle spaces around =)
$token = ($tokenLine -split '=', 2)[1].Trim()

if (-not $token) {
    Write-Host "ERROR: KONNECT_TOKEN is empty!" -ForegroundColor Red
    exit 1
}

Write-Host "Found KONNECT_TOKEN in .env file" -ForegroundColor Green
Write-Host "Deploying to Kong Konnect..." -ForegroundColor Yellow

# Deploy the minimal configuration to compliance-platform control plane
.\tools\deck.exe gateway sync gateway\kong-konnect-minimal.yml `
    --konnect-token $token `
    --konnect-addr https://us.api.konghq.com `
    --konnect-control-plane-name "compliance-platform"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully deployed to Kong Konnect!" -ForegroundColor Green
    Write-Host "`nYour endpoints are now available at:" -ForegroundColor Cyan
    Write-Host "  Test: https://kong-5413db5061usoi9gc.kongcloud.dev/test" -ForegroundColor White
    Write-Host "`nTest with:" -ForegroundColor Yellow
    Write-Host "  curl https://kong-5413db5061usoi9gc.kongcloud.dev/test" -ForegroundColor White
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Please check your KONNECT_TOKEN in the .env file" -ForegroundColor Yellow
}