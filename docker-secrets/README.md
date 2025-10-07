# Docker Secrets Management

This directory contains enterprise secrets management configuration for the SOC Compliance Platform. It supports both development and production deployments with proper secrets isolation.

## Overview

The secrets management system provides:
- **File-based secrets** for Docker Compose development
- **HashiCorp Vault integration** for centralized secrets management
- **Docker Swarm secrets** for production deployments
- **Secure defaults** with proper file permissions
- **Environment isolation** between dev/staging/production

## Quick Start

### 1. Generate Development Secrets

```powershell
# Generate all development secrets
.\docker-secrets\create-dev-secrets.ps1

# Force regenerate existing secrets
.\docker-secrets\create-dev-secrets.ps1 -Force

# Generate secrets and store in Vault
.\docker-secrets\create-dev-secrets.ps1 -Vault
```

### 2. Start Services with Secrets

```bash
# Using secrets overlay
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up

# Using environment file
docker-compose --env-file .env.secrets up

# Start with Vault integration
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml -f docker-compose.vault.yml up
```

## Architecture

### Development Mode
- Uses file-based secrets in `./docker-secrets/` directory
- HashiCorp Vault in development mode (in-memory storage)
- Secrets mounted as files in containers at `/run/secrets/`
- Environment variables point to secret files

### Production Mode
- Docker Swarm external secrets
- HashiCorp Vault with persistent storage and HA
- Consul backend for Vault clustering
- TLS encryption for all secret transmission

## Secrets Structure

### Database Secrets
| Secret File | Description | Service Usage |
|-------------|-------------|---------------|
| `postgres_password.txt` | PostgreSQL password | All services with DB access |
| `postgres_user.txt` | PostgreSQL username | All services with DB access |
| `redis_password.txt` | Redis authentication | Auth, Control, Notification, Reporting |
| `mongo_root_password.txt` | MongoDB root password | Evidence, AI services |
| `mongo_root_username.txt` | MongoDB root username | Evidence, AI services |

### Application Secrets
| Secret File | Description | Service Usage |
|-------------|-------------|---------------|
| `jwt_secret.txt` | JWT signing key | Auth service |
| `grafana_admin_password.txt` | Grafana admin password | Monitoring |

### External Service Secrets
| Secret File | Description | Service Usage |
|-------------|-------------|---------------|
| `aws_access_key_id.txt` | AWS access key | Evidence, Reporting services |
| `aws_secret_access_key.txt` | AWS secret key | Evidence, Reporting services |
| `smtp_user.txt` | SMTP username | Notification service |
| `smtp_pass.txt` | SMTP password | Notification service |
| `openai_api_key.txt` | OpenAI API key | AI service |

## HashiCorp Vault Integration

### Development Setup

Vault runs in development mode with:
- **Address**: `http://localhost:8200`
- **Root Token**: `soc-dev-token`
- **Storage**: In-memory (ephemeral)
- **UI**: Enabled at `http://localhost:8200/ui`

### Vault Secrets Structure

```
secret/
├── database/
│   ├── postgres    # username, password
│   ├── redis       # password
│   └── mongodb     # root_username, root_password
├── application/
│   └── auth        # jwt_secret
├── external/
│   ├── aws         # access_key_id, secret_access_key
│   ├── smtp        # username, password
│   └── openai      # api_key
└── monitoring/
    └── grafana     # admin_password
```

### Vault CLI Usage

```bash
# Set Vault address and token
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="soc-dev-token"

# Store a secret
vault kv put secret/database/postgres username="soc_user" password="secure_password"

# Retrieve a secret
vault kv get secret/database/postgres

# List all secrets
vault kv list secret/
```

### Vault API Usage

```bash
# Store secret via API
curl -X PUT -H "X-Vault-Token: soc-dev-token" \
  -d '{"data": {"username": "soc_user", "password": "secure_password"}}' \
  http://localhost:8200/v1/secret/data/database/postgres

# Retrieve secret via API
curl -H "X-Vault-Token: soc-dev-token" \
  http://localhost:8200/v1/secret/data/database/postgres
```

## Production Deployment

### Docker Swarm Setup

```bash
# Initialize Docker Swarm
docker swarm init

# Create external secrets
echo "production_postgres_password" | docker secret create postgres_password -
echo "production_redis_password" | docker secret create redis_password -
echo "production_jwt_secret" | docker secret create jwt_secret -

# Deploy stack with secrets
docker stack deploy -c docker-compose.yml -c docker-compose.secrets.yml -c docker-compose.production.yml soc-platform
```

### Kubernetes Setup

```yaml
# kubernetes-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: soc-database-secrets
type: Opaque
data:
  postgres-password: <base64-encoded-password>
  redis-password: <base64-encoded-password>
---
apiVersion: v1
kind: Secret
metadata:
  name: soc-application-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-jwt-secret>
```

### Vault Production Configuration

```hcl
# vault.hcl
storage "consul" {
  address = "consul:8500"
  path    = "vault/"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_cert_file = "/vault/tls/vault.crt"
  tls_key_file  = "/vault/tls/vault.key"
}

api_addr = "https://vault.example.com:8200"
cluster_addr = "https://vault.example.com:8201"
ui = true
```

## Security Best Practices

### File Permissions
The PowerShell script automatically sets restrictive permissions:
- **Windows**: Only current user has access
- **Linux**: `600` permissions (owner read/write only)

### Secrets Rotation
```powershell
# Rotate database passwords
.\docker-secrets\create-dev-secrets.ps1 -Force

# Update specific secret
echo "new_password" > docker-secrets/postgres_password.txt

# Restart affected services
docker-compose restart postgres auth-service client-service
```

### Environment Isolation
- **Development**: `.env.secrets` with generated values
- **Staging**: `.env.staging` with staging-specific secrets
- **Production**: External secrets management (Vault/K8s)

### Access Control
- Vault policies for service-specific access
- Docker secrets with least-privilege assignment
- Network policies to restrict Vault access

## Troubleshooting

### Common Issues

1. **Secret file not found**
   ```bash
   Error: open /run/secrets/postgres_password: no such file or directory
   ```
   - Ensure `docker-compose.secrets.yml` is included
   - Verify secret files exist in `docker-secrets/` directory

2. **Vault connection failed**
   ```bash
   Error: unable to connect to Vault
   ```
   - Check Vault container is running: `docker ps | grep vault`
   - Verify Vault address: `http://localhost:8200`
   - Confirm token is correct: `soc-dev-token`

3. **Permission denied accessing secret**
   ```bash
   Error: permission denied: /run/secrets/jwt_secret
   ```
   - Service user must be in `secrets` group (Linux)
   - Check Docker Compose secrets configuration

### Debug Commands

```bash
# Check secret files exist
ls -la docker-secrets/

# Verify secret content (be careful with sensitive data)
docker exec <container> cat /run/secrets/postgres_password

# Check Vault status
docker exec vault-dev vault status

# List mounted secrets in container
docker exec <container> ls -la /run/secrets/
```

### Vault Debugging

```bash
# Check Vault logs
docker logs vault-dev

# Test Vault API
curl -H "X-Vault-Token: soc-dev-token" http://localhost:8200/v1/sys/health

# Verify secret exists
vault kv get secret/database/postgres
```

## Migration Guide

### From Hardcoded to Secrets

1. **Update service configuration** to read from secret files:
   ```javascript
   // Before
   const password = process.env.DB_PASSWORD || 'default_password';
   
   // After
   const fs = require('fs');
   const password = process.env.DB_PASSWORD_FILE 
     ? fs.readFileSync(process.env.DB_PASSWORD_FILE, 'utf8').trim()
     : process.env.DB_PASSWORD || 'default_password';
   ```

2. **Update Docker Compose** files:
   ```yaml
   # Before
   environment:
     DB_PASSWORD: hardcoded_password
   
   # After
   secrets:
     - postgres_password
   environment:
     DB_PASSWORD_FILE: /run/secrets/postgres_password
   ```

3. **Test the migration**:
   ```bash
   # Generate secrets
   .\docker-secrets\create-dev-secrets.ps1
   
   # Start with secrets
   docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up
   ```

## Monitoring and Auditing

### Vault Audit Logging
```bash
# Enable file audit logging
vault audit enable file file_path=/vault/logs/audit.log

# View audit logs
docker exec vault-dev cat /vault/logs/audit.log
```

### Secret Access Monitoring
```bash
# Monitor secret file access (Linux)
auditctl -w /var/lib/docker/volumes/project_secrets/

# Check Docker events for secret mounts
docker events --filter type=secret
```

## Additional Resources

- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Docker Compose Secrets](https://docs.docker.com/compose/compose-file/compose-file-v3/#secrets)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

## Support

For issues with secrets management:
1. Check the troubleshooting section above
2. Review Docker Compose logs: `docker-compose logs`
3. Verify Vault health: `vault status`
4. Ensure all secret files are present and readable