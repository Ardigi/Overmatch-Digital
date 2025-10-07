# Setup Secrets Management Monitoring
# This script sets up comprehensive monitoring for the secrets management system

param(
    [switch]$Full,              # Install full monitoring stack including external services
    [switch]$Local,             # Setup for local development
    [switch]$Production,        # Setup for production environment
    [switch]$CleanInstall,      # Clean install (remove existing data)
    [string]$Environment = "development"
)

Write-Host "Setting up Secrets Management Monitoring..." -ForegroundColor Green

# Function to check if Docker is running
function Test-DockerRunning {
    try {
        docker version | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to check if service is healthy
function Wait-ForService {
    param(
        [string]$ServiceName,
        [string]$HealthEndpoint,
        [int]$TimeoutSeconds = 120
    )
    
    Write-Host "Waiting for $ServiceName to be healthy..." -ForegroundColor Yellow
    $elapsed = 0
    
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $response = Invoke-RestMethod -Uri $HealthEndpoint -Method Get -TimeoutSec 5
            if ($response) {
                Write-Host "$ServiceName is healthy!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Service not ready yet
        }
        
        Start-Sleep -Seconds 5
        $elapsed += 5
        Write-Host "." -NoNewline
    }
    
    Write-Host ""
    Write-Host "Timeout waiting for $ServiceName" -ForegroundColor Red
    return $false
}

# Check prerequisites
if (-not (Test-DockerRunning)) {
    Write-Host "ERROR: Docker is not running. Please start Docker first." -ForegroundColor Red
    exit 1
}

# Clean install option
if ($CleanInstall) {
    Write-Host "Performing clean install..." -ForegroundColor Yellow
    docker-compose -f docker-compose.yml -f docker-compose.secrets-monitoring.yml down -v
    docker system prune -f
}

# Build required images
Write-Host "Building secrets monitoring components..." -ForegroundColor Blue
docker-compose -f docker-compose.yml -f docker-compose.secrets-monitoring.yml build secrets-exporter

# Start core monitoring services
Write-Host "Starting core monitoring services..." -ForegroundColor Blue
$services = @('prometheus', 'grafana', 'alertmanager')

if ($Full -or $Production) {
    $services += @('elasticsearch', 'kibana', 'jaeger')
}

foreach ($service in $services) {
    Write-Host "Starting $service..." -ForegroundColor Yellow
    docker-compose -f docker-compose.yml -f docker-compose.secrets-monitoring.yml up -d $service
}

# Start secrets providers if requested
if ($Full -or $Local) {
    Write-Host "Starting secrets providers..." -ForegroundColor Blue
    docker-compose -f docker-compose.secrets-monitoring.yml up -d vault localstack
    
    # Wait for providers to be ready
    if (-not (Wait-ForService -ServiceName "Vault" -HealthEndpoint "http://localhost:8200/v1/sys/health" -TimeoutSeconds 60)) {
        Write-Host "WARNING: Vault failed to start properly" -ForegroundColor Yellow
    }
    
    if (-not (Wait-ForService -ServiceName "LocalStack" -HealthEndpoint "http://localhost:4566/_localstack/health" -TimeoutSeconds 90)) {
        Write-Host "WARNING: LocalStack failed to start properly" -ForegroundColor Yellow
    }
}

# Start secrets monitoring exporter
Write-Host "Starting secrets monitoring exporter..." -ForegroundColor Blue
docker-compose -f docker-compose.secrets-monitoring.yml up -d secrets-exporter

# Wait for core services
$coreServices = @(
    @{ Name = "Prometheus"; Url = "http://localhost:9090/-/healthy" },
    @{ Name = "Grafana"; Url = "http://localhost:3000/api/health" },
    @{ Name = "Secrets Exporter"; Url = "http://localhost:9090/health" }
)

foreach ($service in $coreServices) {
    if (-not (Wait-ForService -ServiceName $service.Name -HealthEndpoint $service.Url)) {
        Write-Host "ERROR: Failed to start $($service.Name)" -ForegroundColor Red
        exit 1
    }
}

# Import Grafana dashboards
Write-Host "Importing Grafana dashboards..." -ForegroundColor Blue
Start-Sleep -Seconds 10  # Give Grafana time to fully initialize

$grafanaUrl = "http://admin:soc_grafana_admin@localhost:3000"
$dashboards = @(
    "monitoring/grafana/dashboards/secrets-operations.json",
    "monitoring/grafana/dashboards/secrets-security.json",
    "monitoring/grafana/dashboards/secrets-providers.json"
)

foreach ($dashboard in $dashboards) {
    if (Test-Path $dashboard) {
        try {
            $dashboardContent = Get-Content $dashboard -Raw | ConvertFrom-Json
            $payload = @{
                dashboard = $dashboardContent.dashboard
                overwrite = $true
            } | ConvertTo-Json -Depth 100
            
            $response = Invoke-RestMethod -Uri "$grafanaUrl/api/dashboards/db" -Method Post -Body $payload -ContentType "application/json"
            Write-Host "Imported dashboard: $dashboard" -ForegroundColor Green
        } catch {
            Write-Host "Failed to import dashboard: $dashboard - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Setup Vault with sample secrets (if running)
if ($Full -or $Local) {
    Write-Host "Setting up Vault with sample secrets..." -ForegroundColor Blue
    try {
        # Enable KV secrets engine
        docker exec soc-vault vault secrets enable -path=secret kv-v2
        
        # Create sample secrets
        docker exec soc-vault vault kv put secret/database password="sample-db-password" username="dbuser"
        docker exec soc-vault vault kv put secret/api-key key="sample-api-key-12345" expires="2024-12-31"
        docker exec soc-vault vault kv put secret/encryption-key key="sample-encryption-key-abcdef" algorithm="AES-256"
        
        Write-Host "Sample secrets created in Vault" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Failed to setup Vault secrets - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Setup LocalStack with sample secrets (if running)
if ($Full -or $Local) {
    Write-Host "Setting up LocalStack with sample secrets..." -ForegroundColor Blue
    try {
        # Create sample secrets in AWS Secrets Manager
        $env:AWS_ACCESS_KEY_ID = "test"
        $env:AWS_SECRET_ACCESS_KEY = "test"
        $env:AWS_DEFAULT_REGION = "us-east-1"
        $env:AWS_ENDPOINT_URL = "http://localhost:4566"
        
        # Note: This would require AWS CLI to be installed
        # aws secretsmanager create-secret --name "database-credentials" --secret-string '{"username":"dbuser","password":"sample-password"}'
        Write-Host "LocalStack secrets setup skipped (requires AWS CLI)" -ForegroundColor Yellow
    } catch {
        Write-Host "WARNING: Failed to setup LocalStack secrets - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Generate configuration examples
Write-Host "Generating configuration examples..." -ForegroundColor Blue
$configDir = "examples/monitoring-config"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Service configuration example
@"
# Example service configuration with secrets monitoring
NODE_ENV=$Environment
LOG_LEVEL=info

# Secrets management
SECRETS_CACHE_TTL=300
SECRETS_ROTATION_ENABLED=true
SECRETS_MONITORING_ENABLED=true

# AWS Secrets Manager (LocalStack for development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566

# HashiCorp Vault
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-root-token
VAULT_NAMESPACE=

# Monitoring
PROMETHEUS_ENDPOINT=http://localhost:9090
GRAFANA_ENDPOINT=http://localhost:3000
METRICS_ENABLED=true
METRICS_PREFIX=soc_secrets_

# Health checks
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=10
"@ | Out-File -FilePath "$configDir/.env.example" -Encoding UTF8

Write-Host "Configuration example created at: $configDir/.env.example" -ForegroundColor Green

# Display access information
Write-Host ""
Write-Host "=== Secrets Management Monitoring Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  Grafana:           http://localhost:3000 (admin/soc_grafana_admin)" -ForegroundColor White
Write-Host "  Prometheus:        http://localhost:9090" -ForegroundColor White
Write-Host "  AlertManager:      http://localhost:9093" -ForegroundColor White
Write-Host "  Secrets Exporter:  http://localhost:9090/metrics" -ForegroundColor White

if ($Full -or $Local) {
    Write-Host "  Vault:             http://localhost:8200 (token: dev-root-token)" -ForegroundColor White
    Write-Host "  LocalStack:        http://localhost:4566" -ForegroundColor White
}

if ($Full -or $Production) {
    Write-Host "  Kibana:            http://localhost:5601" -ForegroundColor White
    Write-Host "  Jaeger:            http://localhost:16686" -ForegroundColor White
}

Write-Host ""
Write-Host "Dashboards:" -ForegroundColor Cyan
Write-Host "  - Secrets Operations Dashboard" -ForegroundColor White
Write-Host "  - Secrets Security Dashboard" -ForegroundColor White
Write-Host "  - Provider Health Dashboard" -ForegroundColor White

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure your services to use the secrets management system" -ForegroundColor White
Write-Host "  2. Import the monitoring package in your services" -ForegroundColor White
Write-Host "  3. Register provider health checkers" -ForegroundColor White
Write-Host "  4. Set up alerting rules for your environment" -ForegroundColor White
Write-Host "  5. Review and customize dashboard alerts" -ForegroundColor White

Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - packages/secrets/docs/MONITORING_INTEGRATION.md" -ForegroundColor White
Write-Host "  - packages/secrets/examples/monitoring-integration.ts" -ForegroundColor White

# Check if all services are running
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.yml -f docker-compose.secrets-monitoring.yml ps

Write-Host ""
Write-Host "Setup completed successfully! 🎉" -ForegroundColor Green