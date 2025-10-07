# Simple Health Check Script for SOC Compliance Platform
param(
    [switch]$Detailed = $false
)

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host " SOC Compliance Platform Health Check" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is open
function Test-Port {
    param(
        [int]$Port, 
        [string]$ServiceName
    )
    
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        Write-Host "$ServiceName is listening on port $Port [OK]" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "$ServiceName is not listening on port $Port [FAIL]" -ForegroundColor Red
        return $false
    }
}

# Function to check service health endpoint
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [string]$HealthUrl
    )
    
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "$ServiceName health check passed [OK]" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "$ServiceName returned status $($response.StatusCode) [FAIL]" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "$ServiceName is not responding [FAIL]" -ForegroundColor Red
        if ($Detailed) {
            Write-Host "  Error: $_" -ForegroundColor Gray
        }
        return $false
    }
}

# Infrastructure Services
Write-Host "[Infrastructure Services]" -ForegroundColor Yellow
Write-Host ""

$infra = @{
    "PostgreSQL" = 5432
    "Redis" = 6379
    "Kafka" = 9092
    "Kong Gateway" = 8000
    "MinIO" = 9000
    "ElasticSearch" = 9200
}

$infraResults = @{}
foreach ($service in $infra.GetEnumerator()) {
    $infraResults[$service.Key] = Test-Port -Port $service.Value -ServiceName $service.Key
}

# Microservices
Write-Host ""
Write-Host "[Microservices]" -ForegroundColor Yellow
Write-Host ""

$services = @{
    "Auth Service" = @{Port = 3001; Health = "http://localhost:3001/health"}
    "Client Service" = @{Port = 3002; Health = "http://localhost:3002/health"}
    "Policy Service" = @{Port = 3003; Health = "http://localhost:3003/health"}
    "Control Service" = @{Port = 3004; Health = "http://localhost:3004/health"}
    "Evidence Service" = @{Port = 3005; Health = "http://localhost:3005/health"}
    "Workflow Service" = @{Port = 3006; Health = "http://localhost:3006/health"}
    "Reporting Service" = @{Port = 3007; Health = "http://localhost:3007/health"}
    "Audit Service" = @{Port = 3008; Health = "http://localhost:3008/health"}
    "Integration Service" = @{Port = 3009; Health = "http://localhost:3009/health"}
    "Notification Service" = @{Port = 3010; Health = "http://localhost:3010/health"}
    "AI Service" = @{Port = 3011; Health = "http://localhost:3011/health"}
}

$serviceResults = @{}
foreach ($service in $services.GetEnumerator()) {
    $serviceResults[$service.Key] = Test-ServiceHealth -ServiceName $service.Key -HealthUrl $service.Value.Health
}

# Frontend
Write-Host ""
Write-Host "[Frontend]" -ForegroundColor Yellow
Write-Host ""
$frontendOk = Test-Port -Port 3000 -ServiceName "Next.js Frontend"

# Summary
Write-Host ""
Write-Host "[Summary]" -ForegroundColor Cyan
Write-Host ""

# Count running services
$runningInfra = ($infraResults.GetEnumerator() | Where-Object { $_.Value }).Count
$totalInfra = $infraResults.Count
$runningServices = ($serviceResults.GetEnumerator() | Where-Object { $_.Value }).Count
$totalServices = $serviceResults.Count

Write-Host "Infrastructure: $runningInfra/$totalInfra components running" -ForegroundColor $(if ($runningInfra -eq $totalInfra) { "Green" } elseif ($runningInfra -gt 3) { "Yellow" } else { "Red" })
Write-Host "Microservices: $runningServices/$totalServices services running" -ForegroundColor $(if ($runningServices -eq $totalServices) { "Green" } elseif ($runningServices -gt 0) { "Yellow" } else { "Red" })
Write-Host "Frontend: $(if ($frontendOk) { 'Running' } else { 'Not Running' })" -ForegroundColor $(if ($frontendOk) { "Green" } else { "Red" })

# Quick start suggestions
if ($runningInfra -lt $totalInfra -or $runningServices -lt $totalServices -or -not $frontendOk) {
    Write-Host ""
    Write-Host "[Quick Start Commands]" -ForegroundColor Yellow
    Write-Host ""
    
    if ($runningInfra -lt $totalInfra) {
        Write-Host "Start infrastructure:" -ForegroundColor White
        Write-Host "  .\start-docker-services.ps1" -ForegroundColor Gray
    }
    
    if ($runningServices -lt $totalServices) {
        Write-Host "Start all services:" -ForegroundColor White
        Write-Host "  cd services" -ForegroundColor Gray
        Write-Host "  npm run dev" -ForegroundColor Gray
    }
    
    if (-not $frontendOk) {
        Write-Host "Start frontend:" -ForegroundColor White
        Write-Host "  npm run dev" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Run with -Detailed flag for more information" -ForegroundColor Gray
Write-Host ""