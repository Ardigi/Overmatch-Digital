# Start Monitoring Dashboard
# Launches the real-time monitoring dashboard for the SOC Compliance Platform
# Usage: .\start-monitoring-dashboard.ps1 [-Port 4000] [-OpenBrowser]

param(
    [int]$Port = 4000,
    [switch]$OpenBrowser,
    [switch]$Background
)

$ErrorActionPreference = "Stop"

# Color functions
function Write-Step { Write-Host "`n→ $($args[0])" -ForegroundColor Cyan }
function Write-Success { Write-Host "✓ $($args[0])" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠ $($args[0])" -ForegroundColor Yellow }
function Write-Error { Write-Host "✗ $($args[0])" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $($args[0])" -ForegroundColor Blue }

# Banner
Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║           SOC Platform Monitoring Dashboard                 ║
║           Real-time Service Health & Metrics                ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Info "Starting monitoring dashboard on port $Port"

# Step 1: Check if monitoring directory exists
Write-Step "Step 1: Checking monitoring directory"

$monitoringPath = Join-Path (Get-Location) "monitoring\dashboard"
if (!(Test-Path $monitoringPath)) {
    Write-Error "Monitoring dashboard not found at: $monitoringPath"
    Write-Info "Please ensure you're in the project root directory"
    exit 1
}

Write-Success "Monitoring directory found"

# Step 2: Install dependencies if needed
Write-Step "Step 2: Checking dependencies"

Push-Location $monitoringPath

if (!(Test-Path "node_modules")) {
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install dependencies"
        Pop-Location
        exit 1
    }
    Write-Success "Dependencies installed"
} else {
    Write-Success "Dependencies already installed"
}

# Step 3: Check if port is available
Write-Step "Step 3: Checking port availability"

$portInUse = netstat -ano | findstr ":$Port"
if ($portInUse) {
    Write-Warning "Port $Port is already in use"
    
    # Try to find the process
    $lines = $portInUse -split "`n"
    foreach ($line in $lines) {
        if ($line -match "LISTENING\s+(\d+)") {
            $pid = $matches[1]
            Write-Info "Process ID using port: $pid"
            
            $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($process) {
                Write-Info "Process name: $($process.Name)"
            }
        }
    }
    
    Write-Error "Please choose a different port or stop the existing process"
    Pop-Location
    exit 1
}

Write-Success "Port $Port is available"

# Step 4: Check service availability
Write-Step "Step 4: Checking service health"

$services = @(
    @{Name="PostgreSQL"; Port=5432},
    @{Name="Redis"; Port=6379},
    @{Name="Auth Service"; Port=3001},
    @{Name="Client Service"; Port=3002}
)

$healthyCount = 0
foreach ($service in $services) {
    Write-Host -NoNewline "Checking $($service.Name)... "
    
    $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue -InformationLevel Quiet
    
    if ($connection) {
        Write-Success "Available"
        $healthyCount++
    } else {
        Write-Warning "Not responding"
    }
}

if ($healthyCount -eq 0) {
    Write-Warning "No services are running. Dashboard will show limited data."
} else {
    Write-Info "$healthyCount of $($services.Count) services are healthy"
}

# Step 5: Start the monitoring dashboard
Write-Step "Step 5: Starting monitoring dashboard"

# Set environment variables
$env:MONITORING_PORT = $Port
$env:NODE_ENV = "production"

if ($Background) {
    Write-Info "Starting dashboard in background..."
    
    Start-Process node -ArgumentList "server.js" -WorkingDirectory $monitoringPath -WindowStyle Hidden
    
    Write-Success "Dashboard started in background"
} else {
    Write-Info "Starting dashboard in foreground..."
    Write-Info "Press Ctrl+C to stop the dashboard"
    
    # Start in current window
    try {
        node server.js
    } catch {
        Write-Error "Dashboard stopped or encountered an error"
    }
}

# Step 6: Open in browser if requested
if ($OpenBrowser) {
    Write-Step "Step 6: Opening dashboard in browser"
    
    Start-Sleep -Seconds 2  # Give server time to start
    
    $url = "http://localhost:$Port"
    Write-Info "Opening $url"
    
    Start-Process $url
    
    Write-Success "Dashboard opened in default browser"
}

Pop-Location

# Final message
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         ✓ MONITORING DASHBOARD STARTED                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Success "`nMonitoring dashboard is running!"

Write-Host "`n📊 Dashboard Access:" -ForegroundColor Cyan
Write-Host "Web Interface:    " -NoNewline
Write-Host "http://localhost:$Port" -ForegroundColor Yellow
Write-Host "API Endpoint:     " -NoNewline
Write-Host "http://localhost:$Port/api/metrics" -ForegroundColor Yellow
Write-Host "WebSocket:        " -NoNewline
Write-Host "ws://localhost:$Port" -ForegroundColor Yellow

Write-Host "`n📋 Available Endpoints:" -ForegroundColor Cyan
Write-Host "GET  /api/metrics              - All metrics" -ForegroundColor White
Write-Host "GET  /api/services             - Service health" -ForegroundColor White
Write-Host "GET  /api/infrastructure       - Infrastructure status" -ForegroundColor White
Write-Host "GET  /api/alerts               - Recent alerts" -ForegroundColor White
Write-Host "GET  /api/metrics/response-time - Response time history" -ForegroundColor White
Write-Host "GET  /api/metrics/throughput   - Throughput metrics" -ForegroundColor White

Write-Host "`n🔧 Troubleshooting:" -ForegroundColor Cyan
Write-Host "If services show as unhealthy, ensure they are running" -ForegroundColor White
Write-Host "Check logs:       " -NoNewline
Write-Host "monitoring/dashboard/logs/" -ForegroundColor Yellow
Write-Host "Restart:          " -NoNewline
Write-Host ".\start-monitoring-dashboard.ps1 -Port $Port" -ForegroundColor Yellow

if (!$Background) {
    Write-Host "`n" -NoNewline
    Write-Warning "Dashboard is running in foreground. Press Ctrl+C to stop."
}