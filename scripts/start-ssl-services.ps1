# Start SOC Compliance Platform with SSL/TLS enabled
# PowerShell script for Windows development environment

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipCertGeneration = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Production = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Detached = $true
)

Write-Host "SOC Compliance Platform - SSL Services Startup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Set working directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

# Generate certificates if needed
if (-not $SkipCertGeneration) {
    $certPath = Join-Path $projectRoot "gateway\certificates\dev\server-cert.pem"
    
    if (-not (Test-Path $certPath)) {
        Write-Host "`nGenerating SSL certificates..." -ForegroundColor Yellow
        
        Push-Location "gateway\certificates"
        try {
            if ($Production) {
                .\generate-certs.ps1 -Production
            } else {
                .\generate-certs.ps1
            }
        } catch {
            Write-Host "ERROR: Failed to generate certificates: $_" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
        
        Write-Host "Certificates generated successfully!" -ForegroundColor Green
    } else {
        Write-Host "Using existing SSL certificates" -ForegroundColor Yellow
    }
}

# Stop existing containers
Write-Host "`nStopping existing containers..." -ForegroundColor Yellow
docker-compose down

# Start services with SSL configuration
Write-Host "`nStarting services with SSL enabled..." -ForegroundColor Yellow

$composeFiles = @("docker-compose.yml", "docker-compose.ssl.yml")
$composeArgs = @()

foreach ($file in $composeFiles) {
    $composeArgs += "-f"
    $composeArgs += $file
}

$composeArgs += "up"

if ($Detached) {
    $composeArgs += "-d"
}

# Build and start services
Write-Host "Building and starting services..." -ForegroundColor Yellow
docker-compose $composeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start services" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "`nWaiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host "`nChecking service health..." -ForegroundColor Yellow

$services = @(
    @{Name="Kong Gateway"; Url="https://localhost/health"; SkipCertCheck=$true},
    @{Name="Frontend"; Url="https://localhost:3443/"; SkipCertCheck=$true},
    @{Name="API Gateway"; Url="https://api.localhost/"; SkipCertCheck=$true},
    @{Name="Auth Service"; Url="https://auth.localhost/health"; SkipCertCheck=$true}
)

$allHealthy = $true

foreach ($service in $services) {
    Write-Host -NoNewline "Checking $($service.Name)... "
    
    try {
        if ($service.SkipCertCheck) {
            $response = Invoke-WebRequest -Uri $service.Url -Method Head -SkipCertificateCheck -TimeoutSec 5 -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $service.Url -Method Head -TimeoutSec 5 -ErrorAction Stop
        }
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404) {
            Write-Host "OK" -ForegroundColor Green
        } else {
            Write-Host "WARNING (Status: $($response.StatusCode))" -ForegroundColor Yellow
            $allHealthy = $false
        }
    } catch {
        Write-Host "FAILED" -ForegroundColor Red
        $allHealthy = $false
    }
}

# Display access information
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "SSL Services Started Successfully!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`nAccess Points (HTTPS):" -ForegroundColor Yellow
Write-Host "  Frontend:        https://localhost:3443" -ForegroundColor White
Write-Host "  API Gateway:     https://api.localhost" -ForegroundColor White
Write-Host "  Auth Service:    https://auth.localhost" -ForegroundColor White
Write-Host "  Kong Admin:      http://localhost:8001" -ForegroundColor White

Write-Host "`nSSL Certificate Info:" -ForegroundColor Yellow
Write-Host "  CA Certificate:  gateway\certificates\dev\ca-cert.pem" -ForegroundColor White
Write-Host "  Server Cert:     gateway\certificates\dev\server-cert.pem" -ForegroundColor White

if (-not $allHealthy) {
    Write-Host "`nWARNING: Some services may still be starting up." -ForegroundColor Yellow
    Write-Host "Run '.\scripts\check-local-health.ps1' to check again." -ForegroundColor Yellow
}

Write-Host "`nTips:" -ForegroundColor Cyan
Write-Host "  - Import CA certificate to browser for trusted HTTPS" -ForegroundColor White
Write-Host "  - View logs: docker-compose logs -f [service-name]" -ForegroundColor White
Write-Host "  - Stop services: docker-compose down" -ForegroundColor White
Write-Host "  - Health check: .\scripts\check-local-health.ps1" -ForegroundColor White