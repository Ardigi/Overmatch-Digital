# PowerShell Script Audit Report

## Overview
Audit of 56 PowerShell scripts in the `/scripts` directory to identify redundancies, consolidate functionality, and establish naming standards.

## Script Categories

### 🔴 Critical Scripts (Keep & Maintain)
These scripts are essential for platform operation:

1. **setup-dev-environment.ps1** (NEW) - Master setup script
2. **check-all-services-health.ps1** (NEW) - Comprehensive health check
3. **start-docker-services.ps1** (root) - Docker infrastructure startup
4. **run-migrations.ps1** - Database migration runner
5. **run-integration-tests.ps1** - Integration test orchestrator
6. **run-e2e-tests.ps1** - E2E test runner
7. **build-shared-packages.ps1** - Shared package builder
8. **test-all-services.ps1** - Unit test runner

### 🟠 Scripts with "Fixed" Versions (Need Consolidation)

| Original | Fixed Version | Recommendation |
|----------|--------------|----------------|
| check-local-health.ps1 | check-local-health-fixed.ps1 | Merge into check-all-services-health.ps1 |
| start-services-simple.ps1 | start-services-simple-fixed.ps1 | Keep fixed, remove original |

### 🟡 Redundant/Overlapping Scripts (Candidates for Removal)

#### Health Check Scripts (6 scripts → 1 script)
- check-health-simple.ps1
- check-local-health.ps1  
- check-local-health-fixed.ps1
- diagnose-services.ps1
- check-all-build-errors.ps1
**Action**: Replace all with `check-all-services-health.ps1`

#### Service Starting Scripts (7 scripts → 2 scripts)
- start-all-services.ps1
- start-local.ps1
- start-platform.ps1
- start-services-direct.ps1
- start-services-production-ready.ps1
- start-services-simple.ps1
- start-services-simple-fixed.ps1
**Action**: Keep only `start-docker-services.ps1` and `setup-dev-environment.ps1`

#### Test Scripts (10 scripts → 3 scripts)
- test-auth.ps1
- test-auth-service.ps1
- test-client-service.ps1
- test-control-service.ps1
- test-control-service-db.ps1
- test-critical-services.ps1
- test-policy-service.ps1
- test-services.ps1
- test-service-startup.ps1
- test-single-service.ps1
**Action**: Consolidate into `test-all-services.ps1` with service parameter

### 🟢 Specialized Scripts (Keep As-Is)
These serve specific purposes and should be retained:

1. **Integration Testing Suite**
   - integration-test-orchestrator.ps1
   - setup-integration-environment.ps1
   - verify-integration-infrastructure.ps1
   - generate-integration-report.ps1
   - demo-integration-tests.ps1

2. **Database Management**
   - generate-migration.ps1
   - create-all-databases.ps1
   - setup-local-databases.ps1

3. **Build Scripts**
   - build-all-docker-images.ps1
   - build-evidence-service.ps1
   - build-remaining-services.ps1
   - docker-build-services.ps1

4. **Setup & Configuration**
   - configure-dev-environment.ps1
   - setup-pre-commit-hooks.ps1
   - setup-secrets-monitoring.ps1
   - setup-external-services.ps1

5. **Utility Scripts**
   - fix-archived-tests-manual-instantiation.ps1
   - fix-start-direct-paths.ps1
   - update-jest-e2e-configs.ps1

### 📊 Script Statistics

- **Total Scripts**: 56
- **To Keep**: 25
- **To Consolidate**: 15
- **To Remove**: 16
- **New Scripts Created**: 3

## Recommended Actions

### Immediate Actions (Phase 1)

1. **Create Backup Directory**
   ```powershell
   mkdir scripts/archive
   ```

2. **Move Deprecated Scripts**
   ```powershell
   # Move redundant health check scripts
   Move-Item scripts/check-local-health.ps1 scripts/archive/
   Move-Item scripts/check-health-simple.ps1 scripts/archive/
   Move-Item scripts/diagnose-services.ps1 scripts/archive/
   
   # Move redundant start scripts
   Move-Item scripts/start-services-simple.ps1 scripts/archive/
   Move-Item scripts/start-all-services.ps1 scripts/archive/
   Move-Item scripts/start-local.ps1 scripts/archive/
   ```

3. **Rename Fixed Scripts**
   ```powershell
   # Remove "-fixed" suffix
   Rename-Item scripts/check-local-health-fixed.ps1 scripts/check-local-health.ps1
   Rename-Item scripts/start-services-simple-fixed.ps1 scripts/start-services.ps1
   ```

### Consolidation Plan (Phase 2)

1. **Create Unified Test Script**
   ```powershell
   # New: test-service.ps1
   param(
       [string]$Service = "all",
       [switch]$Coverage,
       [switch]$Watch
   )
   ```

2. **Create Unified Start Script**
   ```powershell
   # New: start-platform.ps1
   param(
       [string]$Mode = "docker",  # docker, local, hybrid
       [switch]$Quick,
       [switch]$Production
   )
   ```

3. **Update Documentation**
   - Update CLAUDE.md with new script names
   - Update README.md quick start
   - Update troubleshooting guides

### Naming Convention (Phase 3)

Establish clear naming standards:

| Pattern | Purpose | Example |
|---------|---------|---------|
| `setup-*.ps1` | Initial setup scripts | setup-dev-environment.ps1 |
| `start-*.ps1` | Starting services | start-docker-services.ps1 |
| `test-*.ps1` | Testing scripts | test-all-services.ps1 |
| `check-*.ps1` | Health/status checks | check-all-services-health.ps1 |
| `run-*.ps1` | Running specific tasks | run-migrations.ps1 |
| `build-*.ps1` | Building/compilation | build-shared-packages.ps1 |
| `fix-*.ps1` | One-time fixes (archive after use) | fix-start-direct-paths.ps1 |

## Script Documentation Template

Each retained script should have:

```powershell
<#
.SYNOPSIS
    Brief description of what the script does
    
.DESCRIPTION
    Detailed explanation of functionality
    
.PARAMETER ParameterName
    Description of each parameter
    
.EXAMPLE
    .\script-name.ps1 -Parameter value
    
.NOTES
    Author: Team
    Created: Date
    Modified: Date
    Version: 1.0
#>
```

## Migration Timeline

### Week 1
- [x] Create new master scripts
- [ ] Test new scripts thoroughly
- [ ] Create archive directory

### Week 2
- [ ] Move deprecated scripts to archive
- [ ] Rename fixed scripts
- [ ] Update all documentation

### Week 3
- [ ] Consolidate test scripts
- [ ] Consolidate start scripts
- [ ] Final testing

### Week 4
- [ ] Remove archive directory
- [ ] Final documentation update
- [ ] Team training on new scripts

## Success Metrics

- **Reduction in scripts**: From 56 to ~25 (55% reduction)
- **No more "-fixed" suffixes**: Clear, consistent naming
- **Single source of truth**: One script per function
- **Documentation coverage**: 100% of retained scripts documented
- **Developer confusion**: Eliminated

## Notes

- Keep archive directory for 30 days before permanent deletion
- Update CI/CD pipelines to use new script names
- Create aliases for commonly used scripts in PowerShell profile
- Consider converting critical scripts to Node.js for cross-platform compatibility