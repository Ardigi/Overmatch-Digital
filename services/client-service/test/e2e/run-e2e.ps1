# Run E2E Tests PowerShell Script

# Load environment variables from test.env
$envFile = Join-Path $PSScriptRoot "test.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# Navigate to service directory
$servicePath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $servicePath

# Run the E2E tests
Write-Host "Running Client Service E2E Tests..." -ForegroundColor Green
Write-Host "Test Database: $env:DB_HOST`:$env:DB_PORT/$env:DB_NAME" -ForegroundColor Yellow
Write-Host "Redis: $env:REDIS_HOST`:$env:REDIS_PORT" -ForegroundColor Yellow
Write-Host "Kafka: $env:KAFKA_BROKERS" -ForegroundColor Yellow

# Execute tests
npx jest --config ./test/e2e/jest-e2e.json --runInBand --forceExit --detectOpenHandles