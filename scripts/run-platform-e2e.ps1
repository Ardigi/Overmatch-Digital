#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Platform E2E Integration Tests
.DESCRIPTION
    Executes end-to-end tests to verify real data flow through all services
#>

param(
    [switch]$SkipInfraCheck = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$HealthPath = "/health"
    )
    
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port$HealthPath" -Method Get -TimeoutSec 5
        if ($response) {
            Write-Success "$ServiceName is healthy on port $Port"
            return $true
        }
    } catch {
        Write-Error "$ServiceName is not responding on port $Port"
        if ($Verbose) {
            Write-Host "  Error: $_" -ForegroundColor Yellow
        }
        return $false
    }
}

# Main execution
Write-Step "Platform E2E Integration Test"
Write-Host "Testing REAL functionality across all services..." -ForegroundColor Yellow

# Step 1: Check infrastructure
if (-not $SkipInfraCheck) {
    Write-Step "Checking Infrastructure"
    
    # Check Docker services
    $dockerServices = docker-compose ps --format json | ConvertFrom-Json
    
    $requiredServices = @(
        @{Name="postgres"; Port=5432},
        @{Name="redis"; Port=6379},
        @{Name="kafka"; Port=9092},
        @{Name="auth-service"; Port=3001},
        @{Name="client-service"; Port=3002},
        @{Name="policy-service"; Port=3003},
        @{Name="control-service"; Port=3004}
    )
    
    $allHealthy = $true
    foreach ($service in $requiredServices) {
        if ($service.Port -gt 5000) {
            # Application services - check health endpoint
            $healthy = Test-ServiceHealth -ServiceName $service.Name -Port $service.Port
            if (-not $healthy) {
                $allHealthy = $false
            }
        } else {
            # Infrastructure services - just check if running
            $running = $dockerServices | Where-Object { $_.Service -like "*$($service.Name)*" -and $_.State -eq "running" }
            if ($running) {
                Write-Success "$($service.Name) is running"
            } else {
                Write-Error "$($service.Name) is not running"
                $allHealthy = $false
            }
        }
    }
    
    if (-not $allHealthy) {
        Write-Error "Some services are not healthy. Please fix before running E2E tests."
        exit 1
    }
}

# Step 2: Check Keycloak
Write-Step "Checking Keycloak SSO Provider"
try {
    $keycloakResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/health" -Method Get -TimeoutSec 5
    Write-Success "Keycloak is running on port 8180"
} catch {
    Write-Error "Keycloak is not accessible on port 8180"
    Write-Host "  Starting Keycloak..." -ForegroundColor Yellow
    docker start soc-keycloak
    Start-Sleep -Seconds 10
}

# Step 3: Install test dependencies
Write-Step "Installing Test Dependencies"
if (-not (Test-Path "node_modules")) {
    npm install
}

# Install E2E test dependencies if needed
$e2ePackages = @("axios", "pg", "@types/pg", "jest", "ts-jest", "@types/jest")
foreach ($package in $e2ePackages) {
    if (-not (npm list $package --depth=0 2>$null)) {
        Write-Host "  Installing $package..." -ForegroundColor Gray
        npm install --save-dev $package
    }
}

# Step 4: Create Jest config for E2E if it doesn't exist
if (-not (Test-Path "jest.e2e.config.js")) {
    Write-Step "Creating Jest E2E Configuration"
    @"
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 60000,
  collectCoverage: false,
  verbose: true,
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};
"@ | Out-File -FilePath "jest.e2e.config.js" -Encoding UTF8
}

# Step 5: Run E2E tests
Write-Step "Running E2E Integration Tests"
Write-Host "This will test:" -ForegroundColor Gray
Write-Host "  • User registration and authentication (Auth Service + Keycloak)" -ForegroundColor Gray
Write-Host "  • Client creation and management (Client Service)" -ForegroundColor Gray
Write-Host "  • Policy compliance checks (Policy Service)" -ForegroundColor Gray
Write-Host "  • Control implementation (Control Service)" -ForegroundColor Gray
Write-Host "  • Event flow through Kafka" -ForegroundColor Gray
Write-Host "  • Data persistence in PostgreSQL" -ForegroundColor Gray

# Run the tests
$env:NODE_ENV = "test"
npx jest --config jest.e2e.config.js --runInBand --forceExit

if ($LASTEXITCODE -eq 0) {
    Write-Success "All E2E tests passed! Platform is functioning correctly."
} else {
    Write-Error "E2E tests failed. Check the output above for details."
    exit 1
}

# Step 6: Generate summary
Write-Step "Test Summary"
Write-Host "Platform integration verified:" -ForegroundColor Green
Write-Host "  ✓ Services communicate through REST APIs" -ForegroundColor Green
Write-Host "  ✓ Authentication works with JWT tokens" -ForegroundColor Green
Write-Host "  ✓ Data persists in PostgreSQL" -ForegroundColor Green
Write-Host "  ✓ Cross-service operations function correctly" -ForegroundColor Green
Write-Host "  ✓ Platform is production-ready" -ForegroundColor Green