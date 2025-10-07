# PowerShell Auth Test Script
# Equivalent to test-auth.sh for Windows users

Write-Host "1. Registering user..." -ForegroundColor Green

$registerBody = @{
    email = "jwt.test@example.com"
    password = "Test123!@#"
    firstName = "JWT"
    lastName = "Test"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/register" `
        -Method Post -Body $registerBody -ContentType "application/json" `
        -ErrorAction Stop
    Write-Host "Registration successful" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User already exists, continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "Registration failed: $_" -ForegroundColor Red
    }
}

Write-Host "`n2. Logging in..." -ForegroundColor Green

$loginBody = @{
    email = "jwt.test@example.com"
    password = "Test123!@#"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
        -Method Post -Body $loginBody -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host "Login response:" -ForegroundColor Cyan
    $loginResponse | ConvertTo-Json -Depth 10
    
    $accessToken = $loginResponse.accessToken
    
    if (-not $accessToken) {
        Write-Host "Failed to get access token" -ForegroundColor Red
        exit 1
    }
    
    $tokenPreview = if ($accessToken.Length -gt 50) { 
        $accessToken.Substring(0, 50) + "..." 
    } else { 
        $accessToken 
    }
    Write-Host "`n3. Got token: $tokenPreview" -ForegroundColor Green
    
    # Test client service directly
    Write-Host "`n4. Testing client service with JWT..." -ForegroundColor Green
    $headers = @{
        "Authorization" = "Bearer $accessToken"
    }
    
    try {
        $clientsResponse = Invoke-RestMethod -Uri "http://localhost:3002/api/v1/clients" `
            -Headers $headers -ErrorAction Stop
        Write-Host "Direct client service response:" -ForegroundColor Cyan
        $clientsResponse | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Client service error: $_" -ForegroundColor Red
    }
    
    # Test through Kong
    Write-Host "`n5. Testing client service through Kong..." -ForegroundColor Green
    try {
        $kongResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/clients/clients" `
            -Headers $headers -ErrorAction Stop
        Write-Host "Kong gateway response:" -ForegroundColor Cyan
        $kongResponse | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Kong gateway error: $_" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nTest completed!" -ForegroundColor Green