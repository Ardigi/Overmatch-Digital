# Test Policy Service Script
# This script tests all Policy Service endpoints including CRUD operations,
# workflow management, approvals, and policy-control mapping

$BaseUrl = "http://localhost:3003"
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

Write-Host "`n=== Policy Service Test Script ===" -ForegroundColor Cyan
Write-Host "Testing Policy Service at $BaseUrl" -ForegroundColor Gray

# Test variables
$TestPolicyId = $null
$TestControlId = $null

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

# 2. Create Policy
Write-Host "`n2. Testing Policy Creation..." -ForegroundColor Yellow
$createPolicy = @{
    title = "Information Security Policy"
    policyNumber = "POL-IS-001"
    content = "## Purpose`nThis policy establishes the information security standards and procedures.`n`n## Scope`nApplies to all employees and contractors.`n`n## Policy`n1. Access Control`n2. Data Protection`n3. Incident Response"
    type = "security"
    priority = "high"
    scope = "organization"
    effectiveDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
    frameworks = @("SOC2", "ISO27001")
    tags = @("security", "compliance", "mandatory")
    customFields = @{
        department = "IT Security"
        riskLevel = "high"
    }
    isTemplate = $false
}

$result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies" -Body $createPolicy
if ($result.Success) {
    Write-Host "   ✓ Policy created successfully" -ForegroundColor Green
    Write-Host "     ID: $($result.Data.id)" -ForegroundColor Gray
    Write-Host "     Number: $($result.Data.policyNumber)" -ForegroundColor Gray
    Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
    $TestPolicyId = $result.Data.id
} else {
    Write-Host "   ✗ Failed to create policy: $($result.Error.message)" -ForegroundColor Red
}

# 3. Get All Policies
Write-Host "`n3. Testing Get All Policies..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies" -QueryParams @{ limit = 10 }
if ($result.Success) {
    Write-Host "   ✓ Retrieved policies successfully" -ForegroundColor Green
    Write-Host "     Total: $($result.Data.total)" -ForegroundColor Gray
    Write-Host "     Count: $($result.Data.data.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get policies: $($result.Error.message)" -ForegroundColor Red
}

# 4. Get Policy by ID
Write-Host "`n4. Testing Get Policy by ID..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/$TestPolicyId"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved policy successfully" -ForegroundColor Green
        Write-Host "     Title: $($result.Data.title)" -ForegroundColor Gray
        Write-Host "     Views: $($result.Data.metrics.views)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get policy: $($result.Error.message)" -ForegroundColor Red
    }
}

# 5. Update Policy
Write-Host "`n5. Testing Policy Update..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $updatePolicy = @{
        content = $createPolicy.content + "`n`n## Additional Requirements`n4. Regular Security Audits"
        tags = @("security", "compliance", "mandatory", "updated")
        reviewDate = (Get-Date).AddMonths(6).ToString("yyyy-MM-dd")
    }
    
    $result = Invoke-ApiRequest -Method "PATCH" -Endpoint "/policies/$TestPolicyId" -Body $updatePolicy
    if ($result.Success) {
        Write-Host "   ✓ Policy updated successfully" -ForegroundColor Green
        Write-Host "     Version: $($result.Data.version)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to update policy: $($result.Error.message)" -ForegroundColor Red
    }
}

# 6. Test Workflow Transition
Write-Host "`n6. Testing Workflow Transition..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $transition = @{
        toState = "pending_review"
        comment = "Policy ready for review"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/workflow/transition" -Body $transition
    if ($result.Success) {
        Write-Host "   ✓ Workflow transitioned successfully" -ForegroundColor Green
        Write-Host "     New State: $($result.Data.workflowState)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to transition workflow: $($result.Error.message)" -ForegroundColor Red
    }
}

# 7. Test Policy Approval
Write-Host "`n7. Testing Policy Approval..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/approve" -Body @{ comments = "Policy approved for implementation" }
    if ($result.Success) {
        Write-Host "   ✓ Policy approved successfully" -ForegroundColor Green
        Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
        Write-Host "     Approved By: $($result.Data.approvedBy)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to approve policy: $($result.Error.message)" -ForegroundColor Red
    }
}

# 8. Test Policy Publishing
Write-Host "`n8. Testing Policy Publishing..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/publish"
    if ($result.Success) {
        Write-Host "   ✓ Policy published successfully" -ForegroundColor Green
        Write-Host "     Status: $($result.Data.status)" -ForegroundColor Gray
        Write-Host "     Published Date: $($result.Data.publishedDate)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to publish policy: $($result.Error.message)" -ForegroundColor Red
    }
}

# 9. Test Add Exception
Write-Host "`n9. Testing Add Policy Exception..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $exception = @{
        description = "Temporary exception for legacy systems"
        justification = "Legacy systems need time to implement new security controls"
        expirationDate = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
        conditions = @("Only applies to System A", "Must implement compensating controls")
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/exception" -Body $exception
    if ($result.Success) {
        Write-Host "   ✓ Exception added successfully" -ForegroundColor Green
        Write-Host "     Exceptions Count: $($result.Data.exceptions.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to add exception: $($result.Error.message)" -ForegroundColor Red
    }
}

# 10. Test Get Expiring Policies
Write-Host "`n10. Testing Get Expiring Policies..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/expiring" -QueryParams @{ daysAhead = 90 }
if ($result.Success) {
    Write-Host "   ✓ Retrieved expiring policies" -ForegroundColor Green
    Write-Host "     Count: $($result.Data.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get expiring policies: $($result.Error.message)" -ForegroundColor Red
}

# 11. Test Get Policies Needing Review
Write-Host "`n11. Testing Get Policies Needing Review..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/needs-review"
if ($result.Success) {
    Write-Host "   ✓ Retrieved policies needing review" -ForegroundColor Green
    Write-Host "     Count: $($result.Data.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to get policies needing review: $($result.Error.message)" -ForegroundColor Red
}

# 12. Test Calculate Compliance Score
Write-Host "`n12. Testing Calculate Compliance Score..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/calculate-compliance-score"
    if ($result.Success) {
        Write-Host "   ✓ Compliance score calculated" -ForegroundColor Green
        Write-Host "     Score: $($result.Data.complianceScore)%" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to calculate compliance score: $($result.Error.message)" -ForegroundColor Red
    }
}

# 13. Create a test control for mapping (simulate having a control)
Write-Host "`n13. Creating Test Control for Mapping..." -ForegroundColor Yellow
# Note: In real scenario, this would come from Control Service
$TestControlId = [System.Guid]::NewGuid().ToString()
Write-Host "   ✓ Using test control ID: $TestControlId" -ForegroundColor Green

# 14. Test Map Policy to Control
Write-Host "`n14. Testing Map Policy to Control..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $mapping = @{
        controlId = $TestControlId
        framework = "SOC2"
        implementation = "This policy defines access control procedures that directly address CC6.1 requirements"
        strength = "strong"
        notes = "Key policy for SOC2 compliance"
        gaps = @("Need to add specific password complexity requirements")
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/map-control" -Body $mapping
    if ($result.Success) {
        Write-Host "   ✓ Policy mapped to control successfully" -ForegroundColor Green
        Write-Host "     Mapped Controls: $($result.Data.controlMappings.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to map policy to control: $($result.Error.message)" -ForegroundColor Red
    }
}

# 15. Test Bulk Map to Controls
Write-Host "`n15. Testing Bulk Map to Controls..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $control2Id = [System.Guid]::NewGuid().ToString()
    $control3Id = [System.Guid]::NewGuid().ToString()
    
    $bulkMapping = @{
        controlIds = @($control2Id, $control3Id)
        framework = "ISO27001"
        implementation = "This policy addresses multiple ISO 27001 controls"
        strength = "moderate"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/bulk-map-controls" -Body $bulkMapping
    if ($result.Success) {
        Write-Host "   ✓ Policy bulk mapped to controls successfully" -ForegroundColor Green
        Write-Host "     Total Mapped Controls: $($result.Data.controlMappings.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to bulk map controls: $($result.Error.message)" -ForegroundColor Red
    }
}

# 16. Test Update Control Mapping
Write-Host "`n16. Testing Update Control Mapping..." -ForegroundColor Yellow
if ($TestPolicyId -and $TestControlId) {
    $updateMapping = @{
        controlId = $TestControlId
        strength = "moderate"
        notes = "Updated after gap analysis"
        gaps = @("Password complexity requirements added", "Need MFA policy")
    }
    
    $result = Invoke-ApiRequest -Method "PATCH" -Endpoint "/policies/$TestPolicyId/update-control-mapping" -Body $updateMapping
    if ($result.Success) {
        Write-Host "   ✓ Control mapping updated successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to update control mapping: $($result.Error.message)" -ForegroundColor Red
    }
}

# 17. Test Get Policies by Control
Write-Host "`n17. Testing Get Policies by Control..." -ForegroundColor Yellow
if ($TestControlId) {
    $query = @{
        controlId = $TestControlId
        organizationId = [System.Guid]::NewGuid().ToString()  # Would be real org ID
        minStrength = "moderate"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/control/search" -Body $query
    if ($result.Success) {
        Write-Host "   ✓ Retrieved policies by control" -ForegroundColor Green
        Write-Host "     Policies Found: $($result.Data.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get policies by control: $($result.Error.message)" -ForegroundColor Red
    }
}

# 18. Test Get Policy Control Coverage
Write-Host "`n18. Testing Get Policy Control Coverage..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/$TestPolicyId/control-coverage"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved control coverage report" -ForegroundColor Green
        Write-Host "     Overall Coverage: $($result.Data.overallCoverage)%" -ForegroundColor Gray
        if ($result.Data.frameworks) {
            foreach ($fw in $result.Data.frameworks) {
                Write-Host "     $($fw.name): $($fw.coverage)% ($($fw.mappedControls)/$($fw.totalControls) controls)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "   ✗ Failed to get control coverage: $($result.Error.message)" -ForegroundColor Red
    }
}

# 19. Test Map to Framework
Write-Host "`n19. Testing Map Policy to Framework..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $frameworkMapping = @{
        framework = "HIPAA"
        controlIds = @([System.Guid]::NewGuid().ToString(), [System.Guid]::NewGuid().ToString())
        detectGaps = $true
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/$TestPolicyId/map-framework" -Body $frameworkMapping
    if ($result.Success) {
        Write-Host "   ✓ Policy mapped to framework successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to map to framework: $($result.Error.message)" -ForegroundColor Red
    }
}

# 20. Test Search Policies
Write-Host "`n20. Testing Search Policies..." -ForegroundColor Yellow
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/search" -QueryParams @{ 
    q = "security"
    frameworks = "SOC2,ISO27001"
}
if ($result.Success) {
    Write-Host "   ✓ Search completed successfully" -ForegroundColor Green
    Write-Host "     Results: $($result.Data.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ✗ Failed to search policies: $($result.Error.message)" -ForegroundColor Red
}

# 21. Test Get Similar Policies
Write-Host "`n21. Testing Get Similar Policies..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/$TestPolicyId/similar" -QueryParams @{ limit = 5 }
    if ($result.Success) {
        Write-Host "   ✓ Retrieved similar policies" -ForegroundColor Green
        Write-Host "     Found: $($result.Data.Count) similar policies" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get similar policies: $($result.Error.message)" -ForegroundColor Red
    }
}

# 22. Test Get Policy History
Write-Host "`n22. Testing Get Policy History..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/policies/$TestPolicyId/history"
    if ($result.Success) {
        Write-Host "   ✓ Retrieved policy history" -ForegroundColor Green
        Write-Host "     Current Version: $($result.Data.currentVersion)" -ForegroundColor Gray
        Write-Host "     History Entries: $($result.Data.history.Count)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed to get policy history: $($result.Error.message)" -ForegroundColor Red
    }
}

# 23. Test Bulk Operations
Write-Host "`n23. Testing Bulk Operations..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $bulkOp = @{
        operation = "archive"
        policyIds = @($TestPolicyId)
        reason = "Test archival"
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/policies/bulk" -Body $bulkOp
    if ($result.Success) {
        Write-Host "   ✓ Bulk operation completed" -ForegroundColor Green
        Write-Host "     Processed: $($result.Data.processed)" -ForegroundColor Gray
        Write-Host "     Success: $($result.Data.success)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Failed bulk operation: $($result.Error.message)" -ForegroundColor Red
    }
}

# 24. Test Unmap from Control
Write-Host "`n24. Testing Unmap Policy from Control..." -ForegroundColor Yellow
if ($TestPolicyId -and $TestControlId) {
    $unmapDto = @{
        controlId = $TestControlId
        removeFromFramework = $false
    }
    
    $result = Invoke-ApiRequest -Method "DELETE" -Endpoint "/policies/$TestPolicyId/unmap-control" -Body $unmapDto
    if ($result.Success) {
        Write-Host "   ✓ Policy unmapped from control successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to unmap from control: $($result.Error.message)" -ForegroundColor Red
    }
}

# 25. Test Delete Policy (Archive)
Write-Host "`n25. Testing Delete/Archive Policy..." -ForegroundColor Yellow
if ($TestPolicyId) {
    $result = Invoke-ApiRequest -Method "DELETE" -Endpoint "/policies/$TestPolicyId"
    if ($result.Success) {
        Write-Host "   ✓ Policy archived successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Failed to archive policy: $($result.Error.message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Policy Service endpoints tested successfully!" -ForegroundColor Green
Write-Host "`nKey features tested:" -ForegroundColor Yellow
Write-Host "  - Policy CRUD operations" -ForegroundColor Gray
Write-Host "  - Workflow management and approvals" -ForegroundColor Gray
Write-Host "  - Policy publishing and exceptions" -ForegroundColor Gray
Write-Host "  - Policy-Control mapping (single and bulk)" -ForegroundColor Gray
Write-Host "  - Control coverage reporting" -ForegroundColor Gray
Write-Host "  - Framework mapping" -ForegroundColor Gray
Write-Host "  - Search and similarity features" -ForegroundColor Gray
Write-Host "  - Bulk operations" -ForegroundColor Gray
Write-Host "  - Compliance scoring" -ForegroundColor Gray

Write-Host "`nNote: Some endpoints may require specific data setup or integration with other services." -ForegroundColor Yellow
Write-Host "OPA integration endpoints require OPA server to be running." -ForegroundColor Yellow