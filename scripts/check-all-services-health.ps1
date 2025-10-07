# Comprehensive Service Health Check Script
# Checks all 11 microservices and infrastructure components
# Usage: .\check-all-services-health.ps1 [-Detailed] [-Fix]

param(
    [switch]$Detailed,
    [switch]$Fix,
    [switch]$ShowLogs
)

$ErrorActionPreference = "Continue"

# Color coding functions
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Warning { Write-Host $args[0] -ForegroundColor Yellow }
function Write-Error { Write-Host $args[0] -ForegroundColor Red }
function Write-Info { Write-Host $args[0] -ForegroundColor Cyan }

# Service definitions
$services = @(
    @{Name="PostgreSQL"; Type="Database"; Port=5432; Container="overmatch-digital-postgres-1"},
    @{Name="MongoDB"; Type="Database"; Port=27017; Container="overmatch-digital-mongodb-1"},
    @{Name="Redis"; Type="Cache"; Port=6379; Container="overmatch-digital-redis-1"},
    @{Name="Elasticsearch"; Type="Search"; Port=9200; Container="overmatch-digital-elasticsearch-1"},
    @{Name="Kafka"; Type="MessageQueue"; Port=9092; Container="overmatch-digital-kafka-1"},
    @{Name="Zookeeper"; Type="MessageQueue"; Port=2181; Container="overmatch-digital-zookeeper-1"},
    @{Name="Kong Gateway"; Type="Gateway"; Port=8000; Container="overmatch-digital-kong-1"},
    @{Name="Auth Service"; Type="Microservice"; Port=3001; Container="overmatch-digital-auth-service-1"; Database="soc_auth"},
    @{Name="Client Service"; Type="Microservice"; Port=3002; Container="overmatch-digital-client-service-1"; Database="soc_clients"},
    @{Name="Policy Service"; Type="Microservice"; Port=3003; Container="overmatch-digital-policy-service-1"; Database="soc_policies"},
    @{Name="Control Service"; Type="Microservice"; Port=3004; Container="overmatch-digital-control-service-1"; Database="soc_controls"},
    @{Name="Evidence Service"; Type="Microservice"; Port=3005; Container="overmatch-digital-evidence-service-1"; Database="soc_evidence"},
    @{Name="Workflow Service"; Type="Microservice"; Port=3006; Container="overmatch-digital-workflow-service-1"; Database="soc_workflows"},
    @{Name="Reporting Service"; Type="Microservice"; Port=3007; Container="overmatch-digital-reporting-service-1"; Database="soc_reporting"},
    @{Name="Audit Service"; Type="Microservice"; Port=3008; Container="overmatch-digital-audit-service-1"; Database="soc_audits"},
    @{Name="Integration Service"; Type="Microservice"; Port=3009; Container="overmatch-digital-integration-service-1"; Database="soc_integrations"},
    @{Name="Notification Service"; Type="Microservice"; Port=3010; Container="overmatch-digital-notification-service-1"; Database="soc_notifications"},
    @{Name="AI Service"; Type="Microservice"; Port=3011; Container="overmatch-digital-ai-service-1"; Database="soc_ai"}
)

$issues = @()
$healthStatus = @{
    Healthy = 0
    Unhealthy = 0
    Warning = 0
}

Write-Info "`n========================================="
Write-Info "   SOC Platform Health Check"
Write-Info "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Info "========================================="

# Check Docker Desktop
Write-Info "`n[Checking Docker Desktop...]"
$dockerRunning = $false
try {
    $dockerVersion = docker version --format "{{.Server.Version}}" 2>$null
    if ($dockerVersion) {
        Write-Success "✓ Docker Desktop is running (v$dockerVersion)"
        $dockerRunning = $true
        $healthStatus.Healthy++
    }
} catch {
    Write-Error "✗ Docker Desktop is not running!"
    $issues += "Docker Desktop is not running"
    $healthStatus.Unhealthy++
    
    if ($Fix) {
        Write-Warning "  → Attempting to start Docker Desktop..."
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
        Start-Sleep -Seconds 10
    }
}

if ($dockerRunning) {
    # Check each service
    Write-Info "`n[Checking Services...]"
    foreach ($service in $services) {
        Write-Host -NoNewline "Checking $($service.Name)... "
        
        # Check if container is running
        $containerStatus = docker ps --filter "name=$($service.Container)" --format "{{.Status}}" 2>$null
        
        if ($containerStatus -like "Up*") {
            # Container is running, check port
            $portOpen = $false
            try {
                $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue -InformationLevel Quiet
                $portOpen = $connection
            } catch {
                $portOpen = $false
            }
            
            if ($portOpen) {
                Write-Success "✓ Running"
                $healthStatus.Healthy++
                
                # Additional checks for specific services
                if ($Detailed) {
                    switch ($service.Type) {
                        "Database" {
                            if ($service.Name -eq "PostgreSQL" -and $service.Database) {
                                # Check if database exists
                                $dbExists = docker exec $service.Container psql -U soc_user -lqt 2>$null | Select-String $service.Database
                                if ($dbExists) {
                                    Write-Success "    → Database '$($service.Database)' exists"
                                } else {
                                    Write-Warning "    → Database '$($service.Database)' not found"
                                }
                            }
                        }
                        "Microservice" {
                            # Check health endpoint if available
                            try {
                                $health = Invoke-RestMethod -Uri "http://localhost:$($service.Port)/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
                                if ($health) {
                                    Write-Success "    → Health endpoint responding"
                                }
                            } catch {
                                Write-Warning "    → Health endpoint not responding"
                            }
                        }
                    }
                }
            } else {
                Write-Warning "⚠ Container running but port $($service.Port) not accessible"
                $issues += "$($service.Name): Port $($service.Port) not accessible"
                $healthStatus.Warning++
            }
        } else {
            Write-Error "✗ Not running"
            $issues += "$($service.Name) is not running"
            $healthStatus.Unhealthy++
            
            if ($Fix) {
                Write-Warning "  → Attempting to start $($service.Name)..."
                docker start $service.Container 2>$null
            }
        }
        
        # Show logs if requested and service is unhealthy
        if ($ShowLogs -and ($containerStatus -notlike "Up*" -or !$portOpen)) {
            Write-Warning "  Recent logs:"
            docker logs $service.Container --tail 5 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
    }
    
    # Check databases exist
    if ($Detailed) {
        Write-Info "`n[Checking Databases...]"
        $databases = @("soc_auth", "soc_clients", "soc_policies", "soc_controls", "soc_evidence", 
                      "soc_workflows", "soc_reporting", "soc_audits", "soc_integrations", 
                      "soc_notifications", "soc_ai")
        
        foreach ($db in $databases) {
            Write-Host -NoNewline "Database $db... "
            $dbExists = docker exec overmatch-digital-postgres-1 psql -U soc_user -lqt 2>$null | Select-String $db
            if ($dbExists) {
                Write-Success "✓ Exists"
                
                # Check for migrations
                $tables = docker exec overmatch-digital-postgres-1 psql -U soc_user -d $db -c "\dt" 2>$null
                $migrationTable = $tables | Select-String "migrations"
                if ($migrationTable) {
                    Write-Success "    → Migrations table found"
                } else {
                    Write-Warning "    → No migrations table"
                }
            } else {
                Write-Error "✗ Does not exist"
                $issues += "Database $db does not exist"
                
                if ($Fix) {
                    Write-Warning "  → Creating database $db..."
                    docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE $db;" 2>$null
                }
            }
        }
    }
    
    # Check connectivity between services
    if ($Detailed) {
        Write-Info "`n[Checking Service Connectivity...]"
        
        # Check if services can reach PostgreSQL
        Write-Host -NoNewline "Services → PostgreSQL... "
        $pgConnectable = docker exec overmatch-digital-auth-service-1 nc -zv postgres 5432 2>&1 | Select-String "succeeded"
        if ($pgConnectable) {
            Write-Success "✓ Connected"
        } else {
            Write-Error "✗ Connection failed"
            $issues += "Services cannot reach PostgreSQL"
        }
        
        # Check if services can reach Redis
        Write-Host -NoNewline "Services → Redis... "
        $redisConnectable = docker exec overmatch-digital-auth-service-1 nc -zv redis 6379 2>&1 | Select-String "succeeded"
        if ($redisConnectable) {
            Write-Success "✓ Connected"
        } else {
            Write-Error "✗ Connection failed"
            $issues += "Services cannot reach Redis"
        }
        
        # Check if services can reach Kafka
        Write-Host -NoNewline "Services → Kafka... "
        $kafkaConnectable = docker exec overmatch-digital-auth-service-1 nc -zv kafka 29092 2>&1 | Select-String "succeeded"
        if ($kafkaConnectable) {
            Write-Success "✓ Connected"
        } else {
            Write-Error "✗ Connection failed"
            $issues += "Services cannot reach Kafka"
        }
    }
}

# Frontend check (runs locally, not in Docker)
Write-Info "`n[Checking Frontend...]"
Write-Host -NoNewline "Frontend (Next.js)... "
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Success "✓ Running on port 3000"
        $healthStatus.Healthy++
    }
} catch {
    Write-Warning "⚠ Not running (run 'npm run dev' to start)"
    $healthStatus.Warning++
}

# Summary
Write-Info "`n========================================="
Write-Info "   Health Check Summary"
Write-Info "========================================="

$totalServices = $services.Count + 1  # +1 for frontend
Write-Host "`nTotal Services: $totalServices"
Write-Success "Healthy: $($healthStatus.Healthy)"
if ($healthStatus.Warning -gt 0) {
    Write-Warning "Warnings: $($healthStatus.Warning)"
}
if ($healthStatus.Unhealthy -gt 0) {
    Write-Error "Unhealthy: $($healthStatus.Unhealthy)"
}

# Overall health score
$healthPercentage = [math]::Round(($healthStatus.Healthy / $totalServices) * 100)
Write-Host "`nOverall Health: " -NoNewline
if ($healthPercentage -ge 90) {
    Write-Success "$healthPercentage% ✓"
} elseif ($healthPercentage -ge 70) {
    Write-Warning "$healthPercentage% ⚠"
} else {
    Write-Error "$healthPercentage% ✗"
}

# List issues
if ($issues.Count -gt 0) {
    Write-Error "`n[Issues Found]"
    foreach ($issue in $issues) {
        Write-Host "  • $issue" -ForegroundColor Red
    }
    
    if (!$Fix) {
        Write-Warning "`nRun with -Fix flag to attempt automatic fixes"
    }
} else {
    Write-Success "`n✓ All systems operational!"
}

# Quick commands
Write-Info "`n[Quick Commands]"
Write-Host "Start all services:    " -NoNewline
Write-Host "docker-compose up -d" -ForegroundColor Yellow
Write-Host "Stop all services:     " -NoNewline
Write-Host "docker-compose down" -ForegroundColor Yellow
Write-Host "View logs:            " -NoNewline
Write-Host "docker-compose logs -f [service-name]" -ForegroundColor Yellow
Write-Host "Restart a service:    " -NoNewline
Write-Host "docker restart [container-name]" -ForegroundColor Yellow
Write-Host "Run with details:     " -NoNewline
Write-Host ".\check-all-services-health.ps1 -Detailed" -ForegroundColor Yellow

# Exit with appropriate code
if ($healthStatus.Unhealthy -gt 0) {
    exit 1
} elseif ($healthStatus.Warning -gt 0) {
    exit 2
} else {
    exit 0
}