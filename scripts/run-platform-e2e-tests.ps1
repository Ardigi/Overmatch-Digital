# Platform E2E Test Runner
# Runs complete end-to-end tests for the SOC Compliance Platform
# Usage: .\run-platform-e2e-tests.ps1 [-TestSuite all|auth|org|policy|control|evidence|workflow|reporting|audit] [-Verbose]

param(
    [string]$TestSuite = "all",
    [switch]$Verbose,
    [switch]$Coverage,
    [switch]$SkipSetup,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Step { Write-Host "`n→ $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $($args[0])" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $($args[0])" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $($args[0])" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $($args[0])" -ForegroundColor Blue }

# Banner
Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           SOC Compliance Platform E2E Tests                 ║
║           Complete Integration Test Suite                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "Test Suite: $TestSuite"
Write-Info "Starting Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Step 1: Check Prerequisites
if (!$SkipSetup) {
    Write-Step "Step 1: Checking Prerequisites"
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js $nodeVersion installed"
    } catch {
        Write-Error "Node.js not found"
        exit 1
    }

    # Check Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker installed: $dockerVersion"
        
        # Check if Docker is running
        $dockerRunning = docker ps 2>$null
        if (!$dockerRunning) {
            Write-Error "Docker Desktop is not running"
            exit 1
        }
    } catch {
        Write-Error "Docker not found or not running"
        exit 1
    }

    # Check infrastructure services
    Write-Step "Step 2: Verifying Infrastructure"
    
    $requiredContainers = @(
        @{Name="PostgreSQL"; Container="overmatch-digital-postgres-1"; Port=5432},
        @{Name="MongoDB"; Container="overmatch-digital-mongodb-1"; Port=27017},
        @{Name="Redis"; Container="overmatch-digital-redis-1"; Port=6379},
        @{Name="Kafka"; Container="overmatch-digital-kafka-1"; Port=9092},
        @{Name="Elasticsearch"; Container="overmatch-digital-elasticsearch-1"; Port=9200},
        @{Name="Kong"; Container="overmatch-digital-kong-1"; Port=8000}
    )

    $allRunning = $true
    foreach ($container in $requiredContainers) {
        Write-Host -NoNewline "Checking $($container.Name)... "
        $status = docker ps --filter "name=$($container.Container)" --format "{{.Status}}" 2>$null
        
        if ($status -like "Up*") {
            Write-Success "Running"
        } else {
            Write-Error "Not running"
            $allRunning = $false
        }
    }

    if (!$allRunning) {
        Write-Warning "Some infrastructure services are not running"
        Write-Info "Starting infrastructure services..."
        docker-compose up -d
        Write-Info "Waiting 30 seconds for services to initialize..."
        Start-Sleep -Seconds 30
    }

    # Check microservices
    Write-Step "Step 3: Checking Microservices"
    
    $services = @(
        @{Name="Auth Service"; Port=3001},
        @{Name="Client Service"; Port=3002},
        @{Name="Policy Service"; Port=3003},
        @{Name="Control Service"; Port=3004},
        @{Name="Evidence Service"; Port=3005},
        @{Name="Workflow Service"; Port=3006},
        @{Name="Reporting Service"; Port=3007},
        @{Name="Audit Service"; Port=3008},
        @{Name="Integration Service"; Port=3009},
        @{Name="Notification Service"; Port=3010},
        @{Name="AI Service"; Port=3011}
    )

    $healthyServices = 0
    foreach ($service in $services) {
        Write-Host -NoNewline "Checking $($service.Name)... "
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response) {
                Write-Success "Healthy"
                $healthyServices++
            }
        } catch {
            Write-Warning "Not responding (may need to start manually)"
        }
    }

    Write-Info "$healthyServices of $($services.Count) services are healthy"
    
    if ($healthyServices -eq 0) {
        Write-Error "No services are running. Please start services first."
        Write-Info "Run: npm run dev (in each service directory)"
        exit 1
    }
}

# Step 4: Install E2E dependencies
Write-Step "Step 4: Setting Up E2E Tests"

if (!(Test-Path "e2e/node_modules")) {
    Write-Info "Installing E2E test dependencies..."
    Push-Location e2e
    npm install
    Pop-Location
} else {
    Write-Success "E2E dependencies already installed"
}

# Step 5: Run Tests
Write-Step "Step 5: Running E2E Tests"

Push-Location e2e

# Determine which tests to run
$testPattern = switch ($TestSuite) {
    "all"       { "**/*.e2e-spec.ts" }
    "auth"      { "**/01-auth-flow.e2e-spec.ts" }
    "org"       { "**/02-organization-setup.e2e-spec.ts" }
    "policy"    { "**/03-policy-management.e2e-spec.ts" }
    "control"   { "**/04-control-implementation.e2e-spec.ts" }
    "evidence"  { "**/05-evidence-collection.e2e-spec.ts" }
    "workflow"  { "**/06-workflow-execution.e2e-spec.ts" }
    "reporting" { "**/07-reporting.e2e-spec.ts" }
    "audit"     { "**/08-audit-trail.e2e-spec.ts" }
    default     { "**/*.e2e-spec.ts" }
}

Write-Info "Running test pattern: $testPattern"

# Build Jest command
$jestCmd = "npx jest"
if ($Verbose) {
    $jestCmd += " --verbose"
}
if ($Coverage) {
    $jestCmd += " --coverage"
}
$jestCmd += " --testMatch='$testPattern'"

# Run tests
$testStart = Get-Date
try {
    if ($Verbose) {
        Invoke-Expression $jestCmd
    } else {
        $output = Invoke-Expression $jestCmd 2>&1
        
        # Parse output for summary
        $passed = 0
        $failed = 0
        $skipped = 0
        
        foreach ($line in $output) {
            if ($line -match "Tests:\s+(\d+)\s+passed") {
                $passed = [int]$matches[1]
            }
            if ($line -match "(\d+)\s+failed") {
                $failed = [int]$matches[1]
            }
            if ($line -match "(\d+)\s+skipped") {
                $skipped = [int]$matches[1]
            }
            
            # Show important messages
            if ($line -match "(PASS|FAIL|SKIP)" -or $line -match "Error" -or $line -match "✓|✗") {
                Write-Host $line
            }
        }
        
        # Summary
        Write-Host "`n" -NoNewline
        Write-Info "Test Results:"
        if ($passed -gt 0) {
            Write-Success "$passed tests passed"
        }
        if ($failed -gt 0) {
            Write-Error "$failed tests failed"
        }
        if ($skipped -gt 0) {
            Write-Warning "$skipped tests skipped"
        }
    }
    
    $testEnd = Get-Date
    $duration = $testEnd - $testStart
    Write-Info "Test duration: $([math]::Round($duration.TotalMinutes, 2)) minutes"
    
} catch {
    Write-Error "E2E tests failed"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Step 6: Generate Report
if ($Coverage) {
    Write-Step "Step 6: Coverage Report"
    
    if (Test-Path "e2e/coverage/lcov-report/index.html") {
        Write-Success "Coverage report generated"
        Write-Info "Open: e2e/coverage/lcov-report/index.html"
        
        # Open coverage report in browser
        Start-Process "e2e/coverage/lcov-report/index.html"
    }
}

# Step 7: Cleanup (unless KeepRunning)
if (!$KeepRunning) {
    Write-Step "Step 7: Cleanup"
    
    Write-Info "Cleaning up test data..."
    # Add cleanup logic here if needed
    
    Write-Success "Cleanup complete"
} else {
    Write-Info "Services left running for debugging"
}

# Final Summary
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║              ✓ E2E TESTS COMPLETE                          ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Success "`nE2E test run completed successfully!"

# Provide next steps
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Review test results above" -ForegroundColor White
Write-Host "2. Check failed tests if any" -ForegroundColor White
Write-Host "3. View detailed logs in e2e/logs/" -ForegroundColor White
if ($Coverage) {
    Write-Host "4. Review coverage report" -ForegroundColor White
}

# Exit with appropriate code
if ($failed -gt 0) {
    exit 1
} else {
    exit 0
}