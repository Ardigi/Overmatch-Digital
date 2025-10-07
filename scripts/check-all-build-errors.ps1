$services = @(
    "control-service",
    "evidence-service", 
    "workflow-service",
    "reporting-service",
    "integration-service",
    "notification-service",
    "ai-service"
)

$rootPath = $PSScriptRoot

foreach ($service in $services) {
    Write-Host "=== $service ===" -ForegroundColor Cyan
    Push-Location "$rootPath\services\$service"
    
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed - showing first 5 errors:" -ForegroundColor Red
        $buildOutput | Select-String "error TS\d+" | Select-Object -First 5
    } else {
        Write-Host "Build succeeded" -ForegroundColor Green
    }
    
    Pop-Location
    Write-Host ""
}