# PowerShell script to create Docker Swarm secrets
# This script creates Docker Swarm external secrets for production deployment
# Usage: .\docker-secrets\create-swarm-secrets.ps1

param (
    [switch]$Force,
    [switch]$DryRun,
    [string]$Environment = "production"
)

# Ensure we're in the project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Function to create a Docker Swarm secret
function New-SwarmSecret {
    param(
        [string]$SecretName,
        [string]$SecretValue,
        [string]$Description = ""
    )
    
    $swarmSecretName = "soc_${SecretName}"
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would create secret: $swarmSecretName" -ForegroundColor Yellow
        return
    }
    
    # Check if secret already exists
    $existingSecret = docker secret ls --filter "name=$swarmSecretName" --format "{{.Name}}" 2>$null
    
    if ($existingSecret -and -not $Force) {
        Write-Host "Secret '$swarmSecretName' already exists. Use -Force to recreate." -ForegroundColor Yellow
        return
    }
    
    if ($existingSecret -and $Force) {
        Write-Host "Removing existing secret: $swarmSecretName" -ForegroundColor Yellow
        docker secret rm $swarmSecretName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to remove existing secret: $swarmSecretName"
            return
        }
    }
    
    # Create the secret
    $SecretValue | docker secret create $swarmSecretName - | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Created secret: $swarmSecretName" -ForegroundColor Green
        if ($Description) {
            Write-Host "  Description: $Description" -ForegroundColor Gray
        }
    } else {
        Write-Error "Failed to create secret: $swarmSecretName"
    }
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

# Check if Docker Swarm is initialized
$swarmInfo = docker info --format "{{.Swarm.LocalNodeState}}" 2>$null
if ($swarmInfo -ne "active") {
    Write-Error "Docker Swarm is not initialized. Run 'docker swarm init' first."
    exit 1
}

Write-Host "Creating Docker Swarm secrets for $Environment environment..." -ForegroundColor Blue

# Check if we have development secrets to use as templates
$useDevSecrets = Test-Path "docker-secrets/postgres_password.txt"

if ($useDevSecrets -and -not $Force) {
    Write-Host "Found development secrets. Using as templates..." -ForegroundColor Green
    
    # Database secrets from files
    if (Test-Path "docker-secrets/postgres_password.txt") {
        $postgresPassword = Get-Content "docker-secrets/postgres_password.txt" -Raw
        $postgresUser = Get-Content "docker-secrets/postgres_user.txt" -Raw -ErrorAction SilentlyContinue
        if (-not $postgresUser) { $postgresUser = "soc_user" }
        
        New-SwarmSecret "postgres_password" $postgresPassword "PostgreSQL database password"
        New-SwarmSecret "postgres_user" $postgresUser "PostgreSQL database user"
    }
    
    if (Test-Path "docker-secrets/redis_password.txt") {
        $redisPassword = Get-Content "docker-secrets/redis_password.txt" -Raw
        New-SwarmSecret "redis_password" $redisPassword "Redis authentication password"
    }
    
    if (Test-Path "docker-secrets/mongo_root_password.txt") {
        $mongoPassword = Get-Content "docker-secrets/mongo_root_password.txt" -Raw
        $mongoUser = Get-Content "docker-secrets/mongo_root_username.txt" -Raw -ErrorAction SilentlyContinue
        if (-not $mongoUser) { $mongoUser = "soc_user" }
        
        New-SwarmSecret "mongo_root_password" $mongoPassword "MongoDB root password"
        New-SwarmSecret "mongo_root_username" $mongoUser "MongoDB root username"
    }
    
    if (Test-Path "docker-secrets/jwt_secret.txt") {
        $jwtSecret = Get-Content "docker-secrets/jwt_secret.txt" -Raw
        New-SwarmSecret "jwt_secret" $jwtSecret "JWT signing secret"
    }
    
    if (Test-Path "docker-secrets/grafana_admin_password.txt") {
        $grafanaPassword = Get-Content "docker-secrets/grafana_admin_password.txt" -Raw
        New-SwarmSecret "grafana_admin_password" $grafanaPassword "Grafana admin password"
    }
    
} else {
    Write-Host "Generating new production secrets..." -ForegroundColor Green
    
    # Generate database secrets
    $postgresPassword = New-RandomPassword -Length 32
    $postgresUser = "soc_user"
    $redisPassword = New-RandomPassword -Length 32
    $mongoPassword = New-RandomPassword -Length 32
    $mongoUser = "soc_user"
    
    New-SwarmSecret "postgres_password" $postgresPassword "PostgreSQL database password"
    New-SwarmSecret "postgres_user" $postgresUser "PostgreSQL database user"
    New-SwarmSecret "redis_password" $redisPassword "Redis authentication password"
    New-SwarmSecret "mongo_root_password" $mongoPassword "MongoDB root password"
    New-SwarmSecret "mongo_root_username" $mongoUser "MongoDB root username"
    
    # Generate application secrets
    $jwtSecret = New-JwtSecret
    New-SwarmSecret "jwt_secret" $jwtSecret "JWT signing secret"
    
    # Generate monitoring secrets
    $grafanaPassword = New-RandomPassword -Length 16
    New-SwarmSecret "grafana_admin_password" $grafanaPassword "Grafana admin password"
}

# External service secrets (these need to be provided manually)
Write-Host "`nCreating placeholder external service secrets..." -ForegroundColor Yellow
Write-Host "You will need to update these with real values!" -ForegroundColor Red

$externalSecrets = @{
    "aws_access_key_id" = @{
        value = "your-aws-access-key-id"
        description = "AWS Access Key ID"
    }
    "aws_secret_access_key" = @{
        value = "your-aws-secret-access-key"
        description = "AWS Secret Access Key"
    }
    "smtp_user" = @{
        value = "your-smtp-username"
        description = "SMTP username"
    }
    "smtp_pass" = @{
        value = "your-smtp-password"
        description = "SMTP password"
    }
    "openai_api_key" = @{
        value = "sk-your-openai-api-key"
        description = "OpenAI API key"
    }
}

foreach ($secret in $externalSecrets.GetEnumerator()) {
    # Try to get from development secrets first
    $devSecretFile = "docker-secrets/$($secret.Key).txt"
    if (Test-Path $devSecretFile) {
        $secretValue = Get-Content $devSecretFile -Raw
        if ($secretValue -and $secretValue -notlike "*your-*") {
            New-SwarmSecret $secret.Key $secretValue $secret.Value.description
            continue
        }
    }
    
    # Otherwise use placeholder
    New-SwarmSecret $secret.Key $secret.Value.value $secret.Value.description
}

# Create a script to update external secrets
$updateScript = @"
# Script to update external service secrets
# Update these with your real credentials

# AWS credentials
echo "your-real-aws-access-key-id" | docker secret create soc_aws_access_key_id_new -
docker service update --secret-rm soc_aws_access_key_id --secret-add soc_aws_access_key_id_new auth-service
docker secret rm soc_aws_access_key_id
docker secret create soc_aws_access_key_id your-real-aws-access-key-id

echo "your-real-aws-secret-access-key" | docker secret create soc_aws_secret_access_key_new -
docker service update --secret-rm soc_aws_secret_access_key --secret-add soc_aws_secret_access_key_new auth-service
docker secret rm soc_aws_secret_access_key
docker secret create soc_aws_secret_access_key your-real-aws-secret-access-key

# SMTP credentials
echo "your-real-smtp-username" | docker secret create soc_smtp_user_new -
docker service update --secret-rm soc_smtp_user --secret-add soc_smtp_user_new notification-service
docker secret rm soc_smtp_user
docker secret create soc_smtp_user your-real-smtp-username

echo "your-real-smtp-password" | docker secret create soc_smtp_pass_new -
docker service update --secret-rm soc_smtp_pass --secret-add soc_smtp_pass_new notification-service
docker secret rm soc_smtp_pass
docker secret create soc_smtp_pass your-real-smtp-password

# OpenAI API key
echo "sk-your-real-openai-api-key" | docker secret create soc_openai_api_key_new -
docker service update --secret-rm soc_openai_api_key --secret-add soc_openai_api_key_new ai-service
docker secret rm soc_openai_api_key
docker secret create soc_openai_api_key sk-your-real-openai-api-key
"@

Set-Content -Path "docker-secrets/update-external-secrets.sh" -Value $updateScript
Write-Host "Created script: docker-secrets/update-external-secrets.sh" -ForegroundColor Green

if (-not $DryRun) {
    Write-Host "`n" -NoNewline
    Write-Host "✅ Docker Swarm secrets created successfully!" -ForegroundColor Green
    
    # List created secrets
    Write-Host "`nCreated secrets:" -ForegroundColor Blue
    docker secret ls --filter "name=soc_" --format "table {{.Name}}\t{{.CreatedAt}}" | Write-Host
    
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Update external service secrets with real values" -ForegroundColor White
    Write-Host "2. Deploy the stack: docker stack deploy -c docker-compose.yml -c docker-compose.secrets.yml -c docker-compose.production.yml soc-platform" -ForegroundColor White
    Write-Host "3. Monitor deployment: docker stack services soc-platform" -ForegroundColor White
    
    Write-Host "`nSecurity Notes:" -ForegroundColor Red
    Write-Host "- Secrets are encrypted at rest in Docker Swarm" -ForegroundColor White
    Write-Host "- Only services that need a secret have access to it" -ForegroundColor White
    Write-Host "- Rotate secrets regularly using the update script" -ForegroundColor White
    Write-Host "- Monitor secret access through Docker events" -ForegroundColor White
} else {
    Write-Host "`n[DRY RUN] No secrets were actually created." -ForegroundColor Yellow
    Write-Host "Remove -DryRun flag to create secrets for real." -ForegroundColor White
}