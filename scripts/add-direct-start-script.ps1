# Add start:direct script to all services
Write-Host "Adding start:direct script to all services..." -ForegroundColor Cyan

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
    Write-Host "Updating $service..." -ForegroundColor Yellow
    
    $packageJsonPath = Join-Path $rootPath "services\$service\package.json"
    
    if (Test-Path $packageJsonPath) {
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        
        # Add start:direct script
        if (-not $packageJson.scripts."start:direct") {
            $packageJson.scripts | Add-Member -MemberType NoteProperty -Name "start:direct" -Value "node dist/src/main.js" -Force
            
            # Convert back to JSON with proper formatting
            $jsonString = $packageJson | ConvertTo-Json -Depth 10
            
            # Fix PowerShell's Unicode escaping
            $jsonString = $jsonString -replace '\\u0027', "'"
            $jsonString = $jsonString -replace '\\u003c', '<'
            $jsonString = $jsonString -replace '\\u003e', '>'
            $jsonString = $jsonString -replace '\\u0026', '&'
            
            Set-Content -Path $packageJsonPath -Value $jsonString -Encoding UTF8
            Write-Host "  Added start:direct script" -ForegroundColor Green
        } else {
            Write-Host "  start:direct script already exists" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Package.json not found!" -ForegroundColor Red
    }
}

Write-Host "`nDone! All services now have start:direct script." -ForegroundColor Green