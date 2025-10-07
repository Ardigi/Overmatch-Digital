# Script Consolidation Utility
# Consolidates redundant PowerShell scripts and establishes naming standards
# Usage: .\consolidate-scripts.ps1 [-DryRun] [-Backup] [-Force]

param(
    [switch]$DryRun,
    [switch]$Backup,
    [switch]$Force,
    [switch]$Verbose
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
║           PowerShell Script Consolidation Utility           ║
║           Cleaning and Organizing Scripts Directory         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

if ($DryRun) {
    Write-Warning "DRY RUN MODE - No changes will be made"
}

# Script categories and consolidation rules
$consolidationRules = @{
    # Health check scripts -> single unified script
    "HealthCheck" = @{
        Pattern = "*health*", "*diagnose*"
        Target = "check-platform-health.ps1"
        Keep = @("check-all-services-health.ps1")
        Archive = @(
            "check-health-simple.ps1",
            "check-local-health.ps1",
            "check-local-health-fixed.ps1",
            "diagnose-services.ps1",
            "check-all-build-errors.ps1"
        )
    }
    
    # Service starting scripts -> two main scripts
    "ServiceStart" = @{
        Pattern = "start-*"
        Target = "start-platform.ps1"
        Keep = @("start-docker-services.ps1", "setup-dev-environment.ps1")
        Archive = @(
            "start-all-services.ps1",
            "start-local.ps1",
            "start-platform.ps1",
            "start-services-direct.ps1",
            "start-services-production-ready.ps1",
            "start-services-simple.ps1",
            "start-services-simple-fixed.ps1"
        )
    }
    
    # Test scripts -> unified test runner
    "Testing" = @{
        Pattern = "test-*"
        Target = "test-service.ps1"
        Keep = @("test-all-services.ps1", "run-integration-tests.ps1", "run-e2e-tests.ps1", "run-platform-e2e-tests.ps1")
        Archive = @(
            "test-auth.ps1",
            "test-auth-service.ps1",
            "test-client-service.ps1",
            "test-control-service.ps1",
            "test-control-service-db.ps1",
            "test-critical-services.ps1",
            "test-policy-service.ps1",
            "test-services.ps1",
            "test-service-startup.ps1",
            "test-single-service.ps1"
        )
    }
    
    # Build scripts
    "Build" = @{
        Pattern = "build-*"
        Keep = @("build-shared-packages.ps1", "build-all-docker-images.ps1")
        Archive = @(
            "build-evidence-service.ps1",
            "build-remaining-services.ps1",
            "docker-build-services.ps1"
        )
    }
    
    # Fix scripts (one-time fixes)
    "Fixes" = @{
        Pattern = "fix-*"
        Keep = @()
        Archive = @(
            "fix-archived-tests-manual-instantiation.ps1",
            "fix-start-direct-paths.ps1"
        )
    }
}

# Step 1: Analyze current scripts
Write-Step "Step 1: Analyzing Current Scripts"

$scriptPath = Get-Location
$allScripts = Get-ChildItem -Path $scriptPath -Filter "*.ps1" -File
Write-Info "Found $($allScripts.Count) PowerShell scripts"

# Categorize scripts
$toKeep = @()
$toArchive = @()
$toConsolidate = @()
$uncategorized = @()

foreach ($script in $allScripts) {
    $categorized = $false
    
    foreach ($category in $consolidationRules.Keys) {
        $rule = $consolidationRules[$category]
        
        if ($rule.Keep -contains $script.Name) {
            $toKeep += $script
            $categorized = $true
            break
        }
        elseif ($rule.Archive -contains $script.Name) {
            $toArchive += $script
            $categorized = $true
            break
        }
    }
    
    if (!$categorized) {
        # Check if it's a new consolidated script
        if ($script.Name -eq "consolidate-scripts.ps1" -or 
            $script.Name -eq "check-all-services-health.ps1" -or
            $script.Name -eq "setup-dev-environment.ps1" -or
            $script.Name -eq "run-platform-e2e-tests.ps1") {
            $toKeep += $script
        }
        else {
            $uncategorized += $script
        }
    }
}

# Display analysis
Write-Info "`nScript Analysis:"
Write-Success "Scripts to Keep: $($toKeep.Count)"
Write-Warning "Scripts to Archive: $($toArchive.Count)"
Write-Info "Uncategorized: $($uncategorized.Count)"

if ($Verbose) {
    Write-Host "`nScripts to Keep:" -ForegroundColor Green
    $toKeep | ForEach-Object { Write-Host "  - $($_.Name)" }
    
    Write-Host "`nScripts to Archive:" -ForegroundColor Yellow
    $toArchive | ForEach-Object { Write-Host "  - $($_.Name)" }
    
    if ($uncategorized.Count -gt 0) {
        Write-Host "`nUncategorized Scripts:" -ForegroundColor Cyan
        $uncategorized | ForEach-Object { Write-Host "  - $($_.Name)" }
    }
}

# Step 2: Create backup if requested
if ($Backup -and !$DryRun) {
    Write-Step "Step 2: Creating Backup"
    
    $backupDir = Join-Path $scriptPath "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    Write-Info "Backing up all scripts to: $backupDir"
    foreach ($script in $allScripts) {
        Copy-Item -Path $script.FullName -Destination $backupDir
    }
    Write-Success "Backup complete"
} else {
    Write-Step "Step 2: Skipping Backup"
}

# Step 3: Create archive directory
Write-Step "Step 3: Setting Up Archive"

$archiveDir = Join-Path $scriptPath "archive"
if (!$DryRun) {
    if (!(Test-Path $archiveDir)) {
        New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
        Write-Success "Created archive directory"
    } else {
        Write-Info "Archive directory already exists"
    }
} else {
    Write-Info "Would create archive directory: $archiveDir"
}

# Step 4: Move scripts to archive
Write-Step "Step 4: Archiving Redundant Scripts"

foreach ($script in $toArchive) {
    $destination = Join-Path $archiveDir $script.Name
    
    if ($DryRun) {
        Write-Info "Would move: $($script.Name) → archive/"
    } else {
        try {
            Move-Item -Path $script.FullName -Destination $destination -Force
            Write-Success "Archived: $($script.Name)"
        } catch {
            Write-Error "Failed to archive: $($script.Name) - $_"
        }
    }
}

# Step 5: Create consolidated scripts
Write-Step "Step 5: Creating Consolidated Scripts"

# Create unified test script
$unifiedTestScript = @'
# Unified Service Test Runner
# Replaces multiple individual test scripts
# Usage: .\test-service.ps1 -Service [name|all] [-Coverage] [-Watch]

param(
    [string]$Service = "all",
    [switch]$Coverage,
    [switch]$Watch,
    [switch]$Debug,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Map service names to paths
$services = @{
    "auth" = "services/auth-service"
    "client" = "services/client-service"
    "policy" = "services/policy-service"
    "control" = "services/control-service"
    "evidence" = "services/evidence-service"
    "workflow" = "services/workflow-service"
    "reporting" = "services/reporting-service"
    "audit" = "services/audit-service"
    "integration" = "services/integration-service"
    "notification" = "services/notification-service"
    "ai" = "services/ai-service"
}

if ($Service -eq "all") {
    Write-Host "Running tests for all services..." -ForegroundColor Cyan
    foreach ($svc in $services.Keys) {
        Write-Host "`nTesting $svc service..." -ForegroundColor Yellow
        Push-Location $services[$svc]
        npm test
        Pop-Location
    }
} else {
    if ($services.ContainsKey($Service)) {
        Write-Host "Testing $Service service..." -ForegroundColor Cyan
        Push-Location $services[$Service]
        
        $cmd = "npm test"
        if ($Coverage) { $cmd += " -- --coverage" }
        if ($Watch) { $cmd += " -- --watch" }
        if ($Debug) { $cmd = "npm run test:debug" }
        
        Invoke-Expression $cmd
        Pop-Location
    } else {
        Write-Host "Unknown service: $Service" -ForegroundColor Red
        Write-Host "Available services: $($services.Keys -join ', ')"
        exit 1
    }
}
'@

if (!$DryRun) {
    $unifiedTestScript | Out-File -FilePath (Join-Path $scriptPath "test-service.ps1") -Encoding UTF8
    Write-Success "Created unified test-service.ps1"
} else {
    Write-Info "Would create: test-service.ps1"
}

# Create unified start script
$unifiedStartScript = @'
# Unified Platform Starter
# Replaces multiple start scripts
# Usage: .\start-platform.ps1 -Mode [docker|local|hybrid] [-Quick]

param(
    [ValidateSet("docker", "local", "hybrid")]
    [string]$Mode = "docker",
    [switch]$Quick,
    [switch]$Production,
    [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

Write-Host "Starting SOC Platform in $Mode mode..." -ForegroundColor Cyan

switch ($Mode) {
    "docker" {
        Write-Host "Starting Docker infrastructure..." -ForegroundColor Yellow
        docker-compose up -d
        
        if (!$SkipChecks) {
            Start-Sleep -Seconds 30
            .\check-all-services-health.ps1
        }
    }
    
    "local" {
        Write-Host "Starting services locally..." -ForegroundColor Yellow
        
        # Start infrastructure
        docker-compose up -d postgres redis kafka mongodb elasticsearch
        
        # Start each service
        $services = @(
            "auth-service", "client-service", "policy-service",
            "control-service", "evidence-service"
        )
        
        foreach ($service in $services) {
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd services/$service; npm run start:dev"
        }
    }
    
    "hybrid" {
        Write-Host "Starting in hybrid mode..." -ForegroundColor Yellow
        # Infrastructure in Docker, services locally
        docker-compose up -d postgres redis kafka mongodb elasticsearch kong
        
        Write-Host "Start services manually with: npm run start:dev"
    }
}

Write-Host "`nPlatform started successfully!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Gateway: http://localhost:8000" -ForegroundColor Cyan
'@

if (!$DryRun) {
    $unifiedStartScript | Out-File -FilePath (Join-Path $scriptPath "start-platform.ps1") -Encoding UTF8
    Write-Success "Created unified start-platform.ps1"
} else {
    Write-Info "Would create: start-platform.ps1"
}

# Step 6: Update documentation references
Write-Step "Step 6: Updating Documentation"

$docsToUpdate = @(
    "../CLAUDE.md",
    "../README.md",
    "../docs/DEVELOPMENT.md",
    "../docs/TROUBLESHOOTING.md"
)

foreach ($doc in $docsToUpdate) {
    $docPath = Join-Path $scriptPath $doc
    if (Test-Path $docPath) {
        if (!$DryRun) {
            $content = Get-Content $docPath -Raw
            
            # Update script references
            $updates = @{
                "check-local-health.ps1" = "check-all-services-health.ps1"
                "check-local-health-fixed.ps1" = "check-all-services-health.ps1"
                "start-services-simple.ps1" = "start-platform.ps1"
                "test-single-service.ps1" = "test-service.ps1"
            }
            
            foreach ($old in $updates.Keys) {
                $content = $content -replace $old, $updates[$old]
            }
            
            $content | Out-File -FilePath $docPath -Encoding UTF8
            Write-Success "Updated: $doc"
        } else {
            Write-Info "Would update: $doc"
        }
    }
}

# Step 7: Generate consolidation report
Write-Step "Step 7: Generating Report"

$report = @"
# Script Consolidation Report
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Summary
- Total Scripts: $($allScripts.Count)
- Scripts Kept: $($toKeep.Count)
- Scripts Archived: $($toArchive.Count)
- Scripts Created: 2 (test-service.ps1, start-platform.ps1)
- Net Reduction: $($toArchive.Count - 2) scripts

## Consolidation Mapping

### Health Checks
Old: check-local-health.ps1, check-health-simple.ps1, diagnose-services.ps1
New: check-all-services-health.ps1

### Service Starting
Old: start-all-services.ps1, start-local.ps1, start-services-simple.ps1
New: start-platform.ps1

### Testing
Old: test-auth.ps1, test-client-service.ps1, test-single-service.ps1, etc.
New: test-service.ps1

## Retained Scripts
$(($toKeep | ForEach-Object { "- $($_.Name)" }) -join "`n")

## Archived Scripts
$(($toArchive | ForEach-Object { "- $($_.Name)" }) -join "`n")

## Usage Examples

### New Unified Commands
``````powershell
# Health check
.\check-all-services-health.ps1 -Detailed

# Start platform
.\start-platform.ps1 -Mode docker
.\start-platform.ps1 -Mode local
.\start-platform.ps1 -Mode hybrid

# Run tests
.\test-service.ps1 -Service all
.\test-service.ps1 -Service auth -Coverage
.\test-service.ps1 -Service policy -Watch

# E2E tests
.\run-platform-e2e-tests.ps1
``````

## Next Steps
1. Test new consolidated scripts
2. Update CI/CD pipelines
3. Update team documentation
4. Remove archive folder after 30 days
"@

if (!$DryRun) {
    $report | Out-File -FilePath (Join-Path $scriptPath "CONSOLIDATION_REPORT.md") -Encoding UTF8
    Write-Success "Generated consolidation report"
} else {
    Write-Info "Would generate: CONSOLIDATION_REPORT.md"
}

# Final summary
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "║          ✓ SCRIPT CONSOLIDATION COMPLETE                    ║" -ForegroundColor Green
Write-Host "║                                                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Success "`nConsolidation Results:"
Write-Host "• Reduced from $($allScripts.Count) to $($toKeep.Count + 2) scripts" -ForegroundColor White
Write-Host "• Archived $($toArchive.Count) redundant scripts" -ForegroundColor White
Write-Host "• Created 2 unified scripts" -ForegroundColor White
Write-Host "• Updated documentation references" -ForegroundColor White

if ($DryRun) {
    Write-Warning "`nThis was a DRY RUN - no changes were made"
    Write-Info "Run without -DryRun to apply changes"
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test the new consolidated scripts" -ForegroundColor White
Write-Host "2. Update any custom scripts or aliases" -ForegroundColor White
Write-Host "3. Notify team of changes" -ForegroundColor White
Write-Host "4. Remove archive folder after verification (30 days)" -ForegroundColor White

if (!$DryRun) {
    Write-Info "`nView report: .\CONSOLIDATION_REPORT.md"
}