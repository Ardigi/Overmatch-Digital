#!/bin/sh
# Vault initialization and setup script
# This script initializes Vault, enables auth methods, and creates policies

set -e

# Configuration
VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}
KEYS_FILE="/vault/keys/vault-keys.json"
ROOT_TOKEN_FILE="/vault/keys/root-token"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Wait for Vault to be ready
wait_for_vault() {
    log "Waiting for Vault to be ready..."
    for i in $(seq 1 30); do
        if vault status > /dev/null 2>&1; then
            success "Vault is ready"
            return 0
        fi
        log "Attempt $i/30: Vault not ready, waiting 5 seconds..."
        sleep 5
    done
    error "Vault failed to become ready after 150 seconds"
    exit 1
}

# Initialize Vault if not already initialized
initialize_vault() {
    log "Checking Vault initialization status..."
    
    if vault status | grep -q "Initialized.*true"; then
        warn "Vault is already initialized"
        if [ -f "$ROOT_TOKEN_FILE" ]; then
            export VAULT_TOKEN=$(cat "$ROOT_TOKEN_FILE")
            log "Using existing root token"
        else
            error "Vault is initialized but root token file not found"
            exit 1
        fi
        return 0
    fi
    
    log "Initializing Vault..."
    vault operator init -key-shares=5 -key-threshold=3 -format=json > "$KEYS_FILE"
    
    if [ $? -eq 0 ]; then
        success "Vault initialized successfully"
        
        # Extract root token
        cat "$KEYS_FILE" | jq -r '.root_token' > "$ROOT_TOKEN_FILE"
        export VAULT_TOKEN=$(cat "$ROOT_TOKEN_FILE")
        
        # Extract unseal keys
        for i in $(seq 0 2); do
            cat "$KEYS_FILE" | jq -r ".unseal_keys_b64[$i]" > "/vault/keys/unseal-key-$i"
        done
        
        success "Keys and tokens saved"
    else
        error "Failed to initialize Vault"
        exit 1
    fi
}

# Unseal Vault
unseal_vault() {
    log "Checking Vault seal status..."
    
    if vault status | grep -q "Sealed.*false"; then
        success "Vault is already unsealed"
        return 0
    fi
    
    log "Unsealing Vault..."
    for i in $(seq 0 2); do
        if [ -f "/vault/keys/unseal-key-$i" ]; then
            vault operator unseal "$(cat /vault/keys/unseal-key-$i)"
            log "Applied unseal key $i"
        else
            error "Unseal key $i not found"
            exit 1
        fi
    done
    
    if vault status | grep -q "Sealed.*false"; then
        success "Vault unsealed successfully"
    else
        error "Failed to unseal Vault"
        exit 1
    fi
}

# Enable auth methods
enable_auth_methods() {
    log "Enabling authentication methods..."
    
    # Enable AppRole auth method
    if ! vault auth list | grep -q "approle"; then
        vault auth enable approle
        success "AppRole auth method enabled"
    else
        log "AppRole auth method already enabled"
    fi
    
    # Enable userpass auth method
    if ! vault auth list | grep -q "userpass"; then
        vault auth enable userpass
        success "Userpass auth method enabled"
    else
        log "Userpass auth method already enabled"
    fi
}

# Create policies
create_policies() {
    log "Creating Vault policies..."
    
    # Database admin policy
    cat << 'EOF' | vault policy write database-admin -
path "secret/data/database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/database/*" {
  capabilities = ["list"]
}
EOF
    success "Database admin policy created"
    
    # Application secrets policy
    cat << 'EOF' | vault policy write application-secrets -
path "secret/data/application/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/application/*" {
  capabilities = ["list"]
}
EOF
    success "Application secrets policy created"
    
    # Service-specific policies
    services=("auth" "client" "audit" "evidence" "policy" "control" "notification" "reporting" "integration" "ai")
    
    for service in "${services[@]}"; do
        cat << EOF | vault policy write "${service}-service" -
# Database access
path "secret/data/database/postgres" {
  capabilities = ["read"]
}
path "secret/data/database/redis" {
  capabilities = ["read"]
}
path "secret/data/database/mongodb" {
  capabilities = ["read"]
}

# Service-specific application secrets
path "secret/data/application/${service}" {
  capabilities = ["read"]
}

# External service secrets (as needed)
path "secret/data/external/*" {
  capabilities = ["read"]
}

# Monitoring secrets
path "secret/data/monitoring/*" {
  capabilities = ["read"]
}
EOF
        success "${service}-service policy created"
    done
}

# Create AppRoles for services
create_approles() {
    log "Creating AppRoles for services..."
    
    services=("auth" "client" "audit" "evidence" "policy" "control" "notification" "reporting" "integration" "ai")
    
    for service in "${services[@]}"; do
        # Create AppRole
        vault write auth/approle/role/"${service}-service" \
            token_policies="${service}-service" \
            token_ttl=1h \
            token_max_ttl=4h \
            bind_secret_id=true
        
        # Get role-id and secret-id
        role_id=$(vault read -field=role_id auth/approle/role/"${service}-service"/role-id)
        secret_id=$(vault write -field=secret_id -f auth/approle/role/"${service}-service"/secret-id)
        
        # Save credentials
        echo "$role_id" > "/vault/keys/${service}-role-id"
        echo "$secret_id" > "/vault/keys/${service}-secret-id"
        
        success "AppRole created for ${service}-service"
    done
}

# Create initial secrets
create_initial_secrets() {
    log "Creating initial secrets..."
    
    # Check if we have development secrets files
    if [ -f "/docker-secrets/postgres_password.txt" ]; then
        # Load from development secret files
        vault kv put secret/database/postgres \
            username="$(cat /docker-secrets/postgres_user.txt 2>/dev/null || echo 'soc_user')" \
            password="$(cat /docker-secrets/postgres_password.txt)"
        
        vault kv put secret/database/redis \
            password="$(cat /docker-secrets/redis_password.txt)"
        
        vault kv put secret/database/mongodb \
            root_username="$(cat /docker-secrets/mongo_root_username.txt 2>/dev/null || echo 'soc_user')" \
            root_password="$(cat /docker-secrets/mongo_root_password.txt)"
        
        vault kv put secret/application/auth \
            jwt_secret="$(cat /docker-secrets/jwt_secret.txt)"
        
        vault kv put secret/monitoring/grafana \
            admin_password="$(cat /docker-secrets/grafana_admin_password.txt)"
        
        success "Secrets loaded from development files"
    else
        # Generate new secrets
        log "No development secrets found, generating new ones..."
        
        # Generate random passwords
        postgres_pass=$(openssl rand -base64 32)
        redis_pass=$(openssl rand -base64 32)
        mongo_pass=$(openssl rand -base64 32)
        jwt_secret=$(openssl rand -base64 64)
        grafana_pass=$(openssl rand -base64 16)
        
        vault kv put secret/database/postgres \
            username="soc_user" \
            password="$postgres_pass"
        
        vault kv put secret/database/redis \
            password="$redis_pass"
        
        vault kv put secret/database/mongodb \
            root_username="soc_user" \
            root_password="$mongo_pass"
        
        vault kv put secret/application/auth \
            jwt_secret="$jwt_secret"
        
        vault kv put secret/monitoring/grafana \
            admin_password="$grafana_pass"
        
        success "Generated and stored new secrets"
    fi
    
    # Create placeholder external secrets
    vault kv put secret/external/aws \
        access_key_id="your-aws-access-key-id" \
        secret_access_key="your-aws-secret-access-key"
    
    vault kv put secret/external/smtp \
        username="your-smtp-username" \
        password="your-smtp-password"
    
    vault kv put secret/external/openai \
        api_key="sk-your-openai-api-key"
    
    success "Placeholder external secrets created"
}

# Create admin user
create_admin_user() {
    log "Creating admin user..."
    
    admin_password=$(openssl rand -base64 16)
    vault write auth/userpass/users/admin \
        password="$admin_password" \
        policies="database-admin,application-secrets"
    
    echo "$admin_password" > "/vault/keys/admin-password"
    success "Admin user created with password saved to /vault/keys/admin-password"
}

# Enable audit logging
enable_audit_logging() {
    log "Enabling audit logging..."
    
    if ! vault audit list | grep -q "file"; then
        vault audit enable file file_path=/vault/logs/audit.log
        success "File audit logging enabled"
    else
        log "File audit logging already enabled"
    fi
}

# Main execution
main() {
    log "Starting Vault initialization process..."
    
    wait_for_vault
    initialize_vault
    unseal_vault
    
    # Enable KV secrets engine v2 if not already enabled
    if ! vault secrets list | grep -q "secret/"; then
        vault secrets enable -path=secret kv-v2
        success "KV secrets engine v2 enabled"
    else
        log "KV secrets engine already enabled"
    fi
    
    enable_auth_methods
    create_policies
    create_approles
    create_initial_secrets
    create_admin_user
    enable_audit_logging
    
    success "Vault initialization completed successfully!"
    
    log "Summary:"
    log "- Root token: /vault/keys/root-token"
    log "- Unseal keys: /vault/keys/unseal-key-*"
    log "- Admin password: /vault/keys/admin-password"
    log "- Service credentials: /vault/keys/*-role-id and *-secret-id"
    log "- Vault UI: http://localhost:8200/ui"
    
    warn "Please secure the keys and tokens appropriately!"
}

# Run main function
main "$@"