# Enterprise Secrets Management Guide

## Overview

The SOC Compliance Platform implements enterprise-grade secrets management using infrastructure-level solutions (Docker Secrets, HashiCorp Vault, Kubernetes Secrets) with services consuming secrets via environment variables. This approach follows the 12-Factor App methodology and microservices best practices.

**Last Updated**: August 14, 2025

## Table of Contents

1. [Architecture](#architecture)
2. [Infrastructure Providers](#infrastructure-providers)
3. [Service Implementation](#service-implementation)
4. [Migration Guide](#migration-guide)
5. [Operations](#operations)
6. [Security](#security)
7. [Compliance](#compliance)
8. [Troubleshooting](#troubleshooting)

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer (Managed)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  │   Docker    │ │ HashiCorp   │ │ Kubernetes  │ │    AWS    ││
│  │  Secrets    │ │   Vault     │ │  Secrets    │ │ Secrets   ││
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘│
│         └────────────────┴────────────────┴──────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                    Secret Injection Methods                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ • Environment Variables (primary)                           ││
│  │ • Mounted Files at /run/secrets/ (Docker Swarm)           ││
│  │ • ConfigMaps & Secrets (Kubernetes)                        ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                       Service Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐│
│  │   Auth      │ │   Policy    │ │   Client    │ │  Control  ││
│  │  Service    │ │  Service    │ │  Service    │ │  Service  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘│
│         (Read secrets from environment variables)                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Infrastructure Manages Secrets**: Docker, Kubernetes, or cloud providers handle secret storage and rotation
2. **Services Consume via Environment**: Services read secrets from environment variables
3. **No Application-Level Management**: Services do not manage, rotate, or store secrets
4. **12-Factor Compliance**: Configuration via environment variables
5. **Zero Trust**: Services only receive the secrets they need

## Infrastructure Providers

### Docker Secrets (Development & Swarm)

Docker secrets provide file-based secret management for development and Docker Swarm deployments.

#### Setup

```bash
# Generate development secrets
.\docker-secrets\create-dev-secrets.ps1

# Start services with secrets
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up
```

#### Docker Compose Configuration

```yaml
# docker-compose.secrets.yml
services:
  auth-service:
    secrets:
      - postgres_password
      - jwt_secret
    environment:
      DB_PASSWORD_FILE: /run/secrets/postgres_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  postgres_password:
    file: ./docker-secrets/postgres_password.txt
  jwt_secret:
    file: ./docker-secrets/jwt_secret.txt
```

### HashiCorp Vault (Production)

Vault provides centralized secret management for production environments.

#### Vault Agent Configuration

```hcl
# vault-agent.hcl
auto_auth {
  method {
    type = "kubernetes"
    config {
      role = "auth-service"
    }
  }
}

template {
  source = "/vault/templates/env.tpl"
  destination = "/vault/secrets/.env"
  exec {
    command = ["sh", "-c", "export $(cat /vault/secrets/.env | xargs) && exec node dist/main.js"]
  }
}
```

### Kubernetes Secrets

Native Kubernetes secret management for K8s deployments.

#### Kubernetes Configuration

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secrets
type: Opaque
data:
  DB_PASSWORD: <base64-encoded>
  JWT_SECRET: <base64-encoded>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    spec:
      containers:
      - name: auth-service
        envFrom:
        - secretRef:
            name: auth-service-secrets
```

### AWS Secrets Manager with ECS

For AWS-native deployments using ECS.

```json
{
  "family": "auth-service",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "auth-service",
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:jwt-secret"
        }
      ]
    }
  ]
}
```

## Service Implementation

### Reading Secrets in Services

Services should read secrets directly from environment variables:

```typescript
// config/configuration.ts
export default () => ({
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'dev_password', // Only default in dev
    database: process.env.DB_NAME || 'soc_auth',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD, // No default for security
  },
});
```

### TypeORM Configuration

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get('database.host'),
    port: configService.get('database.port'),
    username: configService.get('database.username'),
    password: configService.get('database.password'),
    database: configService.get('database.database'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
  }),
  inject: [ConfigService],
})
```

### Redis Configuration

```typescript
// redis.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    store: redisStore,
    host: configService.get('redis.host'),
    port: configService.get('redis.port'),
    password: configService.get('redis.password'),
    ttl: 300,
  }),
  inject: [ConfigService],
})
```

### Reading from Files (Docker Secrets)

When using Docker secrets that mount as files:

```typescript
// config/configuration.ts
import { readFileSync } from 'fs';

function getSecret(envVar: string, fileVar: string, defaultValue?: string): string {
  // First try environment variable
  if (process.env[envVar]) {
    return process.env[envVar];
  }
  
  // Then try file path from environment
  const filePath = process.env[fileVar];
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      console.warn(`Failed to read secret from ${filePath}:`, error.message);
    }
  }
  
  // Fall back to default (dev only)
  if (defaultValue && process.env.NODE_ENV === 'development') {
    return defaultValue;
  }
  
  throw new Error(`Secret ${envVar} not found`);
}

export default () => ({
  database: {
    password: getSecret('DB_PASSWORD', 'DB_PASSWORD_FILE', 'dev_password'),
  },
  jwt: {
    secret: getSecret('JWT_SECRET', 'JWT_SECRET_FILE', 'dev_jwt_secret'),
  },
});
```

## Migration Guide

### Migrating from Application-Level to Infrastructure-Level

Services should read secrets directly from environment variables instead of using application-level secret management libraries. This follows 12-Factor App principles.

1. **Remove any application-level secret management code**
2. **Use environment variables directly**
3. **Let infrastructure handle secret injection**

### Environment Variable Naming Convention

Use consistent naming across all services:

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=<secret>
DB_NAME=soc_auth

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=<secret>

# JWT
JWT_SECRET=<secret>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<secret>
JWT_REFRESH_EXPIRES_IN=7d

# External Services
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
SMTP_USER=<secret>
SMTP_PASSWORD=<secret>
OPENAI_API_KEY=<secret>
```

## Operations

### Secret Rotation

Secret rotation is handled at the infrastructure level:

#### Docker Swarm
```bash
# Update secret
echo "new_password" | docker secret create postgres_password_v2 -
docker service update --secret-rm postgres_password --secret-add postgres_password_v2 auth-service
docker secret rm postgres_password
docker secret create postgres_password postgres_password_v2
```

#### Kubernetes
```bash
# Update secret
kubectl create secret generic auth-secrets \
  --from-literal=DB_PASSWORD=new_password \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secrets
kubectl rollout restart deployment/auth-service
```

#### HashiCorp Vault
```bash
# Update secret in Vault
vault kv put secret/database password=new_password

# Vault Agent will automatically update
```

### Monitoring Secret Usage

Monitor environment variable access at the infrastructure level:

```yaml
# Prometheus rule for Kubernetes
- alert: SecretAccessAnomaly
  expr: rate(container_env_var_reads{env_var=~".*PASSWORD.*|.*SECRET.*"}[5m]) > 100
  for: 5m
```

## Security

### Best Practices

1. **Never Log Secrets**: Ensure secrets are not logged
   ```typescript
   // logging.interceptor.ts
   const sanitized = { ...data };
   ['password', 'secret', 'token', 'key'].forEach(key => {
     if (sanitized[key]) sanitized[key] = '[REDACTED]';
   });
   ```

2. **Use Defaults Only in Development**
   ```typescript
   const password = process.env.DB_PASSWORD || 
     (process.env.NODE_ENV === 'development' ? 'dev_password' : undefined);
   if (!password) throw new Error('DB_PASSWORD is required');
   ```

3. **Validate Required Secrets on Startup**
   ```typescript
   // main.ts
   const requiredEnvVars = ['DB_PASSWORD', 'JWT_SECRET', 'REDIS_PASSWORD'];
   for (const envVar of requiredEnvVars) {
     if (!process.env[envVar]) {
       throw new Error(`Missing required environment variable: ${envVar}`);
     }
   }
   ```

4. **Use Least Privilege**: Services only get the secrets they need
   ```yaml
   # Each service gets only its required secrets
   auth-service:
     environment:
       - DB_PASSWORD
       - JWT_SECRET
   
   notification-service:
     environment:
       - SMTP_PASSWORD
   ```

## Compliance

### SOC 2 Requirements

- ✅ **CC6.1**: Access controls managed by infrastructure
- ✅ **CC6.6**: TLS for secret transmission (infrastructure level)
- ✅ **CC6.7**: Encryption at rest (provider managed)
- ✅ **CC7.2**: Audit logging at infrastructure level
- ✅ **CC8.1**: Change management via infrastructure

### Audit Trail

Infrastructure providers maintain audit logs:

#### Docker
```bash
# Docker events for secret access
docker events --filter type=secret
```

#### Kubernetes
```bash
# Audit log for secret access
kubectl get events --field-selector involvedObject.kind=Secret
```

#### Vault
```bash
# Vault audit log
vault audit list
tail -f /vault/logs/audit.log
```

## Troubleshooting

### Common Issues

#### Environment Variable Not Set
```bash
# Check if variable is set
echo $DB_PASSWORD

# Check all environment variables
env | grep -E "DB_|REDIS_|JWT_"

# In container
docker exec <container> env | grep PASSWORD
```

#### Secret File Not Found (Docker Secrets)
```bash
# Check if secret exists
docker secret ls

# Check mount in container
docker exec <container> ls -la /run/secrets/

# Check file content (be careful)
docker exec <container> cat /run/secrets/postgres_password
```

#### Permission Issues
```bash
# Ensure proper file permissions (Docker secrets)
ls -la docker-secrets/

# Fix permissions
chmod 600 docker-secrets/*.txt
```

### Debug Commands

```bash
# Test database connection with environment variable
DB_PASSWORD=$DB_PASSWORD psql -U $DB_USERNAME -h $DB_HOST -d $DB_NAME -c "SELECT 1"

# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Check service configuration
curl http://localhost:3001/health/config
```

## Current State (August 14, 2025)

### Migration Status
- ✅ **Policy Service**: Successfully migrated to infrastructure-level management, deployed to Docker
- ⚠️ **Auth Service**: Needs migration from application-level to infrastructure-level
- ⚠️ **Evidence Service**: Needs migration from application-level to infrastructure-level
- ✅ **Client Service**: Already using infrastructure-level management
- ✅ **Control Service**: Already using infrastructure-level management
- ✅ **Other Services**: Already using infrastructure-level management

### Docker Deployment Status
- ✅ **Policy Service**: Running in Docker with environment variables
- ⚠️ **Other Services**: Need Docker deployment with proper environment configuration

## Next Steps

1. **Complete Migration** (Priority: High)
   - Remove application-level secrets from auth-service
   - Remove application-level secrets from evidence-service
   - Delete any unused secrets packages after migration

2. **Docker Deployment** (Priority: High)
   - Deploy auth-service to Docker with environment variables
   - Deploy client-service to Docker  
   - Deploy control-service to Docker
   - Deploy remaining services

3. **Production Setup** (Priority: Medium)
   - Configure AWS Secrets Manager integration
   - Set up HashiCorp Vault for on-premise option
   - Implement secret rotation policies

4. **Security Hardening** (Priority: Medium)
   - Add secret validation on service startup
   - Implement secret usage monitoring
   - Set up audit logging for secret access

5. **Documentation** (Priority: Low)
   - Update each service README with required environment variables
   - Create deployment runbooks for each environment
   - Document secret rotation procedures

## Summary

The infrastructure-managed approach to secrets:

1. **Simplifies application code** - Services just read environment variables
2. **Reduces complexity** - No application-level secret management
3. **Improves security** - Infrastructure handles encryption and access control
4. **Enables better compliance** - Centralized audit trails
5. **Follows best practices** - 12-Factor App methodology

Services focus on business logic while infrastructure handles the complex task of secret management, rotation, and security.

---

**Document Status**: Updated for infrastructure-managed secrets
**Last Updated**: August 14, 2025
**Previous Approach**: Application-level SecretsModule (deprecated)
**Current Approach**: Infrastructure-level management via environment variables