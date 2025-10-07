# Stop All Services Script
Write-Host "Stopping all SOC Compliance Platform services..." -ForegroundColor Yellow

# Find and kill all Node.js processes running our services
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

$killedCount = 0

# Get all node processes
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    $proc = $_
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
    
    foreach ($service in $services) {
        if ($cmdLine -like "*$service*") {
            Write-Host "Stopping $service (PID: $($proc.Id))" -ForegroundColor Red
            Stop-Process -Id $proc.Id -Force
            $killedCount++
            break
        }
    }
}

if ($killedCount -gt 0) {
    Write-Host "Stopped $killedCount service(s)" -ForegroundColor Green
} else {
    Write-Host "No running services found" -ForegroundColor Yellow
}

# Optional: Stop Docker services
$response = Read-Host "`nStop Docker infrastructure services too? (y/N)"
if ($response -eq 'y') {
    Write-Host "Stopping Docker services..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "Docker services stopped" -ForegroundColor Green
}