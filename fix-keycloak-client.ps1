# Fix Keycloak Client Configuration
Write-Host "Fixing Keycloak client configuration..." -ForegroundColor Cyan

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
    
    # Get existing client
    $headers = @{
        Authorization = "Bearer $adminToken"
    }
    
    $clientsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/master/clients?clientId=soc-auth-service" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($clientsResponse.Count -gt 0) {
        $client = $clientsResponse[0]
        $clientId = $client.id
        
        Write-Host "Found client: $($client.clientId) (ID: $clientId)" -ForegroundColor Gray
        Write-Host "Current settings:" -ForegroundColor Gray
        Write-Host "  - Public Client: $($client.publicClient)" -ForegroundColor Gray
        Write-Host "  - Direct Access Grants: $($client.directAccessGrantsEnabled)" -ForegroundColor Gray
        Write-Host "  - Standard Flow: $($client.standardFlowEnabled)" -ForegroundColor Gray
        
        # Update client configuration
        $client.publicClient = $true
        $client.directAccessGrantsEnabled = $true
        $client.standardFlowEnabled = $true
        $client.implicitFlowEnabled = $false
        $client.serviceAccountsEnabled = $false
        $client.authorizationServicesEnabled = $false
        
        # Remove properties that shouldn't be in the update
        $client.PSObject.Properties.Remove('access')
        $client.PSObject.Properties.Remove('authenticationFlowBindingOverrides')
        
        $updateBody = $client | ConvertTo-Json -Depth 10
        
        Invoke-RestMethod -Uri "http://127.0.0.1:8180/admin/realms/master/clients/$clientId" `
            -Method PUT `
            -Headers @{
                Authorization = "Bearer $adminToken"
                "Content-Type" = "application/json"
            } `
            -Body $updateBody `
            -ErrorAction Stop
        
        Write-Host "✅ Client updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Updated settings:" -ForegroundColor Cyan
        Write-Host "  - Public Client: True" -ForegroundColor Gray
        Write-Host "  - Direct Access Grants: Enabled" -ForegroundColor Gray
        Write-Host "  - Standard Flow: Enabled" -ForegroundColor Gray
        
        # Test the client with Direct Access Grant
        Write-Host ""
        Write-Host "Testing Direct Access Grant..." -ForegroundColor Yellow
        
        $testBody = @{
            grant_type = "password"
            client_id = "soc-auth-service"
            username = "admin@soc-compliance.com"
            password = "Admin@123!"
            scope = "openid profile email"
        }
        
        $testFormData = ($testBody.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'
        
        try {
            $testResponse = Invoke-RestMethod -Uri "http://127.0.0.1:8180/realms/master/protocol/openid-connect/token" `
                -Method POST `
                -ContentType "application/x-www-form-urlencoded" `
                -Body $testFormData `
                -ErrorAction Stop
            
            Write-Host "✅ Direct Access Grant works!" -ForegroundColor Green
            Write-Host "   - Got access token: $($testResponse.access_token.Substring(0, 50))..." -ForegroundColor Gray
        } catch {
            Write-Host "⚠️  Direct Access Grant test failed: $_" -ForegroundColor Yellow
            Write-Host "   This might be because the user doesn't exist in Keycloak yet" -ForegroundColor Gray
        }
        
    } else {
        Write-Host "❌ Client 'soc-auth-service' not found!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Failed to fix Keycloak client: $_" -ForegroundColor Red
    exit 1
}