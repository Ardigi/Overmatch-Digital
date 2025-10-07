# Setup Keycloak Realm and Client for SOC Compliance Platform
Write-Host "Setting up Keycloak realm and client..." -ForegroundColor Cyan

# Get admin token
$adminBody = @{
    grant_type = "password"
    client_id = "admin-cli"
    username = "admin"
    password = "Admin123!@#"
}

$formData = ($adminBody.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'

try {
    $tokenResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/realms/master/protocol/openid-connect/token" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $formData `
        -ErrorAction Stop
    
    $adminToken = $tokenResponse.access_token
    Write-Host "✅ Got admin token" -ForegroundColor Green
    
    $headers = @{
        Authorization = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    # Create realm configuration
    $realmConfig = @{
        realm = "compliance-platform-realm"
        displayName = "SOC Compliance Platform"
        enabled = $true
        sslRequired = "external"
        registrationAllowed = $false
        loginWithEmailAllowed = $true
        duplicateEmailsAllowed = $false
        resetPasswordAllowed = $true
        editUsernameAllowed = $false
        bruteForceProtected = $true
        permanentLockout = $false
        maxFailureWaitSeconds = 900
        minimumQuickLoginWaitSeconds = 60
        waitIncrementSeconds = 60
        quickLoginCheckMilliSeconds = 1000
        maxDeltaTimeSeconds = 43200
        failureFactor = 5
        defaultSignatureAlgorithm = "RS256"
        offlineSessionMaxLifespanEnabled = $false
        offlineSessionMaxLifespan = 5184000
        clientSessionIdleTimeout = 0
        clientSessionMaxLifespan = 0
        accessTokenLifespan = 1800
        accessTokenLifespanForImplicitFlow = 900
        ssoSessionIdleTimeout = 1800
        ssoSessionMaxLifespan = 36000
        actionTokenGeneratedByAdminLifespan = 43200
        actionTokenGeneratedByUserLifespan = 300
    } | ConvertTo-Json -Depth 10
    
    # Create the realm
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms" `
            -Method POST `
            -Headers $headers `
            -Body $realmConfig `
            -ErrorAction Stop
        
        Write-Host "✅ Realm 'compliance-platform-realm' created successfully!" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "⚠️  Realm already exists" -ForegroundColor Yellow
        } else {
            throw $_
        }
    }
    
    # Create client in the new realm
    $clientConfig = @{
        clientId = "compliance-platform-client"
        name = "SOC Compliance Platform Client"
        description = "Main client for SOC compliance platform authentication"
        enabled = $true
        publicClient = $true
        directAccessGrantsEnabled = $true
        standardFlowEnabled = $true
        implicitFlowEnabled = $false
        serviceAccountsEnabled = $false
        protocol = "openid-connect"
        attributes = @{
            "access.token.lifespan" = "1800"
            "refresh.token.lifespan" = "3600"
        }
        defaultClientScopes = @(
            "openid"
            "profile"
            "email"
            "roles"
            "web-origins"
        )
        optionalClientScopes = @(
            "address"
            "phone"
            "offline_access"
        )
        redirectUris = @(
            "http://localhost:3000/*"
            "http://127.0.0.1:3000/*"
            "http://localhost:3001/*"
            "http://127.0.0.1:3001/*"
        )
        webOrigins = @(
            "http://localhost:3000"
            "http://127.0.0.1:3000"
            "http://localhost:3001"
            "http://127.0.0.1:3001"
        )
    } | ConvertTo-Json -Depth 10
    
    # Create the client in the new realm
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/compliance-platform-realm/clients" `
            -Method POST `
            -Headers $headers `
            -Body $clientConfig `
            -ErrorAction Stop
        
        Write-Host "✅ Client 'compliance-platform-client' created successfully!" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "⚠️  Client already exists, updating..." -ForegroundColor Yellow
            
            # Get existing client
            $clientsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/compliance-platform-realm/clients?clientId=compliance-platform-client" `
                -Method GET `
                -Headers $headers `
                -ErrorAction Stop
            
            if ($clientsResponse.Count -gt 0) {
                $clientId = $clientsResponse[0].id
                
                # Update client
                $updateConfig = $clientConfig | ConvertFrom-Json
                $updateConfig | Add-Member -MemberType NoteProperty -Name "id" -Value $clientId -Force
                
                Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/compliance-platform-realm/clients/$clientId" `
                    -Method PUT `
                    -Headers $headers `
                    -Body ($updateConfig | ConvertTo-Json -Depth 10) `
                    -ErrorAction Stop
                
                Write-Host "✅ Client updated successfully!" -ForegroundColor Green
            }
        } else {
            throw $_
        }
    }
    
    Write-Host ""
    Write-Host "Configuration Summary:" -ForegroundColor Cyan
    Write-Host "  Realm: compliance-platform-realm" -ForegroundColor Gray
    Write-Host "  Client ID: compliance-platform-client" -ForegroundColor Gray
    Write-Host "  Direct Access Grants: Enabled" -ForegroundColor Gray
    Write-Host "  Public Client: Yes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ Keycloak realm and client setup complete!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to setup Keycloak: $_" -ForegroundColor Red
    exit 1
}