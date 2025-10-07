# PowerShell script to run E2E tests for client-service with proper environment setup

# Set environment variables
$env:NODE_ENV = "test"
$env:PORT = "3098"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "5433"
$env:DB_USERNAME = "soc_user"
$env:DB_PASSWORD = "soc_pass"
$env:DB_NAME = "soc_clients_test"
$env:REDIS_HOST = "127.0.0.1"
$env:REDIS_PORT = "6380"
$env:REDIS_PASSWORD = "soc_redis_pass"
$env:KAFKA_BROKERS = "127.0.0.1:9093"
$env:KAFKA_CLIENT_ID = "client-service-e2e"
$env:KAFKA_GROUP_ID = "client-service-e2e-group"
$env:JWT_SECRET = "test-jwt-secret-key-for-e2e-testing"
$env:JWT_EXPIRES_IN = "30m"
$env:REFRESH_TOKEN_SECRET = "test-refresh-secret-key-for-e2e-testing"
$env:REFRESH_TOKEN_EXPIRES_IN = "7d"
$env:MONGODB_URI = "mongodb://127.0.0.1:27018/soc_clients_test"
$env:ELASTICSEARCH_NODE = "http://127.0.0.1:9201"

# Run Jest E2E tests
Write-Host "Running Client Service E2E tests..." -ForegroundColor Green
npx jest --config ./test/e2e/jest-e2e.json --runInBand --forceExit

# Check exit code
if ($LASTEXITCODE -ne 0) {
    Write-Host "E2E tests failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
} else {
    Write-Host "E2E tests completed successfully!" -ForegroundColor Green
}