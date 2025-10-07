# Fix start:direct paths based on actual dist structure
Write-Host "Fixing start:direct paths for all services..." -ForegroundColor Cyan

$services = @(
    "auth-service",
    "client-service", 
    "policy-service",
    "control-service",
    "evidence-service",
    "workflow-service",
    "reporting-service",
    "audit-service",
    "integration-service",
    "notification-service",
    "ai-service"
)

$rootPath = Split-Path $PSScriptRoot -Parent

foreach ($service in $services) {
    Write-Host "`nChecking $service..." -ForegroundColor Yellow
    
    $servicePath = Join-Path $rootPath "services\$service"
    $packageJsonPath = Join-Path $servicePath "package.json"
    
    # Build the service first to ensure dist exists
    Push-Location $servicePath
    Write-Host "  Building..." -NoNewline
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
        Pop-Location
        continue
    }
    
    # Check where main.js actually is
    $mainInDist = Test-Path "dist\main.js"
    $mainInDistSrc = Test-Path "dist\src\main.js"
    
    Pop-Location
    
    if ($mainInDistSrc) {
        $correctPath = "node dist/src/main.js"
        Write-Host "  main.js found at: dist/src/main.js" -ForegroundColor Green
    } elseif ($mainInDist) {
        $correctPath = "node dist/main.js"
        Write-Host "  main.js found at: dist/main.js" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: main.js not found in dist!" -ForegroundColor Red
        continue
    }
    
    # Update package.json
    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $currentScript = $packageJson.scripts."start:direct"
    
    if ($currentScript -ne $correctPath) {
        $packageJson.scripts."start:direct" = $correctPath
        
        # Convert back to JSON
        $jsonString = $packageJson | ConvertTo-Json -Depth 10
        
        # Fix PowerShell's Unicode escaping
        $jsonString = $jsonString -replace '\\u0027', "'"
        $jsonString = $jsonString -replace '\\u003c', '<'
        $jsonString = $jsonString -replace '\\u003e', '>'
        $jsonString = $jsonString -replace '\\u0026', '&'
        
        Set-Content -Path $packageJsonPath -Value $jsonString -Encoding UTF8
        Write-Host "  Updated start:direct to: $correctPath" -ForegroundColor Yellow
    } else {
        Write-Host "  start:direct already correct" -ForegroundColor Gray
    }
}

Write-Host "`nDone! All services now have correct start:direct paths." -ForegroundColor Green