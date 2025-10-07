# Sync Kong Konnect configuration to local Kong Gateway
# This allows us to use Konnect's enterprise features with local development

param(
    [Parameter(Mandatory=$false)]
    [switch]$Pull,
    [Parameter(Mandatory=$false)]
    [switch]$Push
)

# Read KONNECT_TOKEN from .env
$envContent = Get-Content .env
$tokenLine = $envContent | Where-Object { $_ -match "^KONNECT_TOKEN" }
$token = ($tokenLine -split '=', 2)[1].Trim()

if (-not $token) {
    Write-Host "ERROR: KONNECT_TOKEN not found in .env file!" -ForegroundColor Red
    exit 1
}

if ($Pull) {
    Write-Host "Pulling configuration from Kong Konnect..." -ForegroundColor Yellow
    
    # Export from Konnect
    .\tools\deck.exe gateway dump `
        --output-file gateway\kong-from-konnect.yml `
        --konnect-token $token `
        --konnect-addr https://us.api.konghq.com `
        --konnect-control-plane-name "compliance-platform"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully exported from Konnect!" -ForegroundColor Green
        Write-Host "Configuration saved to: gateway\kong-from-konnect.yml" -ForegroundColor Cyan
        
        # Apply to local Kong
        Write-Host "`nApplying to local Kong Gateway..." -ForegroundColor Yellow
        .\tools\deck.exe gateway sync gateway\kong-from-konnect.yml `
            --kong-addr http://localhost:8001
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully synced to local Kong!" -ForegroundColor Green
        }
    }
} 
elseif ($Push) {
    Write-Host "Pushing local configuration to Kong Konnect..." -ForegroundColor Yellow
    
    # Export from local Kong
    .\tools\deck.exe gateway dump `
        --output-file gateway\kong-local-export.yml `
        --kong-addr http://localhost:8001
    
    if ($LASTEXITCODE -eq 0) {
        # Push to Konnect
        .\tools\deck.exe gateway sync gateway\kong-local-export.yml `
            --konnect-token $token `
            --konnect-addr https://us.api.konghq.com `
            --konnect-control-plane-name "compliance-platform"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully pushed to Konnect!" -ForegroundColor Green
        }
    }
}
else {
    Write-Host "Kong Konnect <-> Local Kong Sync Tool" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\gateway\sync-konnect-to-local.ps1 -Pull" -ForegroundColor White
    Write-Host "    Pull config from Konnect and apply to local Kong" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\gateway\sync-konnect-to-local.ps1 -Push" -ForegroundColor White
    Write-Host "    Push local Kong config to Konnect" -ForegroundColor Gray
    Write-Host ""
    Write-Host "This allows you to:" -ForegroundColor Yellow
    Write-Host "  - Configure in Konnect's UI with enterprise features" -ForegroundColor Gray
    Write-Host "  - Pull that config to your local Kong for testing" -ForegroundColor Gray
    Write-Host "  - Use OIDC plugin and other enterprise features locally!" -ForegroundColor Gray
}