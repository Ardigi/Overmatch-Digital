# PowerShell script to deploy SOC Compliance Platform with secrets management
# This script demonstrates the complete workflow for different deployment scenarios
# Usage: .\docker-secrets\deploy-with-secrets.ps1 -Mode [Development|Staging|Production]

param (
    [Parameter(Mandatory)]
    [ValidateSet("Development", "Staging", "Production", "SwarmProduction")]
    [string]$Mode,
    
    [switch]$InitVault,
    [switch]$ForceSecrets,
    [switch]$SkipHealthCheck,
    [string]$VaultToken = "soc-dev-token"
)

# Ensure we're in the project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Colors for output
$colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Cyan = "Cyan"
    White = "White"
    Gray = "Gray"
}

function Write-ColorHost {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $colors[$Color]
}

function Write-Step {
    param([string]$Message)
    Write-ColorHost "`n▶ $Message" "Blue"
}

function Write-Success {
    param([string]$Message)
    Write-ColorHost "✅ $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorHost "⚠️  $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorHost "❌ $Message" "Red"
}

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to wait for services to be healthy
function Wait-ForServices {
    param([string[]]$Services, [int]$TimeoutSeconds = 300)
    
    if ($SkipHealthCheck) {
        Write-Warning "Skipping health check as requested"
        return
    }
    
    Write-Step "Waiting for services to become healthy..."
    $timeout = (Get-Date).AddSeconds($TimeoutSeconds)
    
    while ((Get-Date) -lt $timeout) {
        $unhealthyServices = @()
        
        foreach ($service in $Services) {
            try {
                $status = docker-compose ps -q $service 2>$null
                if (-not $status) {
                    $unhealthyServices += "$service (not running)"
                    continue
                }
                
                $health = docker inspect --format='{{.State.Health.Status}}' $status 2>$null
                if ($health -and $health -ne "healthy") {
                    $unhealthyServices += "$service ($health)"
                }
            } catch {
                $unhealthyServices += "$service (error checking)"
            }
        }
        
        if ($unhealthyServices.Count -eq 0) {
            Write-Success "All services are healthy"
            return
        }
        
        Write-ColorHost "Waiting for services: $($unhealthyServices -join ', ')" "Gray"
        Start-Sleep -Seconds 10
    }
    
    Write-Warning "Timeout waiting for services to become healthy"
}

# Main deployment function
function Start-Deployment {
    Write-ColorHost "🚀 Starting SOC Compliance Platform deployment in $Mode mode" "Cyan"
    Write-ColorHost "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Gray"
    
    # Check prerequisites
    Write-Step "Checking prerequisites..."
    
    $requiredTools = @("docker", "docker-compose")
    $missingTools = @()
    
    foreach ($tool in $requiredTools) {
        if (-not (Test-Command $tool)) {
            $missingTools += $tool
        }
    }
    
    if ($missingTools.Count -gt 0) {
        Write-Error "Missing required tools: $($missingTools -join ', ')"
        exit 1
    }
    
    Write-Success "All required tools are available"
    
    # Mode-specific deployment
    switch ($Mode) {
        "Development" {
            Deploy-Development
        }
        "Staging" {
            Deploy-Staging
        }
        "Production" {
            Deploy-Production
        }
        "SwarmProduction" {
            Deploy-SwarmProduction
        }
    }
}

function Deploy-Development {
    Write-Step "Deploying in Development mode with file-based secrets..."
    
    # Generate development secrets
    if ($ForceSecrets -or -not (Test-Path "docker-secrets/postgres_password.txt")) {
        Write-Step "Generating development secrets..."
        $params = @()
        if ($ForceSecrets) { $params += "-Force" }
        if ($InitVault) { $params += "-Vault" }
        
        & ".\docker-secrets\create-dev-secrets.ps1" @params
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to generate development secrets"
            exit 1
        }
    } else {
        Write-Success "Development secrets already exist"
    }
    
    # Start services with secrets
    Write-Step "Starting services with Docker Compose..."
    $composeFiles = @(
        "-f", "docker-compose.yml",
        "-f", "docker/secrets/docker-compose.secrets.yml"
    )
    
    if ($InitVault) {
        $composeFiles += @("-f", "docker/secrets/docker-compose.vault.yml")
    }
    
    & docker-compose @composeFiles --env-file .env.secrets up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        exit 1
    }
    
    # Wait for core services
    $coreServices = @("postgres", "redis", "mongodb", "kafka")
    if ($InitVault) {
        $coreServices += @("vault")
    }
    
    Wait-ForServices -Services $coreServices
    
    # Initialize Vault if requested
    if ($InitVault) {
        Write-Step "Initializing Vault..."
        docker exec vault-dev sh -c "
            export VAULT_ADDR=http://localhost:8200
            export VAULT_TOKEN=$VaultToken
            vault secrets enable -path=secret kv-v2 2>/dev/null || true
            echo 'Vault initialized'
        "
    }
    
    Write-Success "Development deployment completed!"
    Show-DevelopmentInfo
}

function Deploy-Staging {
    Write-Step "Deploying in Staging mode..."
    
    # Check for staging environment file
    if (-not (Test-Path ".env.staging")) {
        Write-Warning "Creating .env.staging from template..."
        Copy-Item ".env.vault.example" ".env.staging"
        Write-ColorHost "Please update .env.staging with staging-specific values" "Yellow"
    }
    
    # Use Vault for staging
    Write-Step "Starting staging services with Vault..."
    & docker-compose -f docker-compose.yml -f docker/secrets/docker-compose.vault.yml --env-file .env.staging up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start staging services"
        exit 1
    }
    
    Wait-ForServices -Services @("consul", "vault", "postgres", "redis")
    Write-Success "Staging deployment completed!"
    Show-StagingInfo
}

function Deploy-Production {
    Write-Step "Deploying in Production mode with Docker Compose..."
    
    if (-not (Test-Path ".env.production")) {
        Write-Error ".env.production file not found. Please create it with production values."
        exit 1
    }
    
    Write-Step "Starting production services..."
    & docker-compose -f docker-compose.yml -f docker/secrets/docker-compose.secrets.yml -f docker/environments/docker-compose.production.yml --env-file .env.production up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start production services"
        exit 1
    }
    
    Wait-ForServices -Services @("postgres", "redis", "vault") -TimeoutSeconds 600
    Write-Success "Production deployment completed!"
    Show-ProductionInfo
}

function Deploy-SwarmProduction {
    Write-Step "Deploying in Docker Swarm Production mode..."
    
    # Check if Docker Swarm is initialized
    $swarmStatus = docker info --format "{{.Swarm.LocalNodeState}}" 2>$null
    if ($swarmStatus -ne "active") {
        Write-Error "Docker Swarm is not initialized. Run 'docker swarm init' first."
        exit 1
    }
    
    # Create Docker Swarm secrets
    Write-Step "Creating Docker Swarm secrets..."
    $params = @()
    if ($ForceSecrets) { $params += "-Force" }
    
    & ".\docker-secrets\create-swarm-secrets.ps1" @params
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create Docker Swarm secrets"
        exit 1
    }
    
    # Deploy the stack
    Write-Step "Deploying Docker Swarm stack..."
    & docker stack deploy -c docker-compose.yml -c docker-compose.secrets.yml -c docker-compose.production.yml soc-platform
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to deploy Docker Swarm stack"
        exit 1
    }
    
    Write-Success "Docker Swarm deployment completed!"
    Show-SwarmInfo
}

function Show-DevelopmentInfo {
    Write-ColorHost "`n📋 Development Environment Information" "Cyan"
    Write-ColorHost "======================================" "Gray"
    Write-ColorHost "API Gateway:     http://localhost:8000" "White"
    Write-ColorHost "Kong Admin:      http://localhost:8001" "White"
    if ($InitVault) {
        Write-ColorHost "Vault UI:        http://localhost:8200/ui" "White"
        Write-ColorHost "Vault Token:     $VaultToken" "White"
    }
    Write-ColorHost "Grafana:         http://localhost:3030" "White"
    Write-ColorHost "Kafka UI:        http://localhost:8080" "White"
    Write-ColorHost "Prometheus:      http://localhost:9090" "White"
    
    Write-ColorHost "`n🔐 Generated Secrets Location:" "Yellow"
    Write-ColorHost "docker-secrets/*.txt files" "White"
    Write-ColorHost ".env.secrets file" "White"
    
    Write-ColorHost "`n🛠️  Useful Commands:" "Green"
    Write-ColorHost "View logs:       docker-compose logs -f [service]" "White"
    Write-ColorHost "Stop services:   docker-compose down" "White"
    Write-ColorHost "Remove volumes:  docker-compose down -v" "White"
    Write-ColorHost "Scale service:   docker-compose up -d --scale auth-service=2" "White"
}

function Show-StagingInfo {
    Write-ColorHost "`n📋 Staging Environment Information" "Cyan"
    Write-ColorHost "===================================" "Gray"
    Write-ColorHost "Configuration:   .env.staging" "White"
    Write-ColorHost "Consul UI:       http://localhost:8500" "White"
    Write-ColorHost "Vault UI:        http://localhost:8200/ui" "White"
    
    Write-ColorHost "`n🔑 Vault Commands:" "Yellow"
    Write-ColorHost "Set environment: export VAULT_ADDR=http://localhost:8200" "White"
    Write-ColorHost "Login:           vault auth -method=userpass username=admin" "White"
    Write-ColorHost "List secrets:    vault kv list secret/" "White"
}

function Show-ProductionInfo {
    Write-ColorHost "`n📋 Production Environment Information" "Cyan"
    Write-ColorHost "=====================================" "Gray"
    Write-ColorHost "Configuration:   .env.production" "White"
    Write-ColorHost "Health check:    .\scripts\check-local-health.ps1 -Detailed" "White"
    
    Write-ColorHost "`n⚠️  Security Reminders:" "Red"
    Write-ColorHost "- Update external service secrets" "White"
    Write-ColorHost "- Enable TLS for Vault in production" "White"
    Write-ColorHost "- Rotate secrets regularly" "White"
    Write-ColorHost "- Monitor audit logs" "White"
}

function Show-SwarmInfo {
    Write-ColorHost "`n📋 Docker Swarm Information" "Cyan"
    Write-ColorHost "===========================" "Gray"
    Write-ColorHost "Stack name:      soc-platform" "White"
    
    Write-ColorHost "`n🛠️  Swarm Commands:" "Green"
    Write-ColorHost "List services:   docker stack services soc-platform" "White"
    Write-ColorHost "Service logs:    docker service logs soc-platform_auth-service" "White"
    Write-ColorHost "Scale service:   docker service scale soc-platform_auth-service=3" "White"
    Write-ColorHost "Update service:  docker service update soc-platform_auth-service" "White"
    Write-ColorHost "Remove stack:    docker stack rm soc-platform" "White"
    
    Write-ColorHost "`n🔐 Secret Management:" "Yellow"
    Write-ColorHost "List secrets:    docker secret ls" "White"
    Write-ColorHost "Update secrets:  .\docker-secrets\update-external-secrets.sh" "White"
}

# Error handling
trap {
    Write-Error "An error occurred: $_"
    Write-ColorHost "`n🆘 Troubleshooting:" "Red"
    Write-ColorHost "1. Check Docker is running: docker info" "White"
    Write-ColorHost "2. Check logs: docker-compose logs" "White"
    Write-ColorHost "3. Clean up: docker-compose down -v" "White"
    Write-ColorHost "4. Check disk space: docker system df" "White"
    exit 1
}

# Start deployment
Start-Deployment

Write-ColorHost "`n🎉 Deployment completed successfully!" "Green"
Write-ColorHost "Check the information above for next steps." "White"