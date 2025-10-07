# Start Monitoring Stack for SOC Compliance Platform
# This script starts all monitoring and observability services

param(
    [switch]$Detach = $false,
    [switch]$Build = $false,
    [switch]$Fresh = $false
)

Write-Host "Starting SOC Platform Monitoring Stack..." -ForegroundColor Cyan

# Set error action preference
$ErrorActionPreference = "Stop"

# Check if Docker is running
try {
    docker version | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
    # Create required directories
    Write-Host "Creating monitoring directories..." -ForegroundColor Yellow
    $directories = @(
        "monitoring/prometheus",
        "monitoring/grafana/provisioning/datasources",
        "monitoring/grafana/provisioning/dashboards",
        "monitoring/grafana/dashboards",
        "monitoring/alertmanager",
        "monitoring/logstash/pipeline",
        "monitoring/logstash/config",
        "monitoring/otel-collector"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }

    # Clean up if requested
    if ($Fresh) {
        Write-Host "Cleaning up existing monitoring data..." -ForegroundColor Yellow
        docker-compose -f docker/monitoring/docker-compose.monitoring.yml down -v
    }

    # Build if requested
    if ($Build) {
        Write-Host "Building monitoring images..." -ForegroundColor Yellow
        docker-compose -f docker/monitoring/docker-compose.monitoring.yml build
    }

    # Start monitoring stack
    Write-Host "Starting monitoring services..." -ForegroundColor Yellow
    if ($Detach) {
        docker-compose -f docker/monitoring/docker-compose.monitoring.yml up -d
    } else {
        docker-compose -f docker/monitoring/docker-compose.monitoring.yml up
    }

    if ($Detach) {
        # Wait for services to be healthy
        Write-Host "`nWaiting for services to be healthy..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10

        # Check service health
        Write-Host "`nChecking service status:" -ForegroundColor Green
        docker-compose -f docker/monitoring/docker-compose.monitoring.yml ps

        # Display access information
        Write-Host "`n=== Monitoring Stack Access URLs ===" -ForegroundColor Cyan
        Write-Host "Grafana:       http://localhost:3100" -ForegroundColor Green
        Write-Host "               Username: admin" -ForegroundColor Gray
        Write-Host "               Password: soc_grafana_admin" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Prometheus:    http://localhost:9090" -ForegroundColor Green
        Write-Host "Kibana:        http://localhost:5601" -ForegroundColor Green
        Write-Host "Jaeger:        http://localhost:16686" -ForegroundColor Green
        Write-Host "AlertManager:  http://localhost:9093" -ForegroundColor Green
        Write-Host ""
        Write-Host "Metrics Endpoints:" -ForegroundColor Yellow
        Write-Host "  Auth Service:         http://localhost:3001/metrics"
        Write-Host "  Client Service:       http://localhost:3002/metrics"
        Write-Host "  Policy Service:       http://localhost:3003/metrics"
        Write-Host "  Control Service:      http://localhost:3004/metrics"
        Write-Host "  Evidence Service:     http://localhost:3005/metrics"
        Write-Host "  Workflow Service:     http://localhost:3006/metrics"
        Write-Host "  Reporting Service:    http://localhost:3007/metrics"
        Write-Host "  Audit Service:        http://localhost:3008/metrics"
        Write-Host "  Integration Service:  http://localhost:3009/metrics"
        Write-Host "  Notification Service: http://localhost:3010/metrics"
        Write-Host "  AI Service:           http://localhost:3011/metrics"
        Write-Host ""
        Write-Host "=== Monitoring Stack Started Successfully ===" -ForegroundColor Green
    }

} catch {
    Write-Host "Error starting monitoring stack: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# Usage instructions
if ($Detach) {
    Write-Host "`nTo view logs:" -ForegroundColor Cyan
    Write-Host "  docker-compose -f docker/monitoring/docker-compose.monitoring.yml logs -f [service-name]" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To stop monitoring stack:" -ForegroundColor Cyan
    Write-Host "  docker-compose -f docker/monitoring/docker-compose.monitoring.yml down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To check metrics collection:" -ForegroundColor Cyan
    Write-Host "  curl http://localhost:9090/api/v1/targets" -ForegroundColor Gray
}