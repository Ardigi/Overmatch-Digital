# PowerShell script to create development secrets for Docker Compose
# This script generates secure development secrets and stores them in files
# Usage: .\docker-secrets\create-dev-secrets.ps1

param (
    [switch]$Force,
    [switch]$Vault,
    [string]$VaultAddr = "http://localhost:8200",
    [string]$VaultToken = "soc-dev-token"
)

# Ensure we're in the project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Create docker-secrets directory if it doesn't exist
$secretsDir = "docker-secrets"
if (-not (Test-Path $secretsDir)) {
    New-Item -Path $secretsDir -ItemType Directory -Force | Out-Null
    Write-Host "Created $secretsDir directory" -ForegroundColor Green
}

# Function to generate a random password
function New-RandomPassword {
    param([int]$Length = 32)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    $password = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $password
}

# Function to generate a JWT secret
function New-JwtSecret {
    $bytes = New-Object byte[] 64
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# Function to create or update a secret file
function Set-SecretFile {
    param(
        [string]$FileName,
        [string]$Value,
        [string]$Description = ""
    )
    
    $filePath = Join-Path $secretsDir $FileName
    
    if ((Test-Path $filePath) -and -not $Force) {
        Write-Host "Secret file '$FileName' already exists. Use -Force to overwrite." -ForegroundColor Yellow
        return
    }
    
    # Write the secret to file (no trailing newline)
    [System.IO.File]::WriteAllText($filePath, $Value, [System.Text.Encoding]::UTF8)
    
    # Set restrictive permissions (Windows)
    $acl = Get-Acl $filePath
    $acl.SetAccessRuleProtection($true, $false)  # Inherit=false, preserve=false
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
        "FullControl",
        "Allow"
    )
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $filePath -AclObject $acl
    
    Write-Host "Created secret: $FileName" -ForegroundColor Green
    if ($Description) {
        Write-Host "  Description: $Description" -ForegroundColor Gray
    }
}

# Function to store secret in Vault
function Set-VaultSecret {
    param(
        [string]$Path,
        [hashtable]$Data
    )
    
    if (-not $Vault) {
        return
    }
    
    try {
        $headers = @{
            "X-Vault-Token" = $VaultToken
        }
        
        $body = @{
            data = $Data
        } | ConvertTo-Json -Depth 3
        
        $response = Invoke-RestMethod -Uri "$VaultAddr/v1/secret/data/$Path" -Method Put -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Stored in Vault: secret/$Path" -ForegroundColor Cyan
    }
    catch {
        Write-Warning "Failed to store secret in Vault: $($_.Exception.Message)"
    }
}

Write-Host "Creating development secrets..." -ForegroundColor Blue
Write-Host "Project root: $projectRoot" -ForegroundColor Gray

# Generate database secrets
$postgresPassword = New-RandomPassword -Length 24
$postgresUser = "soc_user"
$redisPassword = New-RandomPassword -Length 24
$mongoRootPassword = New-RandomPassword -Length 24
$mongoRootUsername = "soc_user"

Set-SecretFile "postgres_password.txt" $postgresPassword "PostgreSQL database password"
Set-SecretFile "postgres_user.txt" $postgresUser "PostgreSQL database user"
Set-SecretFile "redis_password.txt" $redisPassword "Redis authentication password"
Set-SecretFile "mongo_root_password.txt" $mongoRootPassword "MongoDB root password"
Set-SecretFile "mongo_root_username.txt" $mongoRootUsername "MongoDB root username"

# Store database secrets in Vault
Set-VaultSecret "database/postgres" @{
    username = $postgresUser
    password = $postgresPassword
}
Set-VaultSecret "database/redis" @{
    password = $redisPassword
}
Set-VaultSecret "database/mongodb" @{
    root_username = $mongoRootUsername
    root_password = $mongoRootPassword
}

# Generate application secrets
$jwtSecret = New-JwtSecret
Set-SecretFile "jwt_secret.txt" $jwtSecret "JWT signing secret"

# Generate master encryption key for Control Service (256-bit AES key)
$encryptionKeyBytes = New-Object byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($encryptionKeyBytes)
$masterEncryptionKey = [BitConverter]::ToString($encryptionKeyBytes).Replace("-", "").ToLower()
Set-SecretFile "master_encryption_key.txt" $masterEncryptionKey "Master encryption key for Control Service (AES-256)"

Set-VaultSecret "application/auth" @{
    jwt_secret = $jwtSecret
}
Set-VaultSecret "application/encryption" @{
    master_key = $masterEncryptionKey
}

# Generate monitoring secrets
$grafanaAdminPassword = New-RandomPassword -Length 16
Set-SecretFile "grafana_admin_password.txt" $grafanaAdminPassword "Grafana admin password"
Set-VaultSecret "monitoring/grafana" @{
    admin_password = $grafanaAdminPassword
}

# Create placeholder files for external service secrets
$externalSecrets = @{
    "aws_access_key_id.txt" = "your-aws-access-key-id"
    "aws_secret_access_key.txt" = "your-aws-secret-access-key"
    "smtp_user.txt" = "your-smtp-username"
    "smtp_pass.txt" = "your-smtp-password"
    "openai_api_key.txt" = "sk-your-openai-api-key"
}

Write-Host "`nCreating placeholder files for external services..." -ForegroundColor Blue

foreach ($file in $externalSecrets.GetEnumerator()) {
    Set-SecretFile $file.Key $file.Value "External service credential (update with real value)"
}

# Create .env file with environment variables pointing to secrets
Write-Host "`nCreating .env.secrets file..." -ForegroundColor Blue

$envContent = @"
# Environment file for secrets-based deployment
# Use with: docker-compose --env-file .env.secrets -f docker-compose.yml -f docker-compose.secrets.yml up

# Database credentials (will be read from secret files)
POSTGRES_USER=$postgresUser
POSTGRES_PASSWORD=$postgresPassword
POSTGRES_DB=soc_compliance

# Redis credentials
REDIS_PASSWORD=$redisPassword

# MongoDB credentials
MONGO_ROOT_USERNAME=$mongoRootUsername
MONGO_ROOT_PASSWORD=$mongoRootPassword

# Application secrets
JWT_SECRET=$jwtSecret
MASTER_ENCRYPTION_KEY=$masterEncryptionKey

# External service credentials (update these with real values)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
OPENAI_API_KEY=sk-your-openai-api-key

# Monitoring
GRAFANA_ADMIN_PASSWORD=$grafanaAdminPassword

# Vault configuration
VAULT_DEV_ROOT_TOKEN=soc-dev-token
VAULT_ADDR=http://localhost:8200
"@

Set-Content -Path ".env.secrets" -Value $envContent -Encoding UTF8
Write-Host "Created .env.secrets file" -ForegroundColor Green

# Create .gitignore entries if not present
$gitignoreFile = ".gitignore"
$gitignoreEntries = @(
    "# Docker secrets",
    "docker-secrets/*.txt",
    ".env.secrets",
    ".env.vault",
    ""
)

if (Test-Path $gitignoreFile) {
    $gitignoreContent = Get-Content $gitignoreFile -Raw
    $needsUpdate = $false
    
    foreach ($entry in $gitignoreEntries) {
        if ($entry -and $gitignoreContent -notlike "*$entry*") {
            $needsUpdate = $true
            break
        }
    }
    
    if ($needsUpdate) {
        Add-Content -Path $gitignoreFile -Value "`n" + ($gitignoreEntries -join "`n")
        Write-Host "Updated .gitignore with secrets entries" -ForegroundColor Green
    }
} else {
    Set-Content -Path $gitignoreFile -Value ($gitignoreEntries -join "`n")
    Write-Host "Created .gitignore with secrets entries" -ForegroundColor Green
}

Write-Host "`n" -NoNewline
Write-Host "✅ Development secrets created successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Update external service credentials in docker-secrets/*.txt files" -ForegroundColor White
Write-Host "2. Start services with secrets: docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up" -ForegroundColor White
Write-Host "3. Access Vault UI at: http://localhost:8200 (token: soc-dev-token)" -ForegroundColor White

if ($Vault) {
    Write-Host "`nVault secrets stored at:" -ForegroundColor Cyan
    Write-Host "- secret/database/postgres" -ForegroundColor White
    Write-Host "- secret/database/redis" -ForegroundColor White
    Write-Host "- secret/database/mongodb" -ForegroundColor White
    Write-Host "- secret/application/auth" -ForegroundColor White
    Write-Host "- secret/monitoring/grafana" -ForegroundColor White
}

Write-Host "`nSecurity Notes:" -ForegroundColor Red
Write-Host "- Secret files have restrictive permissions" -ForegroundColor White
Write-Host "- Never commit secret files to version control" -ForegroundColor White
Write-Host "- Use proper secrets management in production" -ForegroundColor White
Write-Host "- Rotate secrets regularly" -ForegroundColor White