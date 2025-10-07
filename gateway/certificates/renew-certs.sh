#!/bin/bash
# Certificate renewal script for production environments
# Supports Let's Encrypt (certbot) and custom CA certificates

set -e

# Configuration
DOMAIN=${DOMAIN:-"soc-platform.com"}
EMAIL=${EMAIL:-"admin@soc-platform.com"}
CERT_PATH=${CERT_PATH:-"/etc/letsencrypt/live/$DOMAIN"}
KONG_CERT_PATH=${KONG_CERT_PATH:-"/usr/local/kong/ssl"}
BACKUP_PATH=${BACKUP_PATH:-"/var/backups/certificates"}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}
RENEWAL_DAYS=${RENEWAL_DAYS:-30}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    send_notification "ERROR" "$1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    send_notification "WARNING" "$1"
}

# Send notifications
send_notification() {
    local level=$1
    local message=$2
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST $SLACK_WEBHOOK \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"Certificate Renewal ${level}: ${message}\"}" \
            2>/dev/null || true
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "This script must be run as root"
fi

# Create backup directory
mkdir -p "$BACKUP_PATH"

# Check certificate expiration
check_expiration() {
    local cert_file=$1
    local days_until_expiry
    
    if [ -f "$cert_file" ]; then
        days_until_expiry=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2 | xargs -I {} bash -c 'echo $(( ($(date -d "{}" +%s) - $(date +%s)) / 86400 ))')
        echo $days_until_expiry
    else
        echo 0
    fi
}

# Backup current certificates
backup_certificates() {
    local backup_dir="$BACKUP_PATH/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    log "Backing up current certificates to $backup_dir"
    
    if [ -d "$CERT_PATH" ]; then
        cp -r "$CERT_PATH" "$backup_dir/" || warning "Failed to backup Let's Encrypt certificates"
    fi
    
    if [ -d "$KONG_CERT_PATH" ]; then
        cp -r "$KONG_CERT_PATH" "$backup_dir/" || warning "Failed to backup Kong certificates"
    fi
    
    # Keep only last 10 backups
    ls -t "$BACKUP_PATH" | tail -n +11 | xargs -I {} rm -rf "$BACKUP_PATH/{}"
}

# Renew Let's Encrypt certificate
renew_letsencrypt() {
    log "Checking Let's Encrypt certificate for renewal..."
    
    local cert_file="$CERT_PATH/fullchain.pem"
    local days_remaining=$(check_expiration "$cert_file")
    
    if [ "$days_remaining" -lt "$RENEWAL_DAYS" ]; then
        log "Certificate expires in $days_remaining days. Renewing..."
        
        # Pre-renewal backup
        backup_certificates
        
        # Attempt renewal
        if certbot renew --non-interactive --agree-tos --email "$EMAIL"; then
            log "Certificate renewed successfully"
            
            # Copy to Kong directory
            deploy_to_kong
            
            # Reload Kong
            reload_kong
            
            send_notification "SUCCESS" "Certificate renewed successfully for $DOMAIN"
        else
            error "Certificate renewal failed"
        fi
    else
        log "Certificate is valid for $days_remaining more days. No renewal needed."
    fi
}

# Deploy certificates to Kong
deploy_to_kong() {
    log "Deploying certificates to Kong..."
    
    mkdir -p "$KONG_CERT_PATH"
    
    # Copy Let's Encrypt certificates
    if [ -d "$CERT_PATH" ]; then
        cp "$CERT_PATH/fullchain.pem" "$KONG_CERT_PATH/server.crt"
        cp "$CERT_PATH/privkey.pem" "$KONG_CERT_PATH/server.key"
        
        # Set proper permissions
        chmod 644 "$KONG_CERT_PATH/server.crt"
        chmod 600 "$KONG_CERT_PATH/server.key"
        chown kong:kong "$KONG_CERT_PATH"/*
        
        log "Certificates deployed to Kong"
    else
        error "Certificate path not found: $CERT_PATH"
    fi
}

# Reload Kong
reload_kong() {
    log "Reloading Kong configuration..."
    
    # Check if Kong is running
    if kong health; then
        kong reload
        log "Kong reloaded successfully"
    else
        warning "Kong is not running. Starting Kong..."
        kong start
    fi
}

# Verify certificate deployment
verify_deployment() {
    log "Verifying certificate deployment..."
    
    # Check Kong HTTPS endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN --insecure)
    
    if [ "$response" = "200" ] || [ "$response" = "404" ]; then
        log "HTTPS endpoint is responding correctly"
        
        # Check certificate details
        echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
    else
        error "HTTPS endpoint verification failed with status: $response"
    fi
}

# Install certbot if not present
install_certbot() {
    if ! command -v certbot &> /dev/null; then
        log "Installing certbot..."
        
        if [ -f /etc/debian_version ]; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx
        elif [ -f /etc/redhat-release ]; then
            yum install -y epel-release
            yum install -y certbot python3-certbot-nginx
        else
            error "Unsupported operating system for automatic certbot installation"
        fi
    fi
}

# Initial certificate setup
initial_setup() {
    log "Running initial certificate setup..."
    
    install_certbot
    
    # Stop Kong temporarily for standalone mode
    kong stop || true
    
    # Obtain initial certificate
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --domains "$DOMAIN,*.$DOMAIN" \
        --expand
    
    # Deploy to Kong
    deploy_to_kong
    
    # Start Kong
    kong start
}

# Main execution
main() {
    log "Starting certificate renewal process for $DOMAIN"
    
    # Check if certificates exist
    if [ ! -d "$CERT_PATH" ]; then
        log "No existing certificates found. Running initial setup..."
        initial_setup
    else
        # Run renewal check
        renew_letsencrypt
    fi
    
    # Verify deployment
    verify_deployment
    
    log "Certificate renewal process completed"
}

# Setup cron job for automatic renewal
setup_cron() {
    local cron_schedule="0 2 * * *"  # Daily at 2 AM
    local cron_command="$0"
    
    # Check if cron job already exists
    if ! crontab -l 2>/dev/null | grep -q "$cron_command"; then
        log "Setting up cron job for automatic renewal..."
        (crontab -l 2>/dev/null; echo "$cron_schedule $cron_command >> /var/log/cert-renewal.log 2>&1") | crontab -
        log "Cron job created: $cron_schedule"
    else
        log "Cron job already exists"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --setup-cron)
            setup_cron
            exit 0
            ;;
        --initial-setup)
            initial_setup
            exit 0
            ;;
        --verify)
            verify_deployment
            exit 0
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --setup-cron     Setup automatic renewal via cron"
            echo "  --initial-setup  Run initial certificate setup"
            echo "  --verify         Verify certificate deployment"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
    shift
done

# Run main function
main