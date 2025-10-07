# Setup Keycloak Client for Auth Service
Write-Host "Setting up Keycloak client for authentication..." -ForegroundColor Cyan

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
    
    # Create client configuration
    $clientConfig = @{
        clientId = "soc-auth-service"
        name = "SOC Auth Service"
        description = "Auth service client for SOC compliance platform"
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
    } | ConvertTo-Json -Depth 10
    
    # Create the client
    $headers = @{
        Authorization = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    try {
        $createResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/master/clients" `
            -Method POST `
            -Headers $headers `
            -Body $clientConfig `
            -ErrorAction Stop
        
        Write-Host "✅ Client 'soc-auth-service' created successfully!" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "⚠️  Client already exists, updating..." -ForegroundColor Yellow
            
            # Get existing client
            $clientsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/master/clients?clientId=soc-auth-service" `
                -Method GET `
                -Headers $headers `
                -ErrorAction Stop
            
            if ($clientsResponse.Count -gt 0) {
                $clientId = $clientsResponse[0].id
                
                # Update client
                $updateConfig = $clientConfig | ConvertFrom-Json
                $updateConfig | Add-Member -MemberType NoteProperty -Name "id" -Value $clientId -Force
                
                Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/master/clients/$clientId" `
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
    Write-Host "Client Configuration:" -ForegroundColor Cyan
    Write-Host "  Client ID: soc-auth-service" -ForegroundColor Gray
    Write-Host "  Direct Access Grants: Enabled" -ForegroundColor Gray
    Write-Host "  Public Client: Yes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ Keycloak client setup complete!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to setup Keycloak client: $_" -ForegroundColor Red
    exit 1
}