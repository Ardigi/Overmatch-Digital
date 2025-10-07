# setup-external-services.ps1
# Sets up external services for SOC Compliance Platform

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("all", "email", "storage", "ai")]
    [string]$Service = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$Production = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { Write-Host $args[0] -ForegroundColor Blue }
function Write-Success { Write-Host $args[0] -ForegroundColor Green }
function Write-Error { Write-Host $args[0] -ForegroundColor Red }
function Write-Warning { Write-Host $args[0] -ForegroundColor Yellow }

# Check if Docker is running
function Test-Docker {
    try {
        docker ps | Out-Null
        return $true
    } catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        return $false
    }
}

# Start external services containers
function Start-ExternalServices {
    Write-Info "Starting external services containers..."
    
    # Check if soc-network exists
    $network = docker network ls --filter name=soc-network --format "{{.Name}}"
    if (-not $network) {
        Write-Info "Creating soc-network..."
        docker network create soc-network
    }
    
    # Start services
    docker-compose -f docker/external/docker-compose.external-services.yml up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "External services started successfully"
    } else {
        Write-Error "Failed to start external services"
        exit 1
    }
}

# Configure email service
function Configure-Email {
    param([bool]$IsProduction)
    
    Write-Info "Configuring email service..."
    
    if ($IsProduction) {
        # Production: SendGrid
        if (-not $env:SENDGRID_API_KEY) {
            Write-Warning "SENDGRID_API_KEY not set. Please set it in your environment."
            $apiKey = Read-Host "Enter SendGrid API Key" -AsSecureString
            $env:SENDGRID_API_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
        }
        
        # Create .env.production file
        $envContent = @"
# Email Configuration (Production)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=$($env:SENDGRID_API_KEY)
EMAIL_FROM=noreply@soc-compliance.com
EMAIL_FROM_NAME=SOC Compliance Platform

# SendGrid Templates
SENDGRID_TEMPLATE_WELCOME=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_PASSWORD_RESET=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_MFA_SETUP=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_AUDIT_COMPLETED=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_CONTROL_REMINDER=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_EVIDENCE_REQUEST=d-xxxxxxxxxxxxx
"@
        Set-Content -Path ".env.production" -Value $envContent
        Write-Success "Production email configuration created"
        
    } else {
        # Development: MailDev
        Write-Info "Waiting for MailDev to be ready..."
        Start-Sleep -Seconds 5
        
        # Test MailDev connection
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:1080" -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "MailDev is running at http://localhost:1080"
            }
        } catch {
            Write-Warning "MailDev might not be fully ready yet. Check http://localhost:1080"
        }
        
        # Create .env.development file
        $envContent = @"
# Email Configuration (Development)
EMAIL_PROVIDER=maildev
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=noreply@soc-compliance.local
EMAIL_FROM_NAME=SOC Compliance Platform (Dev)

# MailDev Web Interface
MAILDEV_URL=http://localhost:1080
"@
        Set-Content -Path ".env.development" -Value $envContent
        Write-Success "Development email configuration created"
    }
}

# Configure storage service
function Configure-Storage {
    param([bool]$IsProduction)
    
    Write-Info "Configuring storage service..."
    
    if ($IsProduction) {
        # Production: AWS S3
        if (-not $env:AWS_ACCESS_KEY_ID) {
            Write-Warning "AWS credentials not set. Please configure AWS credentials."
            $accessKey = Read-Host "Enter AWS Access Key ID"
            $secretKey = Read-Host "Enter AWS Secret Access Key" -AsSecureString
            $env:AWS_ACCESS_KEY_ID = $accessKey
            $env:AWS_SECRET_ACCESS_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey))
        }
        
        # Append to .env.production
        $envContent = @"

# Storage Configuration (Production)
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=$($env:AWS_ACCESS_KEY_ID)
AWS_SECRET_ACCESS_KEY=$($env:AWS_SECRET_ACCESS_KEY)
AWS_REGION=us-east-1
S3_BUCKET_EVIDENCE=soc-compliance-evidence
S3_BUCKET_REPORTS=soc-compliance-reports
S3_BUCKET_AUDIT=soc-compliance-audit
"@
        Add-Content -Path ".env.production" -Value $envContent
        Write-Success "Production storage configuration added"
        
    } else {
        # Development: MinIO
        Write-Info "Waiting for MinIO to be ready..."
        Start-Sleep -Seconds 10
        
        # Test MinIO connection
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:9001" -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "MinIO Console is running at http://localhost:9001"
                Write-Info "Default credentials: soc_admin / soc_password"
            }
        } catch {
            Write-Warning "MinIO might not be fully ready yet. Check http://localhost:9001"
        }
        
        # Append to .env.development
        $envContent = @"

# Storage Configuration (Development)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=soc_admin
MINIO_SECRET_KEY=soc_password
S3_BUCKET_EVIDENCE=soc-evidence
S3_BUCKET_REPORTS=soc-reports
S3_BUCKET_AUDIT=soc-audit-files

# MinIO Console
MINIO_CONSOLE_URL=http://localhost:9001
"@
        Add-Content -Path ".env.development" -Value $envContent
        Write-Success "Development storage configuration added"
    }
}

# Configure AI service
function Configure-AI {
    param([bool]$IsProduction)
    
    Write-Info "Configuring AI service..."
    
    if ($IsProduction -or $env:OPENAI_API_KEY) {
        # Production or Development with API key
        if (-not $env:OPENAI_API_KEY) {
            Write-Warning "OPENAI_API_KEY not set. AI features will use mock responses."
            $useOpenAI = Read-Host "Do you want to configure OpenAI API? (y/n)"
            
            if ($useOpenAI -eq 'y') {
                $apiKey = Read-Host "Enter OpenAI API Key" -AsSecureString
                $env:OPENAI_API_KEY = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey))
            }
        }
        
        if ($env:OPENAI_API_KEY) {
            $envContent = @"

# AI Configuration (OpenAI)
AI_PROVIDER=openai
OPENAI_API_KEY=$($env:OPENAI_API_KEY)
OPENAI_MODEL_CHAT=gpt-4-turbo-preview
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
OPENAI_MODEL_COMPLETION=gpt-3.5-turbo-instruct
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# AI Features
AI_FEATURE_COMPLIANCE=true
AI_FEATURE_RISK=true
AI_FEATURE_CONTROL=true
AI_FEATURE_SUMMARY=true
AI_FEATURE_ANOMALY=true
AI_FEATURE_NLQ=true

# AI Rate Limits
AI_RATE_LIMIT_RPM=60
AI_RATE_LIMIT_TPM=90000
AI_CONCURRENT_REQUESTS=10
"@
        } else {
            $envContent = @"

# AI Configuration (Mock)
AI_PROVIDER=mock
AI_MOCK_DELAY=500
AI_MOCK_ERROR_RATE=0.05

# AI Features (all enabled for mock)
AI_FEATURE_COMPLIANCE=true
AI_FEATURE_RISK=true
AI_FEATURE_CONTROL=true
AI_FEATURE_SUMMARY=true
AI_FEATURE_ANOMALY=true
AI_FEATURE_NLQ=true
"@
        }
        
        $targetFile = if ($IsProduction) { ".env.production" } else { ".env.development" }
        Add-Content -Path $targetFile -Value $envContent
        Write-Success "AI configuration added"
        
    } else {
        # Development: Mock responses
        $envContent = @"

# AI Configuration (Mock)
AI_PROVIDER=mock
AI_MOCK_DELAY=500
AI_MOCK_ERROR_RATE=0.05

# AI Features (all enabled for mock)
AI_FEATURE_COMPLIANCE=true
AI_FEATURE_RISK=true
AI_FEATURE_CONTROL=true
AI_FEATURE_SUMMARY=true
AI_FEATURE_ANOMALY=true
AI_FEATURE_NLQ=true
"@
        Add-Content -Path ".env.development" -Value $envContent
        Write-Success "Development AI configuration added (using mock responses)"
    }
}

# Main execution
Write-Info "=== SOC Compliance Platform - External Services Setup ==="

# Check Docker
if (-not (Test-Docker)) {
    exit 1
}

# Start containers if not in production mode
if (-not $Production) {
    Start-ExternalServices
}

# Configure services based on selection
switch ($Service) {
    "all" {
        Configure-Email -IsProduction $Production
        Configure-Storage -IsProduction $Production
        Configure-AI -IsProduction $Production
    }
    "email" {
        Configure-Email -IsProduction $Production
    }
    "storage" {
        Configure-Storage -IsProduction $Production
    }
    "ai" {
        Configure-AI -IsProduction $Production
    }
}

# Display summary
Write-Info "`n=== Configuration Summary ==="
if (-not $Production) {
    Write-Success "Development services are running:"
    Write-Info "  - MailDev: http://localhost:1080"
    Write-Info "  - MinIO Console: http://localhost:9001 (soc_admin/soc_password)"
    Write-Info "  - Configuration: .env.development"
} else {
    Write-Success "Production configuration created:"
    Write-Info "  - Configuration: .env.production"
    Write-Warning "Remember to:"
    Write-Warning "  - Set up SendGrid templates"
    Write-Warning "  - Create S3 buckets in AWS"
    Write-Warning "  - Configure OpenAI API access"
}

Write-Info "`nTo stop external services: docker-compose -f docker/external/docker-compose.external-services.yml down"
Write-Success "`nExternal services setup completed!"