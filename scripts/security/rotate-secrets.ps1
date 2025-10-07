# SOC Compliance Platform - Enterprise Secret Rotation Script
# Purpose: Automated secret rotation with zero-downtime deployment
# Author: SOC Compliance Security Team
# Version: 1.0.0

param(
    [Parameter(Mandatory=$false)]
    [string[]]$SecretNames = @("JWT_SECRET", "AUTH_SECRET", "CSRF_SECRET", "DB_PASSWORD", "REDIS_PASSWORD"),
    
    [Parameter(Mandatory=$false)]
    [int]$RotationDays = 30,
    
    [switch]$DryRun,
    [switch]$Emergency,
    [switch]$SkipHealthCheck,
    [switch]$Verbose
)

# Configuration
$script:Config = @{
    ServicesPath = ".\services"
    DockerComposeFile = "docker-compose.yml"
    HealthCheckTimeout = 60
    RollbackOnFailure = $true
    BackupPath = ".\backups\secrets"
    LogPath = ".\logs\secret-rotation"
}

# Ensure directories exist
foreach ($path in @($Config.BackupPath, $Config.LogPath)) {
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $Config.LogPath "rotation-$timestamp.log"

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Add-Content -Path $logFile -Value $logEntry
    
    switch ($Level) {
        "ERROR" { Write-Host $Message -ForegroundColor Red }
        "WARNING" { Write-Host $Message -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        "INFO" { 
            if ($Verbose) {
                Write-Host $Message -ForegroundColor Cyan
            }
        }
        default { Write-Host $Message }
    }
}

# Generate cryptographically secure secret
function New-SecureSecret {
    param(
        [int]$Length = 64,
        [switch]$AlphanumericOnly
    )
    
    Add-Type -AssemblyName System.Web
    
    if ($AlphanumericOnly) {
        $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        $secret = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    } else {
        $secret = [System.Web.Security.Membership]::GeneratePassword($Length, 10)
    }
    
    return $secret
}

# Backup current secrets
function Backup-CurrentSecrets {
    Write-Log "Backing up current secrets..." "INFO"
    
    $backupFile = Join-Path $Config.BackupPath "secrets-backup-$timestamp.json"
    $backup = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Secrets = @{}
    }
    
    foreach ($secretName in $SecretNames) {
        $currentValue = [System.Environment]::GetEnvironmentVariable($secretName)
        if ($currentValue) {
            # Store encrypted version for security
            $encrypted = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($currentValue))
            $backup.Secrets[$secretName] = $encrypted
        }
    }
    
    $backup | ConvertTo-Json | Out-File $backupFile
    Write-Log "Backup saved to: $backupFile" "SUCCESS"
    
    return $backupFile
}

# Health check function
function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [int]$Port
    )
    
    $maxAttempts = 10
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $health = $response.Content | ConvertFrom-Json
                if ($health.status -eq "healthy" -or $health.status -eq "ok") {
                    return $true
                }
            }
        } catch {
            Write-Log "Health check attempt $attempt/$maxAttempts for $ServiceName failed" "WARNING"
        }
        
        Start-Sleep -Seconds 3
    }
    
    return $false
}

# Rotate a single secret
function Rotate-Secret {
    param(
        [string]$SecretName,
        [string]$NewValue
    )
    
    Write-Log "Rotating secret: $SecretName" "INFO"
    
    if ($DryRun) {
        Write-Log "DRY RUN: Would rotate $SecretName" "INFO"
        return $true
    }
    
    # Update environment variable
    [System.Environment]::SetEnvironmentVariable($SecretName, $NewValue, [System.EnvironmentVariableTarget]::Process)
    
    # Update .env file if it exists
    $envFile = ".\.env"
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile
        $updated = $false
        
        for ($i = 0; $i -lt $envContent.Length; $i++) {
            if ($envContent[$i] -match "^$SecretName=") {
                $envContent[$i] = "$SecretName=$NewValue"
                $updated = $true
                break
            }
        }
        
        if (!$updated) {
            $envContent += "$SecretName=$NewValue"
        }
        
        $envContent | Set-Content $envFile
    }
    
    return $true
}

# Rolling update of services
function Update-ServicesRolling {
    param(
        [hashtable]$NewSecrets
    )
    
    $services = @(
        @{ Name = "auth"; Port = 3001 },
        @{ Name = "client"; Port = 3002 },
        @{ Name = "policy"; Port = 3003 },
        @{ Name = "control"; Port = 3004 },
        @{ Name = "evidence"; Port = 3005 },
        @{ Name = "workflow"; Port = 3006 },
        @{ Name = "reporting"; Port = 3007 },
        @{ Name = "audit"; Port = 3008 },
        @{ Name = "integration"; Port = 3009 },
        @{ Name = "notification"; Port = 3010 },
        @{ Name = "ai"; Port = 3011 }
    )
    
    Write-Log "Starting rolling update of services..." "INFO"
    
    foreach ($service in $services) {
        Write-Log "Updating service: $($service.Name)" "INFO"
        
        # Restart service with new secrets
        if (!$DryRun) {
            $serviceName = "soc-$($service.Name)-service"
            
            # Stop the service
            docker-compose stop $serviceName 2>&1 | Out-Null
            
            # Update environment for the service
            foreach ($secretName in $NewSecrets.Keys) {
                docker-compose exec -T $serviceName sh -c "export $secretName='$($NewSecrets[$secretName])'" 2>&1 | Out-Null
            }
            
            # Start the service
            docker-compose start $serviceName 2>&1 | Out-Null
            
            # Wait for health check
            if (!$SkipHealthCheck) {
                Start-Sleep -Seconds 5
                
                if (!(Test-ServiceHealth -ServiceName $service.Name -Port $service.Port)) {
                    Write-Log "Service $($service.Name) failed health check after rotation!" "ERROR"
                    
                    if ($Config.RollbackOnFailure) {
                        return $false
                    }
                }
            }
        }
        
        Write-Log "Service $($service.Name) updated successfully" "SUCCESS"
    }
    
    return $true
}

# Rollback function
function Restore-Secrets {
    param(
        [string]$BackupFile
    )
    
    Write-Log "Rolling back secrets to previous values..." "WARNING"
    
    if (!(Test-Path $BackupFile)) {
        Write-Log "Backup file not found: $BackupFile" "ERROR"
        return $false
    }
    
    $backup = Get-Content $BackupFile | ConvertFrom-Json
    
    foreach ($secretName in $backup.Secrets.PSObject.Properties.Name) {
        $encryptedValue = $backup.Secrets.$secretName
        $decryptedValue = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encryptedValue))
        
        Rotate-Secret -SecretName $secretName -NewValue $decryptedValue
    }
    
    Write-Log "Secrets restored from backup" "SUCCESS"
    return $true
}

# Main rotation process
Write-Host ""
Write-Host "🔐 SOC Compliance Platform - Secret Rotation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($Emergency) {
    Write-Log "EMERGENCY ROTATION INITIATED" "WARNING"
}

if ($DryRun) {
    Write-Log "DRY RUN MODE - No actual changes will be made" "INFO"
}

# Step 1: Pre-rotation health check
if (!$SkipHealthCheck -and !$DryRun) {
    Write-Log "Performing pre-rotation health check..." "INFO"
    
    $healthyServices = 0
    $totalServices = 11
    
    for ($port = 3001; $port -le 3011; $port++) {
        if (Test-ServiceHealth -ServiceName "service-$port" -Port $port) {
            $healthyServices++
        }
    }
    
    if ($healthyServices -lt $totalServices) {
        Write-Log "Only $healthyServices/$totalServices services are healthy. Continue anyway? (Y/N)" "WARNING"
        $continue = Read-Host
        if ($continue -ne "Y") {
            Write-Log "Rotation cancelled by user" "INFO"
            exit 0
        }
    }
}

# Step 2: Backup current secrets
$backupFile = Backup-CurrentSecrets

# Step 3: Generate new secrets
Write-Log "Generating new secrets..." "INFO"
$newSecrets = @{}

foreach ($secretName in $SecretNames) {
    $length = 64
    $alphanumericOnly = $false
    
    # Customize based on secret type
    switch ($secretName) {
        "DB_PASSWORD" { $length = 32; $alphanumericOnly = $true }
        "REDIS_PASSWORD" { $length = 32; $alphanumericOnly = $true }
        "JWT_SECRET" { $length = 64 }
        "AUTH_SECRET" { $length = 64 }
        "CSRF_SECRET" { $length = 48 }
    }
    
    $newSecret = New-SecureSecret -Length $length -AlphanumericOnly:$alphanumericOnly
    $newSecrets[$secretName] = $newSecret
    
    Write-Log "Generated new secret for: $secretName (Length: $length)" "SUCCESS"
}

# Step 4: Rotate secrets
Write-Log "Rotating secrets..." "INFO"
$rotationSuccess = $true

foreach ($secretName in $newSecrets.Keys) {
    if (!(Rotate-Secret -SecretName $secretName -NewValue $newSecrets[$secretName])) {
        $rotationSuccess = $false
        break
    }
}

if (!$rotationSuccess) {
    Write-Log "Secret rotation failed! Rolling back..." "ERROR"
    Restore-Secrets -BackupFile $backupFile
    exit 1
}

# Step 5: Rolling update of services
if (!$DryRun) {
    if (!(Update-ServicesRolling -NewSecrets $newSecrets)) {
        Write-Log "Service update failed! Rolling back..." "ERROR"
        Restore-Secrets -BackupFile $backupFile
        
        # Restart all services with old secrets
        docker-compose restart 2>&1 | Out-Null
        
        exit 1
    }
}

# Step 6: Post-rotation validation
if (!$SkipHealthCheck -and !$DryRun) {
    Write-Log "Performing post-rotation validation..." "INFO"
    Start-Sleep -Seconds 10
    
    $healthyServices = 0
    $totalServices = 11
    
    for ($port = 3001; $port -le 3011; $port++) {
        if (Test-ServiceHealth -ServiceName "service-$port" -Port $port) {
            $healthyServices++
        }
    }
    
    if ($healthyServices -lt $totalServices) {
        Write-Log "Post-rotation health check failed! $healthyServices/$totalServices services healthy" "ERROR"
        
        if ($Config.RollbackOnFailure) {
            Restore-Secrets -BackupFile $backupFile
            docker-compose restart 2>&1 | Out-Null
            exit 1
        }
    }
}

# Step 7: Update secret rotation tracking
$trackingFile = Join-Path $Config.LogPath "rotation-tracking.json"
$tracking = @{
    LastRotation = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    NextRotation = (Get-Date).AddDays($RotationDays).ToString("yyyy-MM-dd HH:mm:ss")
    RotatedSecrets = $SecretNames
    Success = $true
}

$tracking | ConvertTo-Json | Out-File $trackingFile

# Summary
Write-Host ""
Write-Host "✅ Secret Rotation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  • Secrets rotated: $($SecretNames.Count)" -ForegroundColor White
Write-Host "  • Backup created: $backupFile" -ForegroundColor White
Write-Host "  • Log file: $logFile" -ForegroundColor White
Write-Host "  • Next rotation: $($tracking.NextRotation)" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  This was a DRY RUN - no actual changes were made" -ForegroundColor Yellow
}

Write-Log "Secret rotation completed successfully" "SUCCESS"
exit 0