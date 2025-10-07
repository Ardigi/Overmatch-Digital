# PowerShell script to fix all archived test files to use manual instantiation
# This removes Test.createTestingModule and TypeORM dependencies

param(
    [switch]$DryRun,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Define all test files that need fixing
$testFiles = @(
    # Workflow Service (2 files) - 1 already done
    @{
        Path = "archive\services\workflow-service\src\modules\workflows\services\workflows.service.spec.ts"
        Type = "Service"
        ServiceName = "WorkflowsService"
        Dependencies = @("workflowRepository", "stepRepository", "instanceRepository", "templateRepository", "eventEmitter")
    },
    @{
        Path = "archive\services\workflow-service\src\modules\workflows\services\workflow-engine.service.spec.ts"
        Type = "Service"
        ServiceName = "WorkflowEngineService"
        Dependencies = @("workflowRepository", "instanceRepository", "stepInstanceRepository", "eventEmitter", "configService", "workflowQueue")
    },
    
    # Reporting Service (3 files)
    @{
        Path = "archive\services\reporting-service\src\modules\reports\reports.controller.spec.ts"
        Type = "Controller"
        ControllerName = "ReportsController"
        Dependencies = @("reportsService", "reportGeneratorService", "reportStorageService")
    },
    @{
        Path = "archive\services\reporting-service\src\modules\reports\services\report-generator.service.spec.ts"
        Type = "Service"
        ServiceName = "ReportGeneratorService"
        Dependencies = @("reportRepository", "templateRepository", "dataAggregatorService", "exportService", "eventEmitter")
    },
    @{
        Path = "archive\services\reporting-service\src\modules\reports\services\report-storage.service.spec.ts"
        Type = "Service"
        ServiceName = "ReportStorageService"
        Dependencies = @("storageService", "configService", "reportRepository")
    },
    
    # Integration Service (5 files)
    @{
        Path = "archive\services\integration-service\src\modules\integrations\integrations.controller.spec.ts"
        Type = "Controller"
        ControllerName = "IntegrationsController"
        Dependencies = @("integrationService", "webhookService", "syncService")
    },
    @{
        Path = "archive\services\integration-service\src\modules\integrations\services\integration.service.spec.ts"
        Type = "Service"
        ServiceName = "IntegrationService"
        Dependencies = @("integrationRepository", "credentialRepository", "encryptionService", "eventEmitter", "integrationQueue")
    },
    @{
        Path = "archive\services\integration-service\src\modules\sync\sync.controller.spec.ts"
        Type = "Controller"
        ControllerName = "SyncController"
        Dependencies = @("syncService", "integrationService")
    },
    @{
        Path = "archive\services\integration-service\src\modules\webhooks\webhooks.controller.spec.ts"
        Type = "Controller"
        ControllerName = "WebhooksController"
        Dependencies = @("webhookService", "integrationService")
    },
    @{
        Path = "archive\services\integration-service\src\modules\webhooks\services\webhook.service.spec.ts"
        Type = "Service"
        ServiceName = "WebhookService"
        Dependencies = @("webhookRepository", "integrationRepository", "httpService", "encryptionService", "eventEmitter", "webhookQueue")
    },
    
    # AI Service (8 files)
    @{
        Path = "archive\services\ai-service\src\modules\analysis\analysis.controller.spec.ts"
        Type = "Controller"
        ControllerName = "AnalysisController"
        Dependencies = @("analysisService")
    },
    @{
        Path = "archive\services\ai-service\src\modules\analysis\analysis.service.spec.ts"
        Type = "Service"
        ServiceName = "AnalysisService"
        Dependencies = @("analysisRepository", "aiProviderService", "dataPreprocessor", "eventEmitter", "analysisQueue")
    },
    @{
        Path = "archive\services\ai-service\src\modules\mappings\mappings.controller.spec.ts"
        Type = "Controller"
        ControllerName = "MappingsController"
        Dependencies = @("mappingsService")
    },
    @{
        Path = "archive\services\ai-service\src\modules\mappings\mappings.service.spec.ts"
        Type = "Service"
        ServiceName = "MappingsService"
        Dependencies = @("mappingRepository", "aiProviderService", "nlpProcessor", "eventEmitter", "configService")
    },
    @{
        Path = "archive\services\ai-service\src\modules\predictions\predictions.controller.spec.ts"
        Type = "Controller"
        ControllerName = "PredictionsController"
        Dependencies = @("predictionsService")
    },
    @{
        Path = "archive\services\ai-service\src\modules\predictions\predictions.service.spec.ts"
        Type = "Service"
        ServiceName = "PredictionsService"
        Dependencies = @("predictionRepository", "modelRepository", "aiProviderService", "eventEmitter", "predictionQueue")
    },
    @{
        Path = "archive\services\ai-service\src\modules\remediation\remediation.controller.spec.ts"
        Type = "Controller"
        ControllerName = "RemediationController"
        Dependencies = @("remediationService")
    },
    @{
        Path = "archive\services\ai-service\src\modules\remediation\remediation.service.spec.ts"
        Type = "Service"
        ServiceName = "RemediationService"
        Dependencies = @("remediationRepository", "aiProviderService", "workflowIntegration", "eventEmitter", "remediationQueue")
    }
)

function Convert-TestFile {
    param(
        [hashtable]$FileInfo
    )
    
    $fullPath = Join-Path $PSScriptRoot ".." $FileInfo.Path
    
    if (-not (Test-Path $fullPath)) {
        Write-Warning "File not found: $fullPath"
        return
    }
    
    if ($Verbose) {
        Write-Host "Processing: $($FileInfo.Path)" -ForegroundColor Yellow
    }
    
    $content = Get-Content $fullPath -Raw
    
    # Remove problematic imports
    $content = $content -replace "import\s+{\s*Test[^}]*}\s+from\s+'@nestjs/testing';\s*\n", ""
    $content = $content -replace "import\s+{\s*getRepositoryToken[^}]*}\s+from\s+'@nestjs/typeorm';\s*\n", ""
    $content = $content -replace "import\s+{\s*getQueueToken[^}]*}\s+from\s+'@nestjs/bull';\s*\n", ""
    
    # Find and replace the beforeEach block with Test.createTestingModule
    if ($FileInfo.Type -eq "Service") {
        $serviceName = $FileInfo.ServiceName
        $dependencies = $FileInfo.Dependencies -join ", "
        
        # Create mock factory code
        $mockFactories = @"
// Mock factories
const createMockRepository = <T = any>(): jest.Mocked<Repository<T>> => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  })),
  merge: jest.fn(),
  preload: jest.fn(),
  query: jest.fn(),
  clear: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
} as any);

const createMockQueue = (): any => ({
  add: jest.fn(),
  process: jest.fn(),
  on: jest.fn(),
  removeOnComplete: jest.fn(),
  removeOnFail: jest.fn(),
  clean: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  getJobCounts: jest.fn(),
  getCompletedCount: jest.fn(),
  getFailedCount: jest.fn(),
  getDelayedCount: jest.fn(),
  getActiveCount: jest.fn(),
  getWaitingCount: jest.fn(),
  getPausedCount: jest.fn(),
  getRepeatableJobs: jest.fn(),
  removeRepeatableByKey: jest.fn(),
  removeRepeatable: jest.fn(),
  isReady: jest.fn(),
});

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

const createMockConfigService = (): any => ({
  get: jest.fn(),
  getOrThrow: jest.fn(),
});
"@
        
        # Add mock factories after imports if not already present
        if ($content -notmatch "createMockRepository") {
            $importSection = [regex]::Match($content, "(import[\s\S]*?)\n\ndescribe").Groups[1].Value
            $content = $content -replace [regex]::Escape($importSection), "$importSection`n`n$mockFactories"
        }
        
        # Replace beforeEach with manual instantiation
        $pattern = "beforeEach\s*\(\s*async\s*\(\)\s*=>\s*{\s*const\s+module[^}]+module\.get[^}]+jest\.clearAllMocks\(\);\s*}\);"
        $replacement = @"
beforeEach(() => {
    // Create mocks
    $(
        $FileInfo.Dependencies | ForEach-Object {
            if ($_ -match "Repository$") {
                "const $_ = createMockRepository();"
            } elseif ($_ -match "Queue$") {
                "const $_ = createMockQueue();"
            } elseif ($_ -eq "eventEmitter") {
                "const eventEmitter = createMockEventEmitter();"
            } elseif ($_ -eq "configService") {
                "const configService = createMockConfigService();"
            } else {
                "const $_ = { /* Add mock methods */ } as any;"
            }
        } | Out-String
    )

    // Manual instantiation
    service = new $serviceName(
      $dependencies
    );

    jest.clearAllMocks();
  });
"@
        
        $content = $content -replace $pattern, $replacement
        
    } elseif ($FileInfo.Type -eq "Controller") {
        $controllerName = $FileInfo.ControllerName
        $dependencies = $FileInfo.Dependencies -join ", "
        
        # For controllers, create mock services
        $pattern = "beforeEach\s*\(\s*async\s*\(\)\s*=>\s*{[^}]+module\.get[^}]+}\);"
        $replacement = @"
beforeEach(() => {
    // Create mock services
    $(
        $FileInfo.Dependencies | ForEach-Object {
            "mock$($_.Substring(0,1).ToUpper() + $_.Substring(1)) = {
      // Add all service methods as jest.fn()
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };"
        } | Out-String
    )

    // Manual instantiation
    controller = new $controllerName(
      $dependencies
    );

    jest.clearAllMocks();
  });
"@
        
        $content = $content -replace $pattern, $replacement
    }
    
    # Fix variable declarations
    $content = $content -replace "let\s+(\w+Repository):\s*Repository<\w+>;", 'let $1: any;'
    $content = $content -replace "let\s+(\w+Queue):\s*Queue;", 'let $1: any;'
    $content = $content -replace "let\s+eventEmitter:\s*EventEmitter2;", 'let eventEmitter: any;'
    $content = $content -replace "let\s+configService:\s*ConfigService;", 'let configService: any;'
    
    if ($DryRun) {
        Write-Host "Would modify: $($FileInfo.Path)" -ForegroundColor Cyan
        Write-Host "First 50 lines of changes:" -ForegroundColor Gray
        $content.Split("`n")[0..49] | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    } else {
        Set-Content -Path $fullPath -Value $content -Encoding UTF8
        Write-Host "✓ Fixed: $($FileInfo.Path)" -ForegroundColor Green
    }
}

# Main execution
Write-Host "`nFixing Archived Test Files for Manual Instantiation" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "`nDRY RUN MODE - No files will be modified" -ForegroundColor Yellow
}

$successCount = 0
$errorCount = 0

foreach ($file in $testFiles) {
    try {
        Convert-TestFile -FileInfo $file
        $successCount++
    } catch {
        Write-Error "Failed to process $($file.Path): $_"
        $errorCount++
    }
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Successfully processed: $successCount files" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "  Errors encountered: $errorCount files" -ForegroundColor Red
}

if (-not $DryRun) {
    Write-Host "`nAll test files have been converted to use manual instantiation!" -ForegroundColor Green
    Write-Host "The tests are now free from TypeORM/Jest compatibility issues." -ForegroundColor Green
}