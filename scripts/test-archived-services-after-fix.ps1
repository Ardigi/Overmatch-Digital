#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Tests all archived services after manual instantiation conversion
.DESCRIPTION
    Runs tests for all archived services to verify the manual instantiation conversion worked
#>

param(
    [switch]$StopOnError = $false
)

$ErrorActionPreference = "Continue"

# Color coding
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

$services = @(
    "workflow-service",
    "reporting-service", 
    "integration-service",
    "ai-service"
)

$results = @{}
$totalTests = 0
$passedTests = 0

Write-Info "Testing archived services after manual instantiation conversion..."
Write-Info "="*60

foreach ($service in $services) {
    Write-Info "`nTesting $service..."
    
    $servicePath = Join-Path (Get-Location) "services" $service
    
    if (-not (Test-Path $servicePath)) {
        Write-Warning "Service path not found: $servicePath"
        continue
    }
    
    Push-Location $servicePath
    
    try {
        # Run the tests and capture output
        $output = npm test 2>&1 | Out-String
        
        # Extract test results
        if ($output -match "Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total") {
            $passed = [int]$Matches[1]
            $total = [int]$Matches[2]
            $totalTests += $total
            $passedTests += $passed
            
            $results[$service] = @{
                Passed = $passed
                Total = $total
                Success = ($passed -eq $total)
            }
            
            if ($passed -eq $total) {
                Write-Success "  ✓ All tests passed ($passed/$total)"
            } else {
                Write-Warning "  ⚠ Some tests failed ($passed/$total)"
                if ($StopOnError) {
                    Pop-Location
                    break
                }
            }
        } else {
            Write-Error "  ✗ Could not parse test results"
            $results[$service] = @{
                Passed = 0
                Total = 0
                Success = $false
                Error = "Could not parse results"
            }
        }
        
        # Show any specific test failures
        if ($output -match "FAIL.*\.spec\.ts") {
            Write-Warning "  Failed test files:"
            $output -split "`n" | Where-Object { $_ -match "FAIL.*\.spec\.ts" } | ForEach-Object {
                Write-Warning "    $_"
            }
        }
        
    } catch {
        Write-Error "  ✗ Error running tests: $_"
        $results[$service] = @{
            Passed = 0
            Total = 0
            Success = $false
            Error = $_.ToString()
        }
    } finally {
        Pop-Location
    }
}

# Summary
Write-Info "`n" + "="*60
Write-Info "TEST SUMMARY"
Write-Info "="*60

foreach ($service in $services) {
    if ($results.ContainsKey($service)) {
        $result = $results[$service]
        $status = if ($result.Success) { "✓" } else { "✗" }
        $color = if ($result.Success) { "Green" } else { "Red" }
        
        Write-Host "$status $service`: " -NoNewline
        Write-Host "$($result.Passed)/$($result.Total) tests passed" -ForegroundColor $color
        
        if ($result.Error) {
            Write-Warning "    Error: $($result.Error)"
        }
    }
}

Write-Info "`nTotal: $passedTests/$totalTests tests passed"

if ($passedTests -eq $totalTests) {
    Write-Success "`nAll tests passed! 🎉"
    exit 0
} else {
    Write-Warning "`nSome tests failed. Review the output above for details."
    exit 1
}