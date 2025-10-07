# PowerShell script to test Control Service database connection

Write-Host "Testing Control Service Database Connection" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Test PostgreSQL connection
Write-Host "`n1. Testing PostgreSQL connection..." -ForegroundColor Yellow

try {
    docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_controls -c "SELECT 1 as test" | Out-String
    Write-Host "PostgreSQL connection successful!" -ForegroundColor Green
} catch {
    Write-Host "PostgreSQL connection failed: $_" -ForegroundColor Red
}

# Test Redis connection
Write-Host "`n2. Testing Redis connection..." -ForegroundColor Yellow

try {
    $redisTest = docker exec overmatch-digital-redis-1 redis-cli -a soc_redis_pass ping
    if ($redisTest -eq "PONG") {
        Write-Host "Redis connection successful!" -ForegroundColor Green
    } else {
        Write-Host "Redis connection failed: $redisTest" -ForegroundColor Red
    }
} catch {
    Write-Host "Redis connection failed: $_" -ForegroundColor Red
}

# Check Control Service environment
Write-Host "`n3. Checking Control Service environment..." -ForegroundColor Yellow

# Get the environment variables from the running container
try {
    $envVars = docker exec overmatch-digital-control-service-1 env | Select-String -Pattern "DB_|REDIS_"
    Write-Host "Environment variables:" -ForegroundColor Cyan
    $envVars | ForEach-Object { Write-Host $_ -ForegroundColor White }
} catch {
    Write-Host "Could not retrieve environment variables: $_" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Green