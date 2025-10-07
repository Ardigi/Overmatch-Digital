# Configure Development Environment Script
Write-Host "Configuring development environment for all services..." -ForegroundColor Cyan

$services = @(
    "auth-service",
    "client-service", 
    "policy-service",
    "control-service",
    "evidence-service",
    "workflow-service",
    "reporting-service",
    "audit-service",
    "integration-service",
    "notification-service",
    "ai-service"
)

$rootPath = Split-Path $PSScriptRoot -Parent

foreach ($service in $services) {
    Write-Host "`nConfiguring $service..." -ForegroundColor Yellow
    
    $servicePath = Join-Path $rootPath "services\$service"
    $envFile = Join-Path $servicePath ".env"
    
    # Create basic .env file with Kafka disabled
    $dbName = "soc_" + ($service -replace '-service','') -replace '-','_'
    $port = switch ($service) {
        "auth-service" { 3001 }
        "client-service" { 3002 }
        "policy-service" { 3003 }
        "control-service" { 3004 }
        "evidence-service" { 3005 }
        "workflow-service" { 3006 }
        "reporting-service" { 3007 }
        "audit-service" { 3008 }
        "integration-service" { 3009 }
        "notification-service" { 3010 }
        "ai-service" { 3011 }
    }
    
    $envContent = @"
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=$dbName
SERVICE_PORT=$port
PORT=$port
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=30m
KAFKA_BROKERS=localhost:9092
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
"@

    # Add service-specific configurations
    switch ($service) {
        "auth-service" {
            $envContent += @"

# Auth Service Specific
MFA_SECRET=your-mfa-secret-key
SESSION_SECRET=your-session-secret
EMAIL_FROM=noreply@soc-compliance.com
"@
        }
        "notification-service" {
            $envContent += @"

# Notification Service Specific
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@soc-compliance.com
"@
        }
        "evidence-service" {
            $envContent += @"

# Evidence Service Specific
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,png,jpg,jpeg
"@
        }
        "ai-service" {
            $envContent += @"

# AI Service Specific
OPENAI_API_KEY=your-openai-api-key
AI_MODEL=gpt-3.5-turbo
"@
        }
    }
    
    Set-Content -Path $envFile -Value $envContent -Force
    Write-Host "  Created/Updated .env file" -ForegroundColor Green
}

Write-Host "`nDevelopment environment configured!" -ForegroundColor Green
Write-Host "All services configured with:" -ForegroundColor Cyan
Write-Host "  - Kafka enabled (localhost:9092)" -ForegroundColor White
Write-Host "  - Windows-compatible DB_HOST (127.0.0.1)" -ForegroundColor White
Write-Host "  - Correct database credentials (soc_user/soc_pass)" -ForegroundColor White
Write-Host "  - Service-specific ports configured" -ForegroundColor White