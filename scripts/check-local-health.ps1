# Health Check Script for SOC Compliance Platform
param(
    [switch]$Detailed = $false,
    [switch]$WaitForServices = $false,
    [int]$MaxWaitTime = 60
)

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host " SOC Compliance Platform Health Check" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Function to test service health
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [string]$HealthUrl,
        [int]$ExpectedStatus = 200
    )
    
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "✓ $ServiceName is healthy" -ForegroundColor Green
            if ($Detailed) {
                $content = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($content) {
                    Write-Host "  Status: $($content.status)" -ForegroundColor Gray
                }
            }
            return $true
        } else {
            Write-Host "✗ $ServiceName returned status $($response.StatusCode)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "✗ $ServiceName is not responding" -ForegroundColor Red
        if ($Detailed) {
            Write-Host "  Error: $_" -ForegroundColor Gray
        }
        return $false
    }
}

# Function to check port
function Test-Port {
    param([int]$Port, [string]$ServiceName)
    
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        Write-Host "✓ $ServiceName is listening on port $Port" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ $ServiceName is not listening on port $Port" -ForegroundColor Red
        return $false
    }
}

# Function to check PostgreSQL
function Test-PostgreSQL {
    param([string]$Password = "postgres")
    
    $env:PGPASSWORD = $Password
    try {
        $result = & psql -h localhost -U postgres -d postgres -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
            if ($Detailed) {
                $version = ($result | Where-Object { $_ -match "PostgreSQL" }) -join ""
                Write-Host "  Version: $version" -ForegroundColor Gray
            }
            
            # Check databases
            $databases = @("soc_auth", "soc_clients", "soc_policies", "soc_controls")
            $dbCheck = & psql -h localhost -U postgres -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'soc_%';" 2>&1
            $existingDbs = $dbCheck -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            
            Write-Host "  Databases found: $($existingDbs.Count)" -ForegroundColor Gray
            if ($Detailed) {
                foreach ($db in $existingDbs) {
                    Write-Host "    - $db" -ForegroundColor Gray
                }
            }
            return $true
        } else {
            throw "PostgreSQL command failed"
        }
    } catch {
        Write-Host "✗ PostgreSQL is not accessible" -ForegroundColor Red
        return $false
    }
}

# Wait for services if requested
if ($WaitForServices) {
    Write-Host "Waiting for services to start (max $MaxWaitTime seconds)..." -ForegroundColor Yellow
    $waited = 0
    while ($waited -lt $MaxWaitTime) {
        $authRunning = Test-Port -Port 3001 -ServiceName "Auth" 
        if ($authRunning) {
            Write-Host "Services are starting up!" -ForegroundColor Green
            Start-Sleep -Seconds 5
            break
        }
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host "." -NoNewline
    }
    Write-Host ""
}

# Check Infrastructure Services
Write-Host "`n[Infrastructure Services]" -ForegroundColor Yellow

# PostgreSQL
$pgStatus = Test-PostgreSQL

# Redis
$redisStatus = Test-Port -Port 6379 -ServiceName "Redis"

# Kafka
$kafkaStatus = Test-Port -Port 9092 -ServiceName "Kafka"

# Kong Gateway
$kongStatus = Test-Port -Port 8000 -ServiceName "Kong Gateway"

# MinIO
$minioStatus = Test-Port -Port 9000 -ServiceName "MinIO (S3)"
if ($minioStatus -and $Detailed) {
    Test-Port -Port 9001 -ServiceName "MinIO Console"
}

# ElasticSearch
$elasticStatus = Test-Port -Port 9200 -ServiceName "ElasticSearch"

# Check Microservices
Write-Host "`n[Microservices]" -ForegroundColor Yellow

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

$serviceStatus = @{}
foreach ($service in $services.GetEnumerator()) {
    $serviceStatus[$service.Key] = Test-ServiceHealth -ServiceName $service.Key -HealthUrl $service.Value.Health
}

# Check Frontend
Write-Host "`n[Frontend]" -ForegroundColor Yellow
$serviceStatus["Frontend"] = Test-Port -Port 3000 -ServiceName "Next.js Frontend"

# Test Auth endpoint if service is running
if ($serviceStatus["Auth Service"] -and $Detailed) {
    Write-Host "`n[Auth Endpoint Test]" -ForegroundColor Yellow
    try {
        $loginTest = Invoke-WebRequest -Uri "http://localhost:3001/auth/login" -Method POST `
            -ContentType "application/json" `
            -Body '{"email":"test@example.com","password":"test"}' `
            -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "✓ Auth login endpoint accessible" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 400) {
            Write-Host "✓ Auth login endpoint accessible (returns expected error)" -ForegroundColor Green
        } else {
            Write-Host "✗ Auth login endpoint not working properly" -ForegroundColor Red
        }
    }
}

# Summary
Write-Host "`n[Summary]" -ForegroundColor Cyan
$totalServices = $serviceStatus.Count
$runningServices = ($serviceStatus.GetEnumerator() | Where-Object { $_.Value }).Count
Write-Host "Services Running: $runningServices/$totalServices" -ForegroundColor $(if ($runningServices -eq $totalServices) { "Green" } elseif ($runningServices -gt 0) { "Yellow" } else { "Red" })

# Infrastructure Summary
$infraRunning = @($pgStatus, $redisStatus, $kafkaStatus, $kongStatus, $minioStatus, $elasticStatus) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
Write-Host "Infrastructure: $infraRunning/6 components running" -ForegroundColor $(if ($infraRunning -eq 6) { "Green" } elseif ($infraRunning -gt 3) { "Yellow" } else { "Red" })

# Quick start suggestions
if ($runningServices -lt $totalServices) {
    Write-Host "`n[Quick Start Commands]" -ForegroundColor Yellow
    
    if (-not $pgStatus -or -not $redisStatus -or -not $kafkaStatus) {
        Write-Host "- Start infrastructure: .\start-docker-services.ps1" -ForegroundColor White
    }
    
    if (-not $serviceStatus["Auth Service"]) {
        Write-Host "- Start all services: cd services && npm run dev" -ForegroundColor White
    }
    
    if (-not $serviceStatus["Frontend"]) {
        Write-Host "- Start frontend with: npm run dev" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Run with -Detailed flag for more information" -ForegroundColor Gray
Write-Host "Run with -WaitForServices to wait for services to start" -ForegroundColor Gray