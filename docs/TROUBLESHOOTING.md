# Troubleshooting Guide - SOC Compliance Platform

**Last Updated**: August 10, 2025

This guide provides solutions to common issues encountered during development of the SOC Compliance Platform.

## Severity Levels

- 🔴 **CRITICAL**: System won't start or data loss risk
- 🟠 **HIGH**: Major functionality broken
- 🟡 **MEDIUM**: Feature impaired but workaround exists
- 🟢 **LOW**: Minor issue or cosmetic problem

## Table of Contents
- [Common Errors](#common-errors)
- [Frontend Circular Dependency Errors](#frontend-circular-dependency-errors) **NEW!**
- [Missing Package Dependencies](#missing-package-dependencies) **NEW!**
- [Secrets Management Issues](#secrets-management-issues)
- [Windows-Specific Issues](#windows-specific-issues)
- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Service Communication Issues](#service-communication-issues)
- [Build and Compilation Issues](#build-and-compilation-issues)
- [Testing Issues](#testing-issues)

## Common Errors

### 🟠 HIGH: Module Not Found
```bash
# Error: Cannot find module '@soc-compliance/auth-common'
# Solution: Rebuild shared packages
npm run build:shared
```

## Frontend Circular Dependency Errors

### 🔴 CRITICAL: ApiClient Initialization Error

**Error Message**:
```
ReferenceError: can't access lexical declaration 'ApiClient' before initialization
Source: lib\api\service-clients.ts
```

**Root Cause**: 
Circular dependency chain between frontend API modules:
```
api-client.ts → token-manager.ts → auth.ts → service-clients.ts → api-client.ts
```

**Solution**: 
The codebase implements lazy initialization in `lib/api/service-clients.ts`:

```typescript
// Instead of immediate instantiation:
// export const authClient = new ApiClient({ service: 'auth' });

// Uses lazy getter pattern:
Object.defineProperty(exports, 'authClient', {
  get: function() {
    if (!_authClient) {
      const { ApiClient } = require('./api-client');
      const { apiConfig } = require('./config');
      _authClient = new ApiClient({
        service: 'auth',
        baseURL: apiConfig.useKong ? apiConfig.baseURL : undefined,
      });
    }
    return _authClient;
  }
});
```

**Prevention**:
- Use type-only imports where possible: `import type { ApiClient } from './api-client';`
- Avoid circular module dependencies
- Consider dependency injection patterns

**Verification**:
```bash
# Test the fix by accessing client portal
npm run dev
# Navigate to http://localhost:3000
# Click "Client Portal" - should not show initialization error
```

## Missing Package Dependencies

### 🟡 MEDIUM: React Dropzone Error

**Error Message**:
```
Module not found: Can't resolve 'react-dropzone'
./app/dashboard/evidence/client-view.tsx:15:1
```

**Root Cause**: 
Required package `react-dropzone` is not installed in package.json dependencies.

**Solution**:
```bash
# Install the missing package
npm install react-dropzone

# Verify installation
npm list react-dropzone
```

**Common Missing Packages**:
```bash
# File upload functionality
npm install react-dropzone

# Icons
npm install @heroicons/react

# Forms and validation
npm install react-hook-form @hookform/resolvers zod

# Charts and visualizations
npm install recharts
```

**Prevention**:
- Check imports against package.json before using new libraries
- Use TypeScript strict mode to catch missing imports early
- Document required dependencies in component README files

## Secrets Management Issues

### 🔴 CRITICAL: Secret Not Found
```bash
# Error: Secret 'database.password' not found
# Solutions:

# 1. Check secrets are created
.\docker-secrets\create-dev-secrets.ps1

# 2. Verify provider configuration
echo $SECRETS_PROVIDER  # Should be 'local', 'aws', or 'vault'

# 3. Check secret exists in provider
# For local:
cat .vault/secrets.json | jq .database.password

# For AWS:
aws secretsmanager get-secret-value --secret-id soc-compliance/database/password

# For Vault:
vault kv get secret/soc-compliance/database/password
```

### 🟠 HIGH: Secret Rotation Failed
```bash
# Error: Failed to rotate secret 'jwt.secret'
# Solutions:

# 1. Check rotation permissions
# AWS: Ensure IAM role has secretsmanager:RotateSecret
# Vault: Ensure policy includes create/update on secret path

# 2. Manual rotation
npm run secrets:rotate -- --secret jwt.secret

# 3. Check service health
curl http://localhost:3001/health/secrets
```

### 🔴 CRITICAL: Provider Connection Failed
```bash
# Error: Cannot connect to secrets provider
# Solutions:

# 1. AWS Secrets Manager
# Check credentials
aws sts get-caller-identity
# Check region
echo $AWS_REGION

# 2. HashiCorp Vault
# Check Vault status
vault status
# Check authentication
vault token lookup

# 3. Fallback to environment variables
export SECRETS_PROVIDER_FALLBACK=true
```

### 🟠 HIGH: Secrets Not Reloading
```bash
# Error: Service not picking up rotated secrets
# Solutions:

# 1. Check file watchers (local provider)
ls -la /vault/secrets/

# 2. Check dynamic config service
# In service logs look for:
# [DynamicConfigService] Secret updated: database.password

# 3. Force reload
curl -X POST http://localhost:3001/admin/reload-secrets
```

### 🔴 CRITICAL: Encryption Errors (Local Provider)
```bash
# Error: Failed to decrypt secrets
# Solutions:

# 1. Check master key
echo $VAULT_MASTER_KEY

# 2. Regenerate vault (DEVELOPMENT ONLY)
rm -rf .vault
.\docker-secrets\create-dev-secrets.ps1

# 3. Check file permissions
ls -la .vault/
# Should be 600 (read/write owner only)
```

### 🟠 HIGH: Audit Log Issues
```bash
# Error: Audit logs not appearing
# Solutions:

# 1. Check audit configuration
# In SecretsModule.forRoot():
audit: {
  enabled: true,
  logLevel: 'detailed'
}

# 2. Check audit backend
# For file backend:
tail -f logs/secrets-audit.log

# For database:
SELECT * FROM audit_logs WHERE event_type LIKE 'SECRET_%' ORDER BY timestamp DESC;
```

### 🟠 HIGH: TypeORM Entity Relationship Errors
```typescript
// Error: Cannot read property 'joinColumn' of undefined
// Solution: Ensure both sides of relationship are properly defined

// ❌ WRONG - Missing inverse side
@ManyToOne(() => Organization)
organization: Organization;

// ✅ CORRECT - Both sides defined
// In Client entity:
@ManyToOne(() => Organization, org => org.clients)
organization: Organization;

// In Organization entity:
@OneToMany(() => Client, client => client.organization)
clients: Client[];
```

### 🟠 HIGH: TypeScript Compilation Errors
```typescript
// Error: Property 'X' does not exist on type 'Y'
// NEVER use 'as any' to bypass - fix the actual types

// ❌ WRONG
const value = (response as any).data;

// ✅ CORRECT - Define proper interface
interface ApiResponse {
  data: {
    id: string;
    // ... other properties
  };
}
const value = (response as ApiResponse).data;
```

### 🟠 HIGH: Entity Missing Required Fields
```typescript
// Error: column "first_name" of relation "users" does not exist
// Solution: Check migration matches entity definition

// 1. Entity should have the field
@Column({ name: 'first_name' })
firstName: string;

// 2. Migration should create the column
await queryRunner.addColumn('users', new TableColumn({
  name: 'first_name',
  type: 'varchar',
  isNullable: true
}));

// 3. If field was added later, generate new migration
npm run migration:generate -- -n AddFirstNameToUser
```

### 🔴 CRITICAL: Circular Dependency Detected
```typescript
// Error: Nest can't resolve dependencies (circular dependency)
// Solution: Use forwardRef or refactor

// ✅ Solution 1 - forwardRef
@Injectable()
export class ServiceA {
  constructor(
    @Inject(forwardRef(() => ServiceB))
    private serviceB: ServiceB
  ) {}
}

// ✅ Solution 2 - Event-driven (better)
@Injectable()
export class ServiceA {
  constructor(private eventEmitter: EventEmitter2) {}
  
  doWork() {
    this.eventEmitter.emit('work.done', { data });
  }
}
```

## Windows-Specific Issues

### 🔴 CRITICAL: Docker Desktop Issues
```bash
# Error: "Docker Desktop - WSL kernel version too low"
# Solution: Update WSL2
wsl --update
wsl --shutdown
# Restart Docker Desktop

# Error: "Cannot connect to the Docker daemon"
# Solution: Restart Docker service
Restart-Service docker
# Or restart Docker Desktop from system tray
```

### 🟡 MEDIUM: Path Length Limitations
```bash
# Error: "File name too long" during npm install
# Solution 1: Enable long paths in Windows
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Solution 2: Move project closer to root
# Bad: C:\Users\Username\Documents\Projects\Work\overmatch-digital
# Good: C:\dev\overmatch-digital
```

### 🟢 LOW: Line Ending Issues
```bash
# Error: "bad interpreter: /bin/bash^M: no such file or directory"
# Solution: Configure Git to use LF endings
git config --global core.autocrlf input

# Fix existing files
dos2unix scripts/*.sh

# Or in Git Bash
find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;
```

### 🟡 MEDIUM: PowerShell Execution Policy
```bash
# Error: "cannot be loaded because running scripts is disabled"
# Solution 1: Run with bypass (temporary)
powershell -ExecutionPolicy Bypass -File script.ps1

# Solution 2: Set for current user (permanent)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Solution 3: Use npm scripts that wrap PowerShell
"scripts": {
  "start:services": "powershell -ExecutionPolicy Bypass -File ./scripts/start-services.ps1"
}
```

### 🟠 HIGH: Environment Variable Issues
```bash
# Issue: Environment variables not loading from .env files
# Solution: Use cross-env for cross-platform compatibility
npm install --save-dev cross-env

# In package.json
"scripts": {
  "start:dev": "cross-env NODE_ENV=development nest start --watch"
}

# Or load manually in PowerShell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
  }
}
```

### 🟠 HIGH: Port Access Denied
```bash
# Error: "EACCES: permission denied" or "port already in use"
# Find process using port
netstat -ano | findstr :3001
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess

# Kill the process
Stop-Process -Id <PID> -Force

# Or use npm package
npx kill-port 3001
```

### 🟡 MEDIUM: File Watcher Limits
```bash
# Error: "System limit for number of file watchers reached"
# Windows doesn't have this issue, but WSL2 might

# In WSL2, increase watchers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 🟢 LOW: Symbolic Links Issues
```bash
# Error: "EPERM: operation not permitted, symlink"
# Solution 1: Run as Administrator
# Right-click PowerShell > Run as Administrator

# Solution 2: Enable Developer Mode
# Settings > Update & Security > For Developers > Developer Mode ON

# Solution 3: Use junction points instead
# In package.json postinstall
mklink /J node_modules\@mypackage ..\..\packages\mypackage
```

### 🟡 MEDIUM: WSL2 Performance
```bash
# Slow file access from Windows to WSL2
# Solution: Keep code in WSL2 filesystem
# Bad: /mnt/c/Users/Username/project
# Good: ~/project

# Or disable Windows Defender for WSL2
Add-MpPreference -ExclusionPath "\\wsl$\Ubuntu"
Add-MpPreference -ExclusionProcess "node.exe"
```

### 🟠 HIGH: Memory Issues
```bash
# WSL2 consuming too much memory
# Create/edit %USERPROFILE%\.wslconfig
[wsl2]
memory=4GB
processors=2
swap=2GB
localhostForwarding=true

# Apply changes
wsl --shutdown
```

## Docker Issues

### 🔴 CRITICAL: Container Not Starting
```bash
# Check logs
docker-compose logs -f [service-name]

# Check container status
docker ps -a

# Rebuild container
docker-compose build --no-cache [service-name]
docker-compose up -d [service-name]
```

### 🟠 HIGH: Volume Permission Issues
```bash
# Reset volumes
docker-compose down -v
docker-compose up -d

# Check volume mounts
docker inspect [container-name] | grep -A 10 Mounts
```

## Database Issues

### 🔴 CRITICAL: Connection Failed
```bash
# Common issues:
# 1. Wrong host - use 127.0.0.1 not localhost on Windows
# 2. Wrong credentials - check .env file
# 3. Database doesn't exist - create it

# Test connection
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_auth -c "SELECT 1"

# Create database if missing
docker exec overmatch-digital-postgres-1 psql -U postgres -c "CREATE DATABASE soc_auth"
```

### 🔴 CRITICAL: Migration Errors
```bash
# Run pending migrations
cd services/[service-name]
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration
npm run migration:generate -- -n MigrationName
```

## Service Communication Issues

### 🟠 HIGH: Kafka Connection Timeouts
```typescript
// Error: KafkaJSConnectionError: Connection timeout
// Solutions:

// 1. Check Docker container is running
docker ps | grep kafka

// 2. Disable Kafka for local development
DISABLE_KAFKA=true npm run start:dev

// 3. Increase timeout in microservices config
ClientsModule.register([{
  name: 'EVENT_BUS',
  transport: Transport.KAFKA,
  options: {
    client: {
      brokers: ['localhost:9092'],
      connectionTimeout: 30000,  // Increase from default 10000
      retry: {
        retries: 5,
        initialRetryTime: 300
      }
    }
  }
}])
```

### 🟠 HIGH: Redis Authentication Failures
```bash
# Error: ReplyError: NOAUTH Authentication required
# Solution: Ensure password is set in all places

# 1. In .env file (no quotes!)
REDIS_PASSWORD=soc_redis_pass

# 2. In cache module configuration
CacheModule.register({
  store: redisStore,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,  // Must be included
  ttl: 300
})

# 3. Test connection
docker exec overmatch-digital-redis-1 redis-cli -a soc_redis_pass ping
```

## Build and Compilation Issues

### 🟠 HIGH: TypeScript Build Errors
```bash
# Clear build cache
rm -rf dist
rm -rf .tsbuildinfo

# Check for TypeScript errors
npx tsc --noEmit

# Build with verbose output
npm run build -- --verbose
```

### 🟠 HIGH: Webpack Build Issues
```bash
# Clear webpack cache
rm -rf .webpack-cache

# Debug webpack config
npm run build -- --display-error-details
```

## Testing Issues

### 🔴 CRITICAL: WeakMap Error in E2E Tests
```typescript
// Error: TypeError: Invalid value used as weak map key
// Root Cause: TypeORM mocks interfering with E2E tests

// ✅ SOLUTION: Add at the TOP of EVERY E2E test file
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Must be BEFORE any imports
import { Test } from '@nestjs/testing';
```

### 🟡 MEDIUM: Separate Jest Configurations
```javascript
// Problem: Unit tests and E2E tests have conflicting needs
// Solution: Create separate configs

// jest.config.unit.js
module.exports = {
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['/test/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Uses mocks
};

// jest.config.e2e.js  
module.exports = {
  testMatch: ['**/test/e2e/**/*.e2e-spec.ts'],
  modulePathIgnorePatterns: ['<rootDir>/src/__mocks__'], // No mocks!
  setupFilesAfterEnv: [], // No setup files
};

// package.json
"scripts": {
  "test": "jest --config jest.config.unit.js",
  "test:e2e": "jest --config jest.config.e2e.js"
}
```

### 🟡 MEDIUM: Jest Tests Hanging
```bash
# Debug hanging tests
npm test -- --detectOpenHandles --runInBand

# Force exit after tests
npm test -- --forceExit

# Clear Jest cache
npm test -- --clearCache
```

### 🟡 MEDIUM: E2E Test Failures
```bash
# Ensure test infrastructure is running
npm run e2e:start

# Check test database
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_auth_test -c "\dt"

# Run single E2E test
npm run test:e2e -- --testNamePattern="should create user"
```

### 🟠 HIGH: E2E Testing - Service-Level Mocking Issues

#### sanitizeHtml is not a function
```typescript
// Error: TypeError: sanitizeHtml is not a function
// Occurs when service directly imports and uses sanitize-html

// Problem: Service-level imports bypass Jest mocks
import * as sanitizeHtml from 'sanitize-html';
// ...
sanitizeHtml(content, options); // Fails in E2E tests

// Solution 1: Add to jest-e2e.json moduleNameMapper
{
  "moduleNameMapper": {
    "^sanitize-html$": "<rootDir>/test/mocks/sanitize-html.mock.js"
  }
}

// Solution 2: Wrap in injectable service (RECOMMENDED)
@Injectable()
export class SanitizationService {
  sanitizeHtml(content: string, options?: any): string {
    return sanitizeHtml(content, options);
  }
}

// Then mock the service in tests
moduleBuilder.overrideProvider(SanitizationService).useValue({
  sanitizeHtml: (content) => content,
});
```

#### Pipes instantiated in decorators
```typescript
// Problem: Cannot override pipes created with 'new'
@UsePipes(new ValidationPipe()) // ❌ Cannot mock
@Controller('policies')
export class PoliciesController {}

// Solution: Use pipe as provider
// In module:
providers: [ValidationPipe]

// In controller:
@UsePipes(ValidationPipe) // ✅ Can mock
@Controller('policies')
export class PoliciesController {}

// In E2E test:
moduleBuilder.overridePipe(ValidationPipe).useValue({
  transform: (value) => value,
});
```

#### Complex validation preventing field injection
```typescript
// Problem: Validation happens before interceptors
// DTO requires UUID, but interceptor adds it

// Solution 1: Make server-generated fields optional
export class CreatePolicyDto {
  @IsOptional()
  @IsString() // Not @IsUUID()
  organizationId?: string;
}

// Solution 2: Use custom validation groups
export class CreatePolicyDto {
  @IsUUID('4', { groups: ['user-input'] })
  @IsOptional({ groups: ['server-generated'] })
  organizationId?: string;
}
```

### 🟡 MEDIUM: TypeORM in Unit Tests
```typescript
// Error: Repository methods undefined in tests
// Solution: Use manual instantiation

// ❌ WRONG - Fails with TypeORM
const module = await Test.createTestingModule({
  providers: [ServiceWithTypeORM]
}).compile();

// ✅ CORRECT - Manual instantiation
const mockRepository = {
  find: jest.fn(),
  save: jest.fn(),
  // ... other methods
};
const service = new ServiceWithTypeORM(mockRepository);
```

## Quick Debugging Commands

### 🟢 LOW: Check Service Health
```bash
.\scripts\check-local-health.ps1 -Detailed
```

### 🟢 LOW: View Logs
```bash
# Single service
docker-compose logs -f auth-service

# Multiple services
docker-compose logs -f auth-service client-service policy-service
```

### 🟢 LOW: Database Queries
```bash
# Connect to database
docker exec -it overmatch-digital-postgres-1 psql -U soc_user -d soc_auth

# Common queries
\dt                    # List tables
\d users               # Describe table
SELECT COUNT(*) FROM users;  # Count records
```

---

**Document Status**: Complete troubleshooting guide for common development issues