# PowerShell script to run E2E tests for a service with proper environment setup

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceName,
    
    [Parameter(Mandatory=$false)]
    [switch]$Watch,
    
    [Parameter(Mandatory=$false)]
    [string]$TestPattern
)

$ErrorActionPreference = "Stop"

# Set test environment variables
$env:NODE_ENV = "test"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "5433"
$env:DB_USERNAME = "test_user"
$env:DB_PASSWORD = "test_pass"
$env:REDIS_HOST = "127.0.0.1"
$env:REDIS_PORT = "6380"
$env:REDIS_PASSWORD = "test_redis_pass"
$env:KAFKA_BROKERS = "127.0.0.1:9093"
$env:EMAIL_HOST = "127.0.0.1"
$env:EMAIL_PORT = "1025"
$env:JWT_SECRET = "test-jwt-secret-key"
$env:JWT_EXPIRES_IN = "30m"
$env:REFRESH_TOKEN_EXPIRES_IN = "7d"
$env:MFA_SECRET = "test-mfa-secret"
$env:RATE_LIMIT_WINDOW = "15"
$env:RATE_LIMIT_MAX_REQUESTS = "100"

# Service-specific database names
$databases = @{
    "auth-service" = "soc_auth_test"
    "client-service" = "soc_clients_test"
    "policy-service" = "soc_policies_test"
    "control-service" = "soc_controls_test"
    "evidence-service" = "soc_evidence_test"
    "workflow-service" = "soc_workflows_test"
    "reporting-service" = "soc_reporting_test"
    "audit-service" = "soc_audits_test"
    "integration-service" = "soc_integrations_test"
    "notification-service" = "soc_notifications_test"
    "ai-service" = "soc_ai_test"
}

# Additional service-specific configurations
$serviceConfigs = @{
    "evidence-service" = @{
        MONGO_URI = "mongodb://test_user:test_pass@127.0.0.1:27018/test_documents?authSource=admin"
        STORAGE_TYPE = "local"
        STORAGE_PATH = "C:\tmp\evidence-test"
        MAX_FILE_SIZE = "10485760"
    }
    "ai-service" = @{
        MONGO_URI = "mongodb://test_user:test_pass@127.0.0.1:27018/test_ai?authSource=admin"
        ELASTICSEARCH_NODE = "http://127.0.0.1:9201"
        AI_PROVIDER = "mock"
        OPENAI_API_KEY = "test-key"
    }
    "notification-service" = @{
        SMTP_HOST = "127.0.0.1"
        SMTP_PORT = "1025"
        SMTP_SECURE = "false"
        EMAIL_FROM = "noreply@test-soc.com"
    }
    "reporting-service" = @{
        STORAGE_TYPE = "local"
        STORAGE_PATH = "C:\tmp\reports-test"
        ENCRYPTION_KEY = "test-encryption-key-32-chars-long!!"
    }
}

# Set database name
if ($databases.ContainsKey($ServiceName)) {
    $env:DB_NAME = $databases[$ServiceName]
} else {
    Write-Error "Unknown service: $ServiceName"
    exit 1
}

# Set service-specific environment variables
if ($serviceConfigs.ContainsKey($ServiceName)) {
    foreach ($key in $serviceConfigs[$ServiceName].Keys) {
        Set-Item -Path "env:$key" -Value $serviceConfigs[$ServiceName][$key]
    }
}

# Navigate to service directory
$servicePath = "services\$ServiceName"
if (-not (Test-Path $servicePath)) {
    Write-Error "Service directory not found: $servicePath"
    exit 1
}

Push-Location $servicePath

try {
    Write-Host "Running E2E tests for $ServiceName..." -ForegroundColor Cyan
    Write-Host "Database: $env:DB_NAME" -ForegroundColor Gray
    
    # Build Jest command
    $jestArgs = @(
        "--config", "./test/e2e/jest-e2e.json",
        "--runInBand",
        "--forceExit"
    )
    
    if ($Watch) {
        $jestArgs += "--watch"
    }
    
    if ($TestPattern) {
        $jestArgs += "--testNamePattern", "`"$TestPattern`""
    }
    
    # Run tests
    npx jest @jestArgs
    
} finally {
    Pop-Location
    
    # Clean up environment variables
    Remove-Item env:DB_NAME -ErrorAction SilentlyContinue
    Remove-Item env:NODE_ENV -ErrorAction SilentlyContinue
    
    # Remove service-specific vars
    if ($serviceConfigs.ContainsKey($ServiceName)) {
        foreach ($key in $serviceConfigs[$ServiceName].Keys) {
            Remove-Item "env:$key" -ErrorAction SilentlyContinue
        }
    }
}