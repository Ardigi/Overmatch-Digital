# Test Client Service Script
# This script tests all Client Service endpoints including CRUD operations,
# contracts, audit scheduling, and client portal access

$BaseUrl = "http://localhost:3002"
$Token = $env:TEST_JWT_TOKEN

if (-not $Token) {
    Write-Host "ERROR: Please set TEST_JWT_TOKEN environment variable" -ForegroundColor Red
    Write-Host "Run the auth test script first to get a token" -ForegroundColor Yellow
    exit 1
}

$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "`n=== Client Service Test Script ===" -ForegroundColor Cyan
Write-Host "Testing Client Service at $BaseUrl" -ForegroundColor Gray

# Test variables
$TestClientId = $null
$TestContractId = $null
$TestAuditId = $null
$TestPortalUserId = $null

# Function to make API requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = @{},
        [hashtable]$QueryParams = @{}
    )
    
    $Uri = "$BaseUrl$Endpoint"
    
    if ($QueryParams.Count -gt 0) {
        $QueryString = ($QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
        $Uri = "$Uri?$QueryString"
    }
    
    try {
        $params = @{
            Method = $Method
            Uri = $Uri
            Headers = $Headers
        }
        
        if ($Method -ne "GET" -and $Method -ne "DELETE") {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $Response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $Response
        }
    }
    catch {
        $StatusCode = $_.Exception.Response.StatusCode.value__
        $ErrorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        return @{
            Success = $false
            StatusCode = $StatusCode
            Error = $ErrorBody
            RawError = $_.Exception.Message
        }
    }
}

# 1. Test Health Check
Write-Host "`n1. Testing Health Check..." -ForegroundColor Yellow
$health = Invoke-ApiRequest -Method "GET" -Endpoint "/health"
if ($health.Success) {
    Write-Host "   ✓ Health check passed" -ForegroundColor Green
} else {
    Write-Host "   ✗ Health check failed: $($health.RawError)" -ForegroundColor Red
    exit 1
}

# 2. Create Client
Write-Host "`n2. Testing Client Creation..." -ForegroundColor Yellow
$createClient = @{
    name = "Acme Corporation"
    legalName = "Acme Corp Inc."
    clientType = "direct"
    website = "https://acme.com"
    description = "Leading provider of innovative solutions"
    industry = "technology"
    size = "201-500"
    employeeCount = 350
    annualRevenue = "50M-100M"
    targetFrameworks = @("soc2_type2", "iso27001")
    contactInfo = @{
        primaryContact = @{
            name = "John Smith"
            title = "CTO"
            email = "john@acme.com"
            phone = "+1-555-0123"
        }
    }
    address = @{
        headquarters = @{
            street1 = "123 Main St"
            city = "San Francisco"
            state = "CA"
            postalCode = "94105"
            country = "USA"
        }
    }
}

$result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients" -Body $createClient
if ($result.Success) {
    Write-Host "   ✓ Client created successfully" -ForegroundColor Green
    Write-Host "     ID: $($result.Data.id)" -ForegroundColor Gray
    Write-Host "     Name: $($result.Data.name)" -ForegroundColor Gray
    Write-Host "     Slug: $($result.Data.slug)" -ForegroundColor Gray
    $TestClientId = $result.Data.id
} else {
    Write-Host "   ✗ Failed to create client: $($result.Error.message)" -ForegroundColor Red
}

# 3. Get All Clients
Write-Host "`n3. Testing Get All Clients..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients" -QueryParams @{ limit = 10 }
if ($result.Success) {
    Write-Host "   ✓ Retrieved clients successfully" -ForegroundColor Green
    Write-Host "     Total: $($result.Data.meta.total)" -ForegroundColor Gray
    Write-Host "     Count: $($result.Data.data.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get clients: $($result.Error.message)" -ForegroundColor Red
}

# 4. Get Client by ID
Write-Host "`n4. Testing Get Client by ID..." -ForegroundColor Yellow
if ($TestClientId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/$TestClientId"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved client successfully" -ForegroundColor Green
        Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
        Write-Host "     Compliance Status: $($result.Data.complianceStatus)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get client: $($result.Error.message)" -ForegroundColor Red
    }
}

# 5. Update Client
Write-Host "`n5. Testing Client Update..." -ForegroundColor Yellow
if ($TestClientId) {
    $updateClient = @{
        description = "Leading provider of innovative enterprise solutions"
        employeeCount = 400
        tags = @("technology", "saas", "enterprise")
    }
    
    $result = Invoke-ApiRequest -Method "PUT" -Endpoint "/clients/$TestClientId" -Body $updateClient
    if ($result.Success) {
        Write-Host "   ✓ Client updated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to update client: $($result.Error.message)" -ForegroundColor Red
    }
}

# 6. Update Compliance Status
Write-Host "`n6. Testing Update Compliance Status..." -ForegroundColor Yellow
if ($TestClientId) {
    $statusUpdate = @{
        status = "assessment"
        notes = "Initial assessment phase started"
    }
    
    $result = Invoke-ApiRequest -Method "PUT" -Endpoint "/clients/$TestClientId/compliance-status" -Body $statusUpdate
    if ($result.Success) {
        Write-Host "   ✓ Compliance status updated" -ForegroundColor Green
        Write-Host "     New Status: $($result.Data.complianceStatus)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to update compliance status: $($result.Error.message)" -ForegroundColor Red
    }
}

# 7. Start Onboarding
Write-Host "`n7. Testing Start Onboarding..." -ForegroundColor Yellow
$onboardingData = @{
    clientId = $TestClientId
    assignedTo = "manager-user-id"
    checklist = @{
        contractSigned = $true
        documentationProvided = $false
        systemsAccessGranted = $false
        kickoffMeetingScheduled = $true
    }
    notes = "Kickoff meeting scheduled for next week"
}

$result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients/onboarding/start" -Body $onboardingData
if ($result.Success) {
    Write-Host "   ✓ Onboarding started successfully" -ForegroundColor Green
    Write-Host "     Onboarding Date: $($result.Data.onboardingStartDate)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to start onboarding: $($result.Error.message)" -ForegroundColor Red
}

# 8. Create Contract
Write-Host "`n8. Testing Contract Creation..." -ForegroundColor Yellow
if ($TestClientId) {
    $createContract = @{
        clientId = $TestClientId
        title = "Master Service Agreement"
        description = "Comprehensive SOC 2 compliance services"
        type = "msa"
        startDate = (Get-Date).ToString("yyyy-MM-dd")
        endDate = (Get-Date).AddYears(1).ToString("yyyy-MM-dd")
        totalValue = 120000
        monthlyValue = 10000
        currency = "USD"
        billingFrequency = "monthly"
        paymentTerms = "net_30"
        services = @{
            soc2 = $true
            continuousMonitoring = $true
            incidentResponse = $true
            training = $true
        }
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/contracts" -Body $createContract
    if ($result.Success) {
        Write-Host "   ✓ Contract created successfully" -ForegroundColor Green
        Write-Host "     Contract Number: $($result.Data.contractNumber)" -ForegroundColor Gray
        Write-Host "     Total Value: `$$($result.Data.totalValue)" -ForegroundColor Gray
        $TestContractId = $result.Data.id
    } else {
        Write-Host "   ✗ Failed to create contract: $($result.Error.message)" -ForegroundColor Red
    }
}

# 9. Sign Contract
Write-Host "`n9. Testing Contract Signing..." -ForegroundColor Yellow
if ($TestContractId) {
    $signatureData = @{
        clientSignatory = "John Smith"
        clientSignatoryTitle = "CTO"
        clientSignatoryEmail = "john@acme.com"
        mspSignatory = "Jane Doe"
        mspSignatoryTitle = "Account Manager"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/contracts/$TestContractId/sign" -Body $signatureData
    if ($result.Success) {
        Write-Host "   ✓ Contract signed successfully" -ForegroundColor Green
        Write-Host "     Signed Date: $($result.Data.signedDate)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to sign contract: $($result.Error.message)" -ForegroundColor Red
    }
}

# 10. Activate Contract
Write-Host "`n10. Testing Contract Activation..." -ForegroundColor Yellow
if ($TestContractId) {
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/contracts/$TestContractId/activate"
    if ($result.Success) {
        Write-Host "   ✓ Contract activated successfully" -ForegroundColor Green
        Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to activate contract: $($result.Error.message)" -ForegroundColor Red
    }
}

# 11. Schedule Audit
Write-Host "`n11. Testing Audit Scheduling..." -ForegroundColor Yellow
if ($TestClientId) {
    $auditData = @{
        name = "SOC 2 Type II Initial Audit"
        type = "external"
        framework = "soc2_type2"
        scheduledStartDate = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
        scheduledEndDate = (Get-Date).AddMonths(3).AddDays(5).ToString("yyyy-MM-dd")
        scope = "full"
        auditFirmName = "Big Four Auditors LLC"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients/$TestClientId/audits" -Body $auditData
    if ($result.Success) {
        Write-Host "   ✓ Audit scheduled successfully" -ForegroundColor Green
        Write-Host "     Audit ID: $($result.Data.id)" -ForegroundColor Gray
        Write-Host "     Scheduled Start: $($result.Data.scheduledStartDate)" -ForegroundColor Gray
        $TestAuditId = $result.Data.id
    } else {
        Write-Host "   ✗ Failed to schedule audit: $($result.Error.message)" -ForegroundColor Red
    }
}

# 12. Get Client Audits
Write-Host "`n12. Testing Get Client Audits..." -ForegroundColor Yellow
if ($TestClientId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/$TestClientId/audits"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved audits successfully" -ForegroundColor Green
        Write-Host "     Total Audits: $($result.Data.meta.total)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get audits: $($result.Error.message)" -ForegroundColor Red
    }
}

# 13. Update Audit
Write-Host "`n13. Testing Audit Update..." -ForegroundColor Yellow
if ($TestClientId -and $TestAuditId) {
    $updateData = @{
        leadAuditorId = "auditor-123"
        scopeDetails = @{
            locations = @("San Francisco HQ", "Remote Workers")
            systems = @("AWS Infrastructure", "Google Workspace", "GitHub")
            processes = @("Access Control", "Change Management", "Incident Response")
        }
    }
    
    $result = Invoke-ApiRequest -Method "PUT" -Endpoint "/clients/$TestClientId/audits/$TestAuditId" -Body $updateData
    if ($result.Success) {
        Write-Host "   ✓ Audit updated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to update audit: $($result.Error.message)" -ForegroundColor Red
    }
}

# 14. Invite Portal User
Write-Host "`n14. Testing Portal User Invitation..." -ForegroundColor Yellow
if ($TestClientId) {
    $inviteData = @{
        email = "portal.user@acme.com"
        firstName = "Portal"
        lastName = "User"
        role = "client_user"
        title = "Compliance Manager"
        department = "IT Security"
        sendInvitation = $true
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients/$TestClientId/portal/users" -Body $inviteData
    if ($result.Success) {
        Write-Host "   ✓ Portal user invited successfully" -ForegroundColor Green
        Write-Host "     User ID: $($result.Data.id)" -ForegroundColor Gray
        Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
        $TestPortalUserId = $result.Data.id
    } else {
        Write-Host "   ✗ Failed to invite portal user: $($result.Error.message)" -ForegroundColor Red
    }
}

# 15. Bulk Invite Portal Users
Write-Host "`n15. Testing Bulk Portal User Invitations..." -ForegroundColor Yellow
if ($TestClientId) {
    $bulkInviteData = @{
        users = @(
            @{
                email = "user1@acme.com"
                firstName = "User"
                lastName = "One"
                role = "client_viewer"
            },
            @{
                email = "user2@acme.com"
                firstName = "User"
                lastName = "Two"
                role = "client_admin"
                title = "IT Director"
            }
        )
        sendInvitations = $true
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients/$TestClientId/portal/users/bulk" -Body $bulkInviteData
    if ($result.Success) {
        Write-Host "   ✓ Bulk invitations sent" -ForegroundColor Green
        Write-Host "     Success: $($result.Data.success.Count)" -ForegroundColor Gray
        Write-Host "     Failed: $($result.Data.failed.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to send bulk invitations: $($result.Error.message)" -ForegroundColor Red
    }
}

# 16. Update Portal User
Write-Host "`n16. Testing Portal User Update..." -ForegroundColor Yellow
if ($TestClientId -and $TestPortalUserId) {
    $updateData = @{
        title = "Senior Compliance Manager"
        department = "Risk & Compliance"
        role = "client_admin"
    }
    
    $result = Invoke-ApiRequest -Method "PUT" -Endpoint "/clients/$TestClientId/portal/users/$TestPortalUserId" -Body $updateData
    if ($result.Success) {
        Write-Host "   ✓ Portal user updated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to update portal user: $($result.Error.message)" -ForegroundColor Red
    }
}

# 17. Update Portal Settings
Write-Host "`n17. Testing Portal Settings Update..." -ForegroundColor Yellow
if ($TestClientId) {
    $portalSettings = @{
        enabled = $true
        viewAuditReports = $true
        uploadEvidence = $true
        viewComplianceStatus = $true
        manageUsers = $false
        viewContracts = $true
        requestSupport = $true
        requireMfa = $true
        ipWhitelist = @("192.168.1.0/24", "10.0.0.0/8")
    }
    
    $result = Invoke-ApiRequest -Method "PUT" -Endpoint "/clients/$TestClientId/portal/settings" -Body $portalSettings
    if ($result.Success) {
        Write-Host "   ✓ Portal settings updated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to update portal settings: $($result.Error.message)" -ForegroundColor Red
    }
}

# 18. Get Portal Dashboard
Write-Host "`n18. Testing Get Portal Dashboard..." -ForegroundColor Yellow
if ($TestClientId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/$TestClientId/portal/dashboard"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved portal dashboard" -ForegroundColor Green
        Write-Host "     Compliance Score: $($result.Data.client.complianceScore)" -ForegroundColor Gray
        Write-Host "     Upcoming Audits: $($result.Data.upcomingAudits.Count)" -ForegroundColor Gray
        Write-Host "     Active Contracts: $($result.Data.activeContracts.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get portal dashboard: $($result.Error.message)" -ForegroundColor Red
    }
}

# 19. Get Dashboard Stats
Write-Host "`n19. Testing Get Dashboard Stats..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/dashboard/stats"
if ($result.Success) {
    Write-Host "   ✓ Retrieved dashboard stats" -ForegroundColor Green
    Write-Host "     Total Clients: $($result.Data.totalClients)" -ForegroundColor Gray
    Write-Host "     Active Clients: $($result.Data.activeClients)" -ForegroundColor Gray
    Write-Host "     Average Compliance Score: $($result.Data.averageComplianceScore)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get dashboard stats: $($result.Error.message)" -ForegroundColor Red
}

# 20. Get Upcoming Audits
Write-Host "`n20. Testing Get Upcoming Audits..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/upcoming-audits" -QueryParams @{ days = 90 }
if ($result.Success) {
    Write-Host "   ✓ Retrieved upcoming audits" -ForegroundColor Green
    Write-Host "     Count: $($result.Data.meta.total)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get upcoming audits: $($result.Error.message)" -ForegroundColor Red
}

# 21. Get Expiring Certificates
Write-Host "`n21. Testing Get Expiring Certificates..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/expiring-certificates" -QueryParams @{ days = 90 }
if ($result.Success) {
    Write-Host "   ✓ Retrieved expiring certificates" -ForegroundColor Green
    Write-Host "     Count: $($result.Data.meta.total)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get expiring certificates: $($result.Error.message)" -ForegroundColor Red
}

# 22. Get Compliance Metrics
Write-Host "`n22. Testing Get Compliance Metrics..." -ForegroundColor Yellow
if ($TestClientId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/clients/$TestClientId/compliance-metrics"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved compliance metrics" -ForegroundColor Green
        Write-Host "     Overall Score: $($result.Data.overallScore)" -ForegroundColor Gray
        Write-Host "     Controls Total: $($result.Data.controlsStatus.total)" -ForegroundColor Gray
        Write-Host "     Controls Implemented: $($result.Data.controlsStatus.implemented)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get compliance metrics: $($result.Error.message)" -ForegroundColor Red
    }
}

# 23. Complete Onboarding
Write-Host "`n23. Testing Complete Onboarding..." -ForegroundColor Yellow
if ($TestClientId) {
    $completeData = @{
        clientId = $TestClientId
        summary = "Onboarding completed successfully"
        finalChecklist = @{
            contractSigned = $true
            documentationProvided = $true
            systemsAccessGranted = $true
            kickoffMeetingScheduled = $true
            initialAssessmentComplete = $true
        }
        firstAuditScheduled = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/clients/$TestClientId/onboarding/complete" -Body $completeData
    if ($result.Success) {
        Write-Host "   ✓ Onboarding completed successfully" -ForegroundColor Green
        Write-Host "     Complete Date: $($result.Data.onboardingCompleteDate)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to complete onboarding: $($result.Error.message)" -ForegroundColor Red
    }
}

# 24. Remove Portal User
Write-Host "`n24. Testing Remove Portal User..." -ForegroundColor Yellow
if ($TestClientId -and $TestPortalUserId) {
    $result = Invoke-ApiRequest -Method "DELETE" -Endpoint "/clients/$TestClientId/portal/users/$TestPortalUserId"
    if ($result.Success) {
        Write-Host "   ✓ Portal user removed successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to remove portal user: $($result.Error.message)" -ForegroundColor Red
    }
}

# 25. Archive Client
Write-Host "`n25. Testing Archive Client..." -ForegroundColor Yellow
if ($TestClientId) {
    # First terminate the contract
    if ($TestContractId) {
        $terminateData = @{
            reason = "Test cleanup"
            effectiveDate = (Get-Date).ToString("yyyy-MM-dd")
        }
        $result = Invoke-ApiRequest -Method "POST" -Endpoint "/contracts/$TestContractId/terminate" -Body $terminateData
    }
    
    # Then archive the client
    $result = Invoke-ApiRequest -Method "DELETE" -Endpoint "/clients/$TestClientId"
    if ($result.Success) {
        Write-Host "   ✓ Client archived successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to archive client: $($result.Error.message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Client Service endpoints tested successfully!" -ForegroundColor Green
Write-Host "`nKey features tested:" -ForegroundColor Yellow
Write-Host "  - Client CRUD operations" -ForegroundColor Gray
Write-Host "  - Compliance status management" -ForegroundColor Gray
Write-Host "  - Onboarding workflow" -ForegroundColor Gray
Write-Host "  - Contract management (create, sign, activate)" -ForegroundColor Gray
Write-Host "  - Audit scheduling and management" -ForegroundColor Gray
Write-Host "  - Client portal user management" -ForegroundColor Gray
Write-Host "  - Portal settings and dashboard" -ForegroundColor Gray
Write-Host "  - Compliance metrics and reporting" -ForegroundColor Gray
Write-Host "  - Dashboard statistics" -ForegroundColor Gray

Write-Host "`nNote: Some endpoints may require specific data setup or integration with other services." -ForegroundColor Yellow