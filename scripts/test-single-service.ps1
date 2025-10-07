# Test single service startup
param(
    [string]$ServiceName = "client-service"
)

Write-Host "Testing $ServiceName..." -ForegroundColor Cyan

$servicePath = Join-Path $PSScriptRoot "services\$ServiceName"
if (-not (Test-Path $servicePath)) {
    Write-Host "Service not found: $servicePath" -ForegroundColor Red
    exit 1
}

Set-Location $servicePath

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "No .env file found" -ForegroundColor Yellow
} else {
    Write-Host ".env file exists" -ForegroundColor Green
}

# Test database connection
Write-Host "`nTesting database connection..." -ForegroundColor Yellow
node -e "
const { Client } = require('pg');
const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: 5432,
    user: 'soc_user',
    password: 'soc_pass',
    database: 'soc_' + '$ServiceName'.replace('-service', '').replace('-', '_')
});
client.connect()
    .then(() => {
        console.log('Database connection successful!');
        return client.end();
    })
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    });
"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database connection OK" -ForegroundColor Green
} else {
    Write-Host "Database connection FAILED" -ForegroundColor Red
}

# Start the service
Write-Host "`nStarting $ServiceName..." -ForegroundColor Yellow
Start-Process npm -ArgumentList "run", "start:dev" -NoNewWindow

Write-Host "Service starting. Check http://localhost:PORT/health in a few seconds" -ForegroundColor Green
Write-Host "To stop, use Ctrl+C in the service window" -ForegroundColor Yellow