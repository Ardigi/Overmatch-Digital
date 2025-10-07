# PowerShell script to test service build without infrastructure
Write-Host "=== Service Build Test ===" -ForegroundColor Cyan
Write-Host "Testing if services can build successfully" -ForegroundColor White
Write-Host ""

# Function to test a service build
function Test-ServiceBuild {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [int]$ExpectedPort
    )
    
    Write-Host "Testing $ServiceName..." -ForegroundColor Yellow
    
    if (-not (Test-Path $ServicePath)) {
        Write-Host "✗ Service directory not found: $ServicePath" -ForegroundColor Red
        return $false
    }
    
    # Navigate to service directory
    Push-Location $ServicePath
    
    try {
        # Check for package.json
        if (-not (Test-Path "package.json")) {
            Write-Host "✗ No package.json found" -ForegroundColor Red
            return $false
        }
        
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "  Installing dependencies..." -ForegroundColor Gray
            $output = npm install 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
                Write-Host $output -ForegroundColor Gray
                return $false
            }
        }
        
        # Check for .env file
        if (-not (Test-Path ".env") -and (Test-Path ".env.local")) {
            Write-Host "  Creating .env from .env.local..." -ForegroundColor Gray
            Copy-Item ".env.local" ".env"
        }
        
        # Try to build the service
        Write-Host "  Building..." -ForegroundColor Gray
        $output = npm run build 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $ServiceName builds successfully" -ForegroundColor Green
            
            # Check if start:dev script exists
            $packageJson = Get-Content package.json | ConvertFrom-Json
            if ($packageJson.scripts.'start:dev') {
                Write-Host "  start:dev script available (port $ExpectedPort)" -ForegroundColor Gray
            }
            
            return $true
        } else {
            Write-Host "✗ $ServiceName build failed" -ForegroundColor Red
            Write-Host $output -ForegroundColor Gray
            return $false
        }
    }
    finally {
        Pop-Location
    }
}

# Get project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

# First, build shared packages
Write-Host "Building shared packages..." -ForegroundColor Cyan
Push-Location $projectRoot

Write-Host "  Building auth-common..." -ForegroundColor Gray
npm run build --workspace=packages/auth-common 2>&1 | Out-Null

Write-Host "  Building contracts..." -ForegroundColor Gray
npm run build --workspace=shared/contracts 2>&1 | Out-Null

Write-Host "  Building events..." -ForegroundColor Gray
npm run build --workspace=shared/events 2>&1 | Out-Null

Pop-Location

Write-Host ""
Write-Host "Testing services..." -ForegroundColor Cyan
Write-Host ""

# Test results
$results = @{}

# Test Auth Service
$results["Auth Service"] = Test-ServiceBuild -ServiceName "Auth Service" `
    -ServicePath "$projectRoot\services\auth-service" `
    -ExpectedPort 3001

# Test Client Service  
$results["Client Service"] = Test-ServiceBuild -ServiceName "Client Service" `
    -ServicePath "$projectRoot\services\client-service" `
    -ExpectedPort 3002

# Test Policy Service
$results["Policy Service"] = Test-ServiceBuild -ServiceName "Policy Service" `
    -ServicePath "$projectRoot\services\policy-service" `
    -ExpectedPort 3003

# Test Control Service
$results["Control Service"] = Test-ServiceBuild -ServiceName "Control Service" `
    -ServicePath "$projectRoot\services\control-service" `
    -ExpectedPort 3004

Write-Host ""
Write-Host "=== Build Test Summary ===" -ForegroundColor Cyan

$successful = 0
$failed = 0

foreach ($service in $results.Keys) {
    if ($results[$service]) {
        Write-Host "✓ $service" -ForegroundColor Green
        $successful++
    } else {
        Write-Host "✗ $service" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Successful: $successful" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($successful -gt 0) {
    Write-Host ""
    Write-Host "Services are ready to start once PostgreSQL and Redis are available." -ForegroundColor Yellow
    Write-Host "Use .\scripts\start-local.ps1 to start everything." -ForegroundColor Cyan
}