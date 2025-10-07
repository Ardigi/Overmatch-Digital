# SOC Compliance Platform - Automated Secret Detection Script
# Purpose: Scan for hardcoded secrets with enterprise-grade accuracy
# Author: SOC Compliance Security Team
# Version: 1.0.0

param(
    [string]$Path = ".",
    [string]$ReportPath = "./security-reports",
    [switch]$Fix,
    [switch]$GenerateVaultMigration,
    [switch]$Verbose
)

# Ensure report directory exists
if (!(Test-Path $ReportPath)) {
    New-Item -ItemType Directory -Path $ReportPath -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportFile = Join-Path $ReportPath "secrets-scan-$timestamp.json"

Write-Host "🔍 SOC Compliance Platform - Security Scanner" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Custom patterns for SOC platform specific secrets
$customPatterns = @{
    "JWT_SECRET" = @{
        Pattern = "(JWT_SECRET|jwt[_-]?secret)\s*[:=]\s*['\`"]([^'\`"]{10,})['\`"]"
        Severity = "CRITICAL"
        Description = "JWT secret key found"
    }
    "Database_Password" = @{
        Pattern = "(DB_PASSWORD|DATABASE_PASSWORD|password)\s*[:=]\s*['\`"](?!test|dev|example)([^'\`"]{6,})['\`"]"
        Severity = "CRITICAL"  
        Description = "Database password found"
    }
    "API_Key" = @{
        Pattern = "(API_KEY|api[_-]?key)\s*[:=]\s*['\`"]([a-zA-Z0-9]{20,})['\`"]"
        Severity = "HIGH"
        Description = "API key found"
    }
    "CSRF_Secret" = @{
        Pattern = "(CSRF_SECRET|csrf[_-]?secret)\s*[:=]\s*['\`"]([^'\`"]{10,})['\`"]"
        Severity = "CRITICAL"
        Description = "CSRF secret found"
    }
    "Auth_Secret" = @{
        Pattern = "(AUTH_SECRET|NEXTAUTH_SECRET|auth[_-]?secret)\s*[:=]\s*['\`"]([^'\`"]{10,})['\`"]"
        Severity = "CRITICAL"
        Description = "Authentication secret found"
    }
    "Redis_Password" = @{
        Pattern = "(REDIS_PASSWORD|redis[_-]?pass)\s*[:=]\s*['\`"]([^'\`"]{6,})['\`"]"
        Severity = "HIGH"
        Description = "Redis password found"
    }
    "Private_Key" = @{
        Pattern = "-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
        Severity = "CRITICAL"
        Description = "Private key found"
    }
    "AWS_Credentials" = @{
        Pattern = "(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*['\`"]([^'\`"]+)['\`"]"
        Severity = "CRITICAL"
        Description = "AWS credentials found"
    }
    "Hardcoded_IP" = @{
        Pattern = "(ipAddress|ip)\s*[:=]\s*['\`"](127\.0\.0\.1|localhost)['\`"]"
        Severity = "MEDIUM"
        Description = "Hardcoded IP address found (should be dynamic)"
    }
}

# Files and directories to exclude from scanning
$excludePatterns = @(
    "*/node_modules/*",
    "*/.git/*",
    "*/dist/*",
    "*/build/*",
    "*.min.js",
    "*.bundle.js",
    "*/coverage/*",
    "*.spec.ts",
    "*.test.ts",
    "*.e2e-spec.ts",
    "*/migrations/*.sql",
    "package-lock.json",
    "yarn.lock"
)

# Scan for secrets
$findings = @()
$criticalCount = 0
$highCount = 0
$mediumCount = 0

Write-Host "Scanning directory: $Path" -ForegroundColor Yellow
Write-Host ""

# Get all files to scan
$files = Get-ChildItem -Path $Path -Recurse -File | Where-Object {
    $file = $_
    $include = $true
    
    foreach ($pattern in $excludePatterns) {
        if ($file.FullName -like $pattern) {
            $include = $false
            break
        }
    }
    
    # Only scan text files
    if ($include) {
        $extension = $file.Extension
        $textExtensions = @(".ts", ".tsx", ".js", ".jsx", ".json", ".env", ".config", ".yml", ".yaml", ".ps1", ".sh", ".md")
        $include = $textExtensions -contains $extension
    }
    
    return $include
}

$totalFiles = $files.Count
$currentFile = 0

foreach ($file in $files) {
    $currentFile++
    $percentComplete = [math]::Round(($currentFile / $totalFiles) * 100, 2)
    
    Write-Progress -Activity "Scanning for secrets" -Status "$percentComplete% Complete" -PercentComplete $percentComplete
    
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        
        foreach ($secretType in $customPatterns.Keys) {
            $pattern = $customPatterns[$secretType]
            
            if ($content -match $pattern.Pattern) {
                $matches = [regex]::Matches($content, $pattern.Pattern)
                
                foreach ($match in $matches) {
                    # Get line number
                    $lines = $content.Split("`n")
                    $lineNumber = 1
                    $position = 0
                    
                    foreach ($line in $lines) {
                        $position += $line.Length + 1
                        if ($position -gt $match.Index) {
                            break
                        }
                        $lineNumber++
                    }
                    
                    $finding = @{
                        File = $file.FullName.Replace($Path, "").TrimStart("\", "/")
                        Line = $lineNumber
                        Type = $secretType
                        Severity = $pattern.Severity
                        Description = $pattern.Description
                        Match = $match.Value.Substring(0, [Math]::Min($match.Value.Length, 100))
                        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                    }
                    
                    $findings += $finding
                    
                    switch ($pattern.Severity) {
                        "CRITICAL" { $criticalCount++ }
                        "HIGH" { $highCount++ }
                        "MEDIUM" { $mediumCount++ }
                    }
                    
                    if ($Verbose) {
                        Write-Host "  ⚠️  Found: $($pattern.Description) in $($file.Name):$lineNumber" -ForegroundColor Red
                    }
                }
            }
        }
    }
    catch {
        if ($Verbose) {
            Write-Warning "Could not scan file: $($file.FullName)"
        }
    }
}

Write-Progress -Activity "Scanning for secrets" -Completed

# Display results
Write-Host ""
Write-Host "📊 Scan Results" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✅ No hardcoded secrets found!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "⚠️  Found $($findings.Count) potential secrets:" -ForegroundColor Red
    Write-Host ""
    Write-Host "  🔴 Critical: $criticalCount" -ForegroundColor Red
    Write-Host "  🟠 High: $highCount" -ForegroundColor Yellow  
    Write-Host "  🟡 Medium: $mediumCount" -ForegroundColor Yellow
    Write-Host ""
    
    # Group findings by severity
    $criticalFindings = $findings | Where-Object { $_.Severity -eq "CRITICAL" }
    $highFindings = $findings | Where-Object { $_.Severity -eq "HIGH" }
    $mediumFindings = $findings | Where-Object { $_.Severity -eq "MEDIUM" }
    
    if ($criticalFindings.Count -gt 0) {
        Write-Host "🔴 CRITICAL Issues (Fix Immediately):" -ForegroundColor Red
        foreach ($finding in $criticalFindings) {
            Write-Host "   - $($finding.File):$($finding.Line) - $($finding.Description)" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    if ($highFindings.Count -gt 0) {
        Write-Host "🟠 HIGH Priority Issues:" -ForegroundColor Yellow
        foreach ($finding in $highFindings) {
            Write-Host "   - $($finding.File):$($finding.Line) - $($finding.Description)" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    if ($mediumFindings.Count -gt 0) {
        Write-Host "🟡 MEDIUM Priority Issues:" -ForegroundColor Yellow
        foreach ($finding in $mediumFindings) {
            Write-Host "   - $($finding.File):$($finding.Line) - $($finding.Description)" -ForegroundColor Yellow
        }
        Write-Host ""
    }
}

# Generate report
$report = @{
    ScanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Path = $Path
    TotalFilesScanned = $totalFiles
    TotalFindings = $findings.Count
    CriticalFindings = $criticalCount
    HighFindings = $highCount
    MediumFindings = $mediumCount
    Findings = $findings
}

$report | ConvertTo-Json -Depth 10 | Out-File $reportFile

Write-Host "📄 Detailed report saved to: $reportFile" -ForegroundColor Cyan
Write-Host ""

# Generate vault migration script if requested
if ($GenerateVaultMigration -and $findings.Count -gt 0) {
    $migrationScript = @"
# Auto-generated Secret Migration Script
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Total secrets to migrate: $($findings.Count)

# Step 1: Create .env.template file
`$envTemplate = @'
# SOC Compliance Platform Environment Variables
# Copy this file to .env and fill in the values

# Authentication
JWT_SECRET=
AUTH_SECRET=
NEXTAUTH_SECRET=
CSRF_SECRET=

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=
DB_PASSWORD=
DB_NAME=

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# AWS (if using)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Other services
API_KEY=
'@

`$envTemplate | Out-File ".env.template" -Encoding UTF8

# Step 2: Create secrets in AWS Secrets Manager or Vault
Write-Host "Creating secrets in secrets manager..."

"@

    foreach ($finding in $criticalFindings) {
        $migrationScript += @"

# Migrate: $($finding.Description) from $($finding.File)
# TODO: Replace with actual secret value from secure source
# aws secretsmanager create-secret --name "soc-platform/$($finding.Type.ToLower())" --secret-string "REPLACE_WITH_ACTUAL_SECRET"

"@
    }
    
    $migrationScript += @"

# Step 3: Update application to use secrets manager
Write-Host "Update your application code to use @InjectSecret() decorator or environment variables"
Write-Host "See docs/SECRETS_MANAGEMENT.md for detailed instructions"

# Step 4: Verify no hardcoded secrets remain
.\scripts\security\scan-hardcoded-secrets.ps1 -Verbose

Write-Host "Migration complete!"
"@
    
    $migrationFile = Join-Path $ReportPath "migrate-secrets-$timestamp.ps1"
    $migrationScript | Out-File $migrationFile
    
    Write-Host "🔧 Migration script generated: $migrationFile" -ForegroundColor Green
    Write-Host ""
}

# Exit with appropriate code
if ($criticalCount -gt 0) {
    Write-Host "❌ CRITICAL security issues found. Fix immediately!" -ForegroundColor Red
    exit 1
} elseif ($highCount -gt 0) {
    Write-Host "⚠️  HIGH priority issues found. Fix within 24 hours." -ForegroundColor Yellow
    exit 1
} elseif ($mediumCount -gt 0) {
    Write-Host "⚠️  MEDIUM priority issues found. Schedule fixes." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✅ Security scan completed successfully!" -ForegroundColor Green
    exit 0
}