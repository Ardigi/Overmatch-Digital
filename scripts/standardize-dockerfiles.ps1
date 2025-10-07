# Script to standardize all Dockerfile.monorepo files
Write-Host "Standardizing Dockerfile.monorepo files..." -ForegroundColor Cyan

$services = @(
    "audit-service",
    "control-service", 
    "workflow-service",
    "reporting-service",
    "notification-service",
    "integration-service",
    "ai-service",
    "evidence-service"
)

foreach ($service in $services) {
    $dockerfilePath = "services/$service/Dockerfile.monorepo"
    
    if (Test-Path $dockerfilePath) {
        Write-Host "Processing $service..." -ForegroundColor Yellow
        
        # Read the file
        $content = Get-Content $dockerfilePath -Raw
        
        # Fix build verification line
        $content = $content -replace 'RUN test -f dist/main\.js \|\| test -f dist/src/main\.js \|\| \(echo "Build failed: main\.js not found" && exit 1\)', 'RUN test -f dist/main.js || (echo "Build failed: dist/main.js not found" && exit 1)'
        $content = $content -replace 'RUN test -f dist/src/main\.js \|\| \(echo "Build failed: dist/src/main\.js not found" && exit 1\)', 'RUN test -f dist/main.js || (echo "Build failed: dist/main.js not found" && exit 1)'
        
        # Fix CMD line - remove fallback logic
        $content = $content -replace '# Try dist/main first, fallback to dist/src/main\.js\r?\n', ''
        $content = $content -replace "CMD sh -c 'if \[ -f dist/main\.js \]; then exec node dist/main\.js; else exec node dist/src/main\.js; fi'", 'CMD ["node", "dist/main.js"]'
        
        # Write back
        Set-Content $dockerfilePath -Value $content -NoNewline
        Write-Host "  ✅ Standardized $service" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ $service Dockerfile.monorepo not found" -ForegroundColor Yellow
    }
}

Write-Host "`nAll Dockerfiles standardized!" -ForegroundColor Green
Write-Host "Standard CMD: " -NoNewline
Write-Host 'CMD ["node", "dist/main.js"]' -ForegroundColor Cyan