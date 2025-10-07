# PowerShell script to build all shared packages in correct order
Write-Host "Building Shared Packages for SOC Compliance Platform" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

$startTime = Get-Date

# Function to build a package
function Build-Package {
    param(
        [string]$PackagePath,
        [string]$PackageName
    )
    
    Write-Host "`nBuilding $PackageName..." -ForegroundColor Yellow
    
    Push-Location $PackagePath
    try {
        # Install dependencies first
        Write-Host "Installing dependencies..." -ForegroundColor Cyan
        npm install
        
        # Build the package
        Write-Host "Building..." -ForegroundColor Cyan
        npm run build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "$PackageName built successfully!" -ForegroundColor Green
        } else {
            Write-Host "$PackageName build failed!" -ForegroundColor Red
            exit 1
        }
    }
    finally {
        Pop-Location
    }
}

# Build shared packages first (no dependencies)
Write-Host "`n=== Building Shared Packages ===" -ForegroundColor Magenta

Build-Package "shared\contracts" "@soc-compliance/contracts"
Build-Package "shared\events" "@soc-compliance/events"

# Build packages that depend on shared
Write-Host "`n=== Building Package Dependencies ===" -ForegroundColor Magenta

Build-Package "packages\auth-common" "@soc-compliance/auth-common"

# Check if packages/dto exists and has package.json
if (Test-Path "packages\dto\package.json") {
    Build-Package "packages\dto" "@soc-compliance/dto (packages)"
}

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "All shared packages built successfully!" -ForegroundColor Green
Write-Host "Total time: $($duration.TotalSeconds) seconds" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run 'npm install' in the root directory to link packages" -ForegroundColor White
Write-Host "2. Build individual services as needed" -ForegroundColor White