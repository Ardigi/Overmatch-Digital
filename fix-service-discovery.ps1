# Fix Service Discovery Configuration Script
# This script fixes service identification for all 11 microservices

Write-Host "Fixing service discovery configuration for all services..." -ForegroundColor Green

# Define service mappings (service-name -> port)
$services = @{
    "client-service" = 3002
    "policy-service" = 3003
    "control-service" = 3004
    "workflow-service" = 3006
    "reporting-service" = 3007
    "audit-service" = 3008
    "integration-service" = 3009
    "notification-service" = 3010
    "ai-service" = 3011
}

foreach ($service in $services.GetEnumerator()) {
    $serviceName = $service.Key
    $port = $service.Value
    $servicePath = "services\$serviceName"
    
    Write-Host "Processing $serviceName..." -ForegroundColor Yellow
    
    if (Test-Path $servicePath) {
        # Update .env.example file
        $envFile = "$servicePath\.env.example"
        if (Test-Path $envFile) {
            Write-Host "  Updating $envFile"
            $envContent = Get-Content $envFile -Raw
            
            # Add SERVICE_NAME if not present
            if ($envContent -notmatch "SERVICE_NAME=") {
                $envContent = $envContent -replace "(PORT=$port)", "SERVICE_NAME=$serviceName`nPORT=$port`nSERVICE_PORT=$port"
                Set-Content -Path $envFile -Value $envContent -NoNewline
            }
        }
        
        # Update main.ts file
        $mainFile = "$servicePath\src\main.ts"
        if (Test-Path $mainFile) {
            Write-Host "  Updating $mainFile"
            $mainContent = Get-Content $mainFile -Raw
            
            # Add service identification if not present
            if ($mainContent -notmatch "process\.env\.SERVICE_NAME") {
                $bootstrapPattern = "async function bootstrap\(\) \{[^{]*\{"
                $replacement = @"
async function bootstrap() {
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = '$serviceName';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '$port';
    process.env.SERVICE_PORT = '$port';
  }

"@
                $mainContent = $mainContent -replace $bootstrapPattern, $replacement
                Set-Content -Path $mainFile -Value $mainContent -NoNewline
            }
        }
    } else {
        Write-Host "  Service directory not found: $servicePath" -ForegroundColor Red
    }
}

Write-Host "Service discovery configuration fixed!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy .env.example to .env for each service if needed"
Write-Host "2. Start services and test inter-service communication"
Write-Host "3. Check health endpoints and service discovery logs"