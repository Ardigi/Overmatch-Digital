# Setup Keycloak realm and client

Write-Host "Setting up Keycloak soc-compliance realm..." -ForegroundColor Cyan

# Get admin token
$tokenResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/realms/master/protocol/openid-connect/token" `
    -Method POST `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
        grant_type = "password"
        client_id = "admin-cli"
        username = "admin"
        password = "admin"
    }

$token = $tokenResponse.access_token
Write-Host "Got admin token" -ForegroundColor Green

# Create realm
$realmBody = @{
    realm = "soc-compliance"
    enabled = $true
    sslRequired = "external"
    registrationAllowed = $false
    loginWithEmailAllowed = $true
    duplicateEmailsAllowed = $false
    resetPasswordAllowed = $true
    editUsernameAllowed = $false
    bruteForceProtected = $true
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms" `
        -Method POST `
        -Headers $headers `
        -Body $realmBody
    
    Write-Host "Created soc-compliance realm" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Realm already exists" -ForegroundColor Yellow
    } else {
        Write-Host "Failed to create realm: $_" -ForegroundColor Red
        exit 1
    }
}

# Create client for auth-service
$clientBody = @{
    clientId = "auth-service"
    enabled = $true
    publicClient = $false
    serviceAccountsEnabled = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    implicitFlowEnabled = $false
    protocol = "openid-connect"
    bearerOnly = $false
    secret = "auth-service-secret"
    redirectUris = @("http://localhost:3001/*")
    webOrigins = @("http://localhost:3001")
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/soc-compliance/clients" `
        -Method POST `
        -Headers $headers `
        -Body $clientBody
    
    Write-Host "Created auth-service client" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Client already exists" -ForegroundColor Yellow
    } else {
        Write-Host "Failed to create client: $_" -ForegroundColor Red
    }
}

# Create a test user
$userBody = @{
    username = "admin@soc-compliance.com"
    email = "admin@soc-compliance.com"
    emailVerified = $true
    enabled = $true
    firstName = "Admin"
    lastName = "User"
    credentials = @(
        @{
            type = "password"
            value = "Admin@123!"
            temporary = $false
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/soc-compliance/users" `
        -Method POST `
        -Headers $headers `
        -Body $userBody
    
    Write-Host "Created test user admin@soc-compliance.com" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "User already exists" -ForegroundColor Yellow
    } else {
        Write-Host "Failed to create user: $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ Keycloak setup complete!" -ForegroundColor Green
Write-Host "Realm: soc-compliance" -ForegroundColor Yellow
Write-Host "Client: auth-service" -ForegroundColor Yellow
Write-Host "User: admin@soc-compliance.com / Admin@123!" -ForegroundColor Yellow