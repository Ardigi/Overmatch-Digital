#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Verifies all archived test files exist before conversion
#>

$testFiles = @(
    # Workflow Service
    "services/workflow-service/src/workflows/workflows.service.spec.ts",
    "services/workflow-service/src/engine/workflow-engine.service.spec.ts",
    
    # Reporting Service
    "services/reporting-service/src/reports/reports.controller.spec.ts",
    "services/reporting-service/src/generator/report-generator.service.spec.ts",
    "services/reporting-service/src/storage/report-storage.service.spec.ts",
    
    # Integration Service
    "services/integration-service/src/integrations/integrations.controller.spec.ts",
    "services/integration-service/src/integrations/integration.service.spec.ts",
    "services/integration-service/src/sync/sync.controller.spec.ts",
    "services/integration-service/src/webhooks/webhooks.controller.spec.ts",
    "services/integration-service/src/webhooks/webhook.service.spec.ts",
    
    # AI Service
    "services/ai-service/src/analysis/analysis.controller.spec.ts",
    "services/ai-service/src/analysis/analysis.service.spec.ts",
    "services/ai-service/src/mappings/mappings.controller.spec.ts",
    "services/ai-service/src/mappings/mappings.service.spec.ts",
    "services/ai-service/src/predictions/predictions.controller.spec.ts",
    "services/ai-service/src/predictions/predictions.service.spec.ts",
    "services/ai-service/src/remediation/remediation.controller.spec.ts",
    "services/ai-service/src/remediation/remediation.service.spec.ts"
)

$rootPath = (Get-Location).Path
$foundCount = 0
$missingCount = 0

Write-Host "Verifying archived test files..." -ForegroundColor Cyan
Write-Host ("="*60) -ForegroundColor Cyan

foreach ($file in $testFiles) {
    $fullPath = Join-Path $rootPath $file
    
    if (Test-Path $fullPath) {
        Write-Host "✓ " -NoNewline -ForegroundColor Green
        Write-Host $file
        $foundCount++
    } else {
        Write-Host "✗ " -NoNewline -ForegroundColor Red
        Write-Host "$file (MISSING)"
        $missingCount++
    }
}

Write-Host "`n$("="*60)" -ForegroundColor Cyan
Write-Host "Found: $foundCount files" -ForegroundColor Green
if ($missingCount -gt 0) {
    Write-Host "Missing: $missingCount files" -ForegroundColor Red
    exit 1
} else {
    Write-Host "All files present! Ready for conversion." -ForegroundColor Green
    exit 0
}