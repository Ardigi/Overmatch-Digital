# Auth Service Secrets Migration Guide

This document describes the pilot implementation of the @soc-compliance/secrets package in the Auth Service, demonstrating zero-downtime migration and backward compatibility.

## Overview

The Auth Service has been migrated to use the enterprise secrets management system with full backward compatibility. The service will:

1. **Try secrets manager first** (if available and healthy)
2. **Fallback to environment variables** (existing .env files)
3. **Maintain zero downtime** during migration
4. **Support secret rotation** for JWT keys
5. **Provide health monitoring** for secrets availability

## Architecture Changes

### New Components

1. **DynamicConfigService** - Provides configuration from secrets or env vars
2. **JwtRotationService** - Handles automatic JWT secret rotation
3. **SecretsHealthIndicator** - Health checks for secrets availability
4. **Enhanced App Module** - Integrated secrets with fallback logic

### Configuration Priority

```
1. Secrets Manager (if healthy) → 2. Environment Variables → 3. Default Values
```

## Migration Steps

### Phase 1: Install and Configure (Zero Downtime)

```bash
# 1. Install dependencies
npm install

# 2. Build shared packages
npm run build:shared

# 3. Service continues working with existing .env files
npm run start:dev
```

The service will automatically:
- Detect if secrets manager is available
- Fall back to environment variables if not
- Log the configuration source being used

### Phase 2: Enable Secrets Manager (Development)

```bash
# Create local secrets directory
mkdir -p ./secrets

# Add to .env file:
SECRETS_MASTER_KEY=your-development-master-key-here
```

The service will automatically use local encrypted storage for secrets while maintaining .env fallback.

### Phase 3: Production Migration

```bash
# Set production environment variables:
NODE_ENV=production
AWS_REGION=us-east-1

# Remove these from .env after migration:
# JWT_SECRET (will be managed by secrets)
# DB_PASSWORD (will be managed by secrets)  
# REDIS_PASSWORD (will be managed by secrets)
```

In production, the service will:
- Use AWS Secrets Manager automatically
- Rotate JWT secrets every 30 days
- Maintain high availability with circuit breakers

## Configuration Reference

### Environment Variables (Backward Compatible)

All existing environment variables continue to work:

```bash
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=soc_auth

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=8h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass

# Secrets (New)
SECRETS_MASTER_KEY=dev-master-key-change-in-production
AWS_REGION=us-east-1
```

### Secrets Manager Keys

When using secrets manager, these keys will be automatically managed:

- `JWT_SECRET` - JWT signing secret (auto-rotated)
- `DB_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password

## Health Monitoring

### Health Check Endpoints

```bash
# Basic health (includes secrets fallback status)
GET /health

# Detailed secrets health
GET /health/secrets

# Simple health (no dependencies)
GET /health/simple
```

### Health Check Responses

```json
{
  "status": "ok",
  "info": {
    "secrets": {
      "status": "up",
      "message": "Using secrets manager"
    }
  }
}
```

Or with fallback:

```json
{
  "status": "ok",
  "info": {
    "secrets": {
      "status": "fallback",
      "message": "Using environment variables"
    }
  }
}
```

## Secret Rotation

### JWT Secret Rotation

- **Automatic**: Every 30 days in production
- **Manual**: Call `JwtRotationService.rotateJwtKey()`
- **Monitoring**: Check rotation status via health endpoints

### Rotation Status

```typescript
interface KeyRotationStatus {
  lastRotation: Date;
  nextRotation: Date;
  rotationCount: number;
  status: 'healthy' | 'warning' | 'error';
  currentKeyAge: number; // in days
}
```

## Testing the Migration

### Run Migration Tests

```bash
# Test the migration implementation
node test-secrets-migration.js
```

This will verify:
- Package dependencies are correct
- App module structure is valid
- Configuration services work
- Secrets integration is properly implemented

### Manual Testing

```bash
# 1. Test with environment variables only
NODE_ENV=development npm run start:dev

# 2. Test with secrets manager (if available)
SECRETS_MASTER_KEY=test-key npm run start:dev

# 3. Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3001/health/secrets
```

## Error Handling

### Fallback Scenarios

1. **Secrets service unavailable** → Use environment variables
2. **Secret not found** → Use environment variable
3. **Network timeout** → Circuit breaker opens, use cached values
4. **Invalid configuration** → Log error, use defaults where safe

### Logging

The service logs configuration sources:

```
[DynamicConfigService] Retrieved JWT_SECRET from secrets manager
[DynamicConfigService] Retrieved DB_HOST from environment variables
[AppModule] SecretsModule failed to initialize, continuing with env vars
```

## Security Considerations

### Development

- Uses local encrypted storage with master key
- Secrets are encrypted at rest
- Master key should be unique per environment

### Production

- Uses AWS Secrets Manager with IAM roles
- Automatic secret rotation
- Audit logging for all secret access
- Circuit breaker protection

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check if JWT_SECRET is available
   echo $JWT_SECRET
   
   # Check secrets service logs
   npm run start:dev | grep -i secret
   ```

2. **Secrets not loading**
   ```bash
   # Test health endpoint
   curl http://localhost:3001/health/secrets
   
   # Check AWS credentials (production)
   aws sts get-caller-identity
   ```

3. **Fallback not working**
   ```bash
   # Verify environment variables
   printenv | grep -E "(JWT_SECRET|DB_PASSWORD|REDIS_PASSWORD)"
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=auth-service:* npm run start:dev
```

## Migration Validation

### Success Criteria

- ✅ Service starts successfully with existing .env files
- ✅ Authentication works (JWT tokens can be issued and validated)
- ✅ Database connections work
- ✅ Redis connections work
- ✅ Health checks return successful status
- ✅ Service gracefully handles secrets service unavailability

### Performance Impact

- **Minimal**: Configuration loading happens at startup
- **Caching**: Secrets are cached for 5 minutes
- **Circuit Breaker**: Prevents cascading failures
- **Zero Downtime**: Fallback ensures continuous operation

## Next Steps

After successful pilot in Auth Service:

1. **Monitor Production** - Verify stability and performance
2. **Document Lessons Learned** - Update migration patterns
3. **Rollout to Other Services** - Use Auth Service as template
4. **Enhanced Features** - Add more sophisticated rotation policies

## Support

For issues or questions about the secrets migration:

1. Check logs for configuration source messages
2. Test health endpoints for secrets availability
3. Verify environment variables are still present
4. Review this migration guide for troubleshooting steps

The migration is designed to be safe and reversible - if issues occur, the service will automatically fall back to environment variables.