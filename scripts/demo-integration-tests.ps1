#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Integration Test System Demo
    
.DESCRIPTION
    Demonstrates the comprehensive integration test management system.
    Shows infrastructure verification, test execution, and report generation.
    
.PARAMETER Quick
    Run quick demo with basic tests only
    
.PARAMETER Interactive
    Interactive mode with user prompts
    
.EXAMPLE
    .\scripts\demo-integration-tests.ps1
    
.EXAMPLE
    .\scripts\demo-integration-tests.ps1 -Quick -Interactive
#>

param(
    [switch]$Quick,
    [switch]$Interactive
)

function Write-DemoHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Magenta
    Write-Host "  $Title" -ForegroundColor Magenta
    Write-Host "=" * 80 -ForegroundColor Magenta
}

function Write-DemoStep {
    param([string]$Step, [string]$Description)
    Write-Host ""
    Write-Host "🎯 Step: $Step" -ForegroundColor Cyan
    Write-Host "   $Description" -ForegroundColor Gray
}

function Wait-UserInput {
    param([string]$Message = "Press Enter to continue...")
    if ($Interactive) {
        Write-Host ""
        Write-Host $Message -ForegroundColor Yellow
        Read-Host
    } else {
        Start-Sleep -Seconds 2
    }
}

function Main {
    Write-DemoHeader "SOC Compliance Platform - Integration Test System Demo"
    
    Write-Host ""
    Write-Host "🧪 This demo showcases the comprehensive integration test management system" -ForegroundColor White
    Write-Host "   including infrastructure verification, test execution, and reporting." -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Demo Components:" -ForegroundColor White
    Write-Host "   1. Infrastructure Verification" -ForegroundColor Cyan
    Write-Host "   2. Test Environment Setup" -ForegroundColor Cyan
    Write-Host "   3. Integration Test Execution" -ForegroundColor Cyan
    Write-Host "   4. Report Generation" -ForegroundColor Cyan
    Write-Host "   5. Advanced Orchestration" -ForegroundColor Cyan
    
    Wait-UserInput "Press Enter to start the demo..."
    
    # Step 1: Infrastructure Verification
    Write-DemoStep "1" "Infrastructure Verification - Check all prerequisites"
    
    Write-Host "   Command: .\scripts\verify-integration-infrastructure.ps1 -Detailed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   This script verifies:" -ForegroundColor Gray
    Write-Host "   • Redis connectivity and operations" -ForegroundColor Gray
    Write-Host "   • PostgreSQL databases and schemas" -ForegroundColor Gray
    Write-Host "   • Service health endpoints" -ForegroundColor Gray
    Write-Host "   • Optional infrastructure (Kafka, MongoDB, Elasticsearch)" -ForegroundColor Gray
    
    Wait-UserInput
    
    if (-not $Quick) {
        try {
            Write-Host "   Running verification..." -ForegroundColor Green
            & "$PSScriptRoot\verify-integration-infrastructure.ps1" -Detailed
        } catch {
            Write-Host "   ⚠️ Verification script demo (infrastructure may not be running)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⏭️ Skipped in quick mode" -ForegroundColor Yellow
    }
    
    # Step 2: Test Environment Setup
    Write-DemoStep "2" "Test Environment Setup - Prepare isolated test environment"
    
    Write-Host "   Command: .\scripts\setup-integration-environment.ps1 -Clean -Detailed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   This script:" -ForegroundColor Gray
    Write-Host "   • Creates isolated test databases (soc_*_test)" -ForegroundColor Gray
    Write-Host "   • Configures Redis test databases" -ForegroundColor Gray
    Write-Host "   • Runs database migrations" -ForegroundColor Gray
    Write-Host "   • Prepares service configurations" -ForegroundColor Gray
    
    Wait-UserInput
    
    Write-Host "   📋 Test Database Configuration:" -ForegroundColor Cyan
    $testDatabases = @(
        "soc_auth_test", "soc_clients_test", "soc_notifications_test",
        "soc_policies_test", "soc_controls_test", "soc_evidence_test",
        "soc_workflows_test", "soc_reports_test", "soc_audits_test",
        "soc_integrations_test", "soc_ai_test"
    )
    
    foreach ($db in $testDatabases) {
        Write-Host "   • $db" -ForegroundColor Gray
    }
    
    Wait-UserInput
    
    # Step 3: Integration Test Execution
    Write-DemoStep "3" "Integration Test Execution - Run real integration tests"
    
    Write-Host "   Available npm commands:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   npm run test:integration                 # Run all integration tests" -ForegroundColor Cyan
    Write-Host "   npm run test:integration:auth           # Test auth service only" -ForegroundColor Cyan
    Write-Host "   npm run test:integration:redis          # Test Redis integration" -ForegroundColor Cyan
    Write-Host "   npm run test:integration:database       # Test database integration" -ForegroundColor Cyan
    Write-Host "   npm run test:integration:communication  # Test service communication" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Advanced execution:" -ForegroundColor Yellow
    Write-Host "   .\scripts\run-integration-tests.ps1 -Service auth,client -Category redis -Detailed" -ForegroundColor Cyan
    
    Wait-UserInput
    
    Write-Host "   📊 Test Categories:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   🔴 Redis Cache Integration Tests:" -ForegroundColor Red
    Write-Host "      • Actual Redis connectivity (no graceful degradation)" -ForegroundColor Gray
    Write-Host "      • Cache operations (set, get, delete, expire)" -ForegroundColor Gray
    Write-Host "      • Connection authentication and error handling" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   🟢 Database Integration Tests:" -ForegroundColor Green
    Write-Host "      • PostgreSQL connectivity through TypeORM" -ForegroundColor Gray
    Write-Host "      • CRUD operations with real data" -ForegroundColor Gray
    Write-Host "      • Schema validation and migrations" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   🔵 Service Communication Tests:" -ForegroundColor Blue
    Write-Host "      • HTTP API calls between services" -ForegroundColor Gray
    Write-Host "      • Authentication header validation" -ForegroundColor Gray
    Write-Host "      • Error handling and response validation" -ForegroundColor Gray
    
    Wait-UserInput
    
    if (-not $Quick) {
        Write-Host "   Example execution (dry-run mode):" -ForegroundColor Green
        try {
            & "$PSScriptRoot\run-integration-tests.ps1" -Service auth -Category redis -DryRun
        } catch {
            Write-Host "   ⚠️ Demo mode - actual tests require running infrastructure" -ForegroundColor Yellow
        }
    }
    
    # Step 4: Report Generation
    Write-DemoStep "4" "Report Generation - Comprehensive test analytics"
    
    Write-Host "   Command: .\scripts\generate-integration-report.ps1 -Format all -IncludeHistorical -GenerateTrends" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Report formats:" -ForegroundColor Gray
    Write-Host "   • HTML: Interactive reports with charts and metrics" -ForegroundColor Gray
    Write-Host "   • JSON: Machine-readable for CI/CD integration" -ForegroundColor Gray
    Write-Host "   • Markdown: Documentation-friendly team reports" -ForegroundColor Gray
    
    Wait-UserInput
    
    Write-Host "   📈 Report Features:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   📊 Executive Summary:" -ForegroundColor White
    Write-Host "      • Pass/fail rates with visual indicators" -ForegroundColor Gray
    Write-Host "      • Total test count and execution duration" -ForegroundColor Gray
    Write-Host "      • Service-by-service breakdown" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   ⚡ Performance Analysis:" -ForegroundColor White
    Write-Host "      • Slowest and fastest tests identification" -ForegroundColor Gray
    Write-Host "      • Duration trends and performance regression detection" -ForegroundColor Gray
    Write-Host "      • Resource usage monitoring during tests" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   🏗️ Infrastructure Health:" -ForegroundColor White
    Write-Host "      • Redis, PostgreSQL, and service status" -ForegroundColor Gray
    Write-Host "      • Response times and connection metrics" -ForegroundColor Gray
    Write-Host "      • Resource utilization and capacity planning" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   📈 Historical Comparison:" -ForegroundColor White
    Write-Host "      • Test count changes over time" -ForegroundColor Gray
    Write-Host "      • Pass rate trends and reliability metrics" -ForegroundColor Gray
    Write-Host "      • Performance improvement/degradation tracking" -ForegroundColor Gray
    
    Wait-UserInput
    
    # Step 5: Advanced Orchestration
    Write-DemoStep "5" "Advanced Orchestration - Enterprise workflow management"
    
    Write-Host "   Command: .\scripts\integration-test-orchestrator.ps1 -Workflow [workflow] [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   🎭 Predefined Workflows:" -ForegroundColor Cyan
    Write-Host ""
    
    $workflows = @(
        @{ Name = "full"; Description = "All 11 services, all categories (~30 min)"; Color = "Red" }
        @{ Name = "quick"; Description = "Critical 3 services, Redis+DB (~10 min)"; Color = "Green" }
        @{ Name = "smoke"; Description = "Auth+Client, Redis only (~5 min)"; Color = "Yellow" }
        @{ Name = "critical"; Description = "Critical services with retries (~15 min)"; Color = "Magenta" }
        @{ Name = "regression"; Description = "Core 5 services, DB+Comm (~20 min)"; Color = "Blue" }
    )
    
    foreach ($workflow in $workflows) {
        Write-Host "   • $($workflow.Name.PadRight(10)) : $($workflow.Description)" -ForegroundColor $workflow.Color
    }
    
    Wait-UserInput
    
    Write-Host "   🚀 Advanced Features:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   🔄 Retry Mechanisms:" -ForegroundColor White
    Write-Host "      • Exponential backoff for failed tests" -ForegroundColor Gray
    Write-Host "      • Configurable retry attempts per workflow" -ForegroundColor Gray
    Write-Host "      • Intelligent failure classification" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   ⚡ Parallel Execution:" -ForegroundColor White
    Write-Host "      • Dependency-aware parallel test execution" -ForegroundColor Gray
    Write-Host "      • Configurable parallelism limits" -ForegroundColor Gray
    Write-Host "      • Resource-based execution throttling" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   📊 Resource Monitoring:" -ForegroundColor White
    Write-Host "      • Real-time CPU, memory, and disk monitoring" -ForegroundColor Gray
    Write-Host "      • Configurable alert thresholds" -ForegroundColor Gray
    Write-Host "      • Performance impact analysis" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   🔔 Notifications:" -ForegroundColor White
    Write-Host "      • Webhook notifications (Slack, Teams, etc.)" -ForegroundColor Gray
    Write-Host "      • Email reports with test summaries" -ForegroundColor Gray
    Write-Host "      • CI/CD pipeline integration" -ForegroundColor Gray
    
    Wait-UserInput
    
    if (-not $Quick) {
        Write-Host "   Example orchestration (smoke test workflow):" -ForegroundColor Green
        Write-Host "   .\scripts\integration-test-orchestrator.ps1 -Workflow smoke -MonitorResources -GenerateMetrics" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   This would:" -ForegroundColor Gray
        Write-Host "   • Verify infrastructure prerequisites" -ForegroundColor Gray
        Write-Host "   • Run auth and client service Redis tests" -ForegroundColor Gray
        Write-Host "   • Monitor system resources during execution" -ForegroundColor Gray
        Write-Host "   • Generate comprehensive metrics report" -ForegroundColor Gray
    }
    
    # Summary
    Write-DemoHeader "Integration Test System Summary"
    
    Write-Host ""
    Write-Host "🎉 You now have a comprehensive integration test management system!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Key Benefits:" -ForegroundColor White
    Write-Host "   ✅ Real infrastructure testing (no mocks)" -ForegroundColor Green
    Write-Host "   ✅ Fail-fast approach for reliability" -ForegroundColor Green
    Write-Host "   ✅ Dependency-aware test execution" -ForegroundColor Green
    Write-Host "   ✅ Comprehensive reporting and analytics" -ForegroundColor Green
    Write-Host "   ✅ Advanced orchestration workflows" -ForegroundColor Green
    Write-Host "   ✅ CI/CD integration ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "   1. Start your infrastructure: .\start-docker-services.ps1" -ForegroundColor Yellow
    Write-Host "   2. Verify prerequisites: npm run test:integration:verify" -ForegroundColor Yellow
    Write-Host "   3. Setup test environment: npm run test:integration:setup" -ForegroundColor Yellow
    Write-Host "   4. Run your first test: npm run test:integration:auth" -ForegroundColor Yellow
    Write-Host "   5. Generate report: npm run test:integration:report" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📖 Documentation:" -ForegroundColor Cyan
    Write-Host "   • Complete guide: docs/INTEGRATION_TESTING.md" -ForegroundColor Yellow
    Write-Host "   • Test template: services/INTEGRATION_TEST_TEMPLATE.md" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🎯 Remember: Integration tests verify real infrastructure connectivity!" -ForegroundColor Magenta
    Write-Host "   Unlike unit tests, they should fail if dependencies are unavailable." -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "Demo completed successfully! 🎉" -ForegroundColor Green
}

# Execute demo
try {
    Main
} catch {
    Write-Host ""
    Write-Host "💥 Demo Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "This is a demonstration script - some features require running infrastructure." -ForegroundColor Yellow
}