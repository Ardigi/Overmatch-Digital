# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 Critical Rules (MUST FOLLOW)

### Build Output Standard
- **All services MUST build to `dist/main.js`** (never `dist/src/main.js`)
- Never place .ts files in service root directory
- Test files: `test/` directory
- Source files: `src/` directory
- Database configs: `src/database/`
- Dockerfiles: `CMD ["node", "dist/main.js"]`

### Development Principles
1. **Test-Driven Development**: Never modify tests to pass - fix the implementation
2. **Type Safety**: Production code must NEVER use `as any` (test mocks are OK)
3. **Build Shared First**: Always run `npm run build:shared` before development
4. **Windows Environment**: Use `127.0.0.1` not `localhost`, PowerShell scripts, forward slashes in imports

### Test Status (VERIFIED: October 6, 2025)
- **Auth Service**: 72% passing (13/18 suites) - Jest config blocks 5 suites, database setup blocks 12 tests
- **Policy Service**: 100% unit tests passing (3/3 suites)
- **Other Services**: Not yet tested (9 services)
- **Critical Issues**: Jest ES module config, database integration setup
- **See**: TEST_EXECUTION_REPORT.md for detailed findings and solutions

## 🚀 Quick Start

### 🔴 CRITICAL: Kong Konnect Required
**This platform uses Kong Konnect (cloud gateway) for production. Local Kong (port 8000) is NOT supported.**

```bash
# Every new session (in order):
npm run build:shared                    # 1. Build shared packages (REQUIRED!)
.\scripts\setup-pre-commit-hooks.ps1    # 2. Setup security hooks
.\start-docker-services.ps1             # 3. Start infrastructure (Note: Kong service is deprecated)
.\scripts\run-migrations.ps1            # 4. Run database migrations (if needed)

# Development:
npm run dev                              # Frontend only (port 3000)
cd services/[service] && npm run start:dev  # Individual service
npm run dev:all                          # Frontend + all services
```

## 📁 Architecture

**SOC Compliance Platform** - Enterprise SOC 1/2 compliance management

### Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, React Query
- **Backend**: NestJS microservices (12 services)
- **Databases**: PostgreSQL, Redis, MongoDB, Elasticsearch
- **API Gateway**: Kong Konnect (cloud) - NOT local Kong
- **Infrastructure**: Docker, Kafka, Keycloak
- **Monitoring**: OpenTelemetry, Prometheus, Grafana, Jaeger

### Services & Status
For current status, see [docs/STATUS.md](docs/STATUS.md)

**IMPORTANT**: All services must use `/api/v1` prefix in controllers for Kong Konnect.

| Service | Database | Port | Controller Path | API Status |
|---------|----------|------|-----------------|------------|
| Frontend | - | 3000 | - | - |
| Auth | soc_auth | 3001 | `@Controller('api/v1/auth')` | ✅ COMPLETE |
| Client | soc_clients | 3002 | `@Controller('clients')` | ❌ Needs /api/v1 |
| Policy | soc_policies | 3003 | `@Controller('policies')` | ❌ Needs /api/v1 |
| Control | soc_controls | 3004 | `@Controller('controls')` | ❌ Needs /api/v1 |
| Evidence | soc_evidence | 3005 | `@Controller('evidence')` | ❌ Needs /api/v1 |
| Workflow | soc_workflows | 3006 | `@Controller('workflows')` | ❌ Needs /api/v1 |
| Reporting | soc_reporting | 3007 | `@Controller('reports')` | ❌ Needs /api/v1 |
| Audit | soc_audits | 3008 | `@Controller('audits')` | ❌ Needs /api/v1 |
| Integration | soc_integrations | 3009 | `@Controller('integrations')` | ❌ Needs /api/v1 |
| Notification | soc_notifications | 3010 | `@Controller('notifications')` | ❌ Needs /api/v1 |
| AI | soc_ai | 3011 | `@Controller('ai')` | ❌ Needs /api/v1 |

### Monorepo Structure
```
workspaces: ["services/*", "packages/*", "shared/*"]
├── services/        # NestJS microservices
├── packages/        # Shared libraries (auth-common, cache-common, etc.)
├── shared/          # Contracts, events, DTOs
├── app/             # Next.js pages
└── frontend/        # Next.js components
```

## 🔧 Development Workflow

### Building
```bash
npm run build:shared      # Build all shared packages (do this first!)
npm run build             # Build frontend
npm run build:services    # Build all services
docker-compose build      # Build Docker images
```

### Testing
```bash
# Unit tests
cd services/[service] && npm test
npm test -- --testNamePattern="specific"   # Run specific test
npm test -- --clearCache                    # Fix strange behavior

# Integration tests
npm run test:integration:verify            # Check infrastructure
npm run test:integration                   # Run all
npm run test:integration:auth              # Specific service

# E2E tests
npm run test:e2e                           # All services
npm run test:e2e:auth                      # Specific service

# Linting & Type checking
npm run lint:fix                            # Biome auto-fix
npm run type-check                          # Check all workspaces
cd services/[service] && npx tsc --noEmit  # Individual service
```

### Debugging
```bash
# Health checks
.\scripts\check-local-health.ps1 -Detailed
docker-compose logs -f [service-name]

# Database access
docker exec overmatch-digital-postgres-1 psql -U soc_user -d soc_auth

# Port issues
netstat -ano | findstr :3001
npx kill-port 3001

# Redis
docker exec overmatch-digital-redis-1 redis-cli -a soc_redis_pass ping

# Kafka
docker exec overmatch-digital-kafka-1 kafka-topics.sh --list --bootstrap-server localhost:9092
```

## 🏗️ Code Patterns

### API Versioning (REQUIRED)
```typescript
// ✅ CORRECT - With /api/v1 prefix for Kong Konnect
@Controller('api/v1/auth')
export class AuthController { }

// ❌ WRONG - No versioning
@Controller('auth')
export class AuthController { }
```

### Imports
```typescript
// ✅ CORRECT - Package imports
import { AuthGuard } from '@soc-compliance/auth-common';
import { OrganizationCreatedEvent } from '@soc-compliance/shared-events';

// ❌ WRONG - Relative paths to packages
import { AuthGuard } from '../../../packages/auth-common';
```

### Response Format
```typescript
// All endpoints return this structure:
{
  data: T[],
  meta: {
    total: number,
    page: number,
    limit: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean,
    statistics?: any
  }
}
```

### Event Naming
```typescript
// Pattern: service.entity.action
'auth.user.created'
'client.organization.updated'
'policy.control.mapped'

// Usage:
await this.eventBus.emit('client.organization.created', { organizationId: id });
```

### Error Handling
```typescript
// Gracefully handle external service failures
try {
  await this.cacheService.deleteByTags(['frameworks']);
} catch (error) {
  this.logger.warn('Failed to invalidate cache', error);
  // Continue - don't fail the operation
}
```

### Manual Test Instantiation (TypeORM/Jest)
```typescript
// ✅ Manual instantiation for TypeORM entities
const mockRepository = { find: jest.fn(), save: jest.fn() };
const service = new ServiceWithTypeORM(mockRepository);

// ❌ Fails with TypeORM
const module = await Test.createTestingModule({...});
```

## 🐛 Common Issues & Fixes

### Build Issues
- **Service builds to wrong path**: Move all .ts files from root to subdirectories
- **Module not found**: Run `npm run build:shared`
- **ConfigModule async**: Use `await AppModule.forRoot()` pattern

### Database Issues
- **Connection failed**: Use `DB_HOST=127.0.0.1` on Windows
- **Wrong DB name**: Use `soc_[service]` not `soc_[service]_db`
- **Test DBs**: Add `_test` suffix

### Test Issues
- **Tests hanging**: `npm test -- --detectOpenHandles --runInBand`
- **Jest config**: Use `moduleNameMapper` not `moduleNameMapping`
- **TypeORM mocks**: Use manual instantiation pattern

### Frontend Issues
- **Circular dependency**: Use lazy initialization in `lib/api/service-clients.ts`
- **Missing dependencies**: `npm install [package]` or `npm install`

## 📊 Monitoring & Infrastructure

```bash
# Monitoring stack
npm run monitoring:start     # Prometheus, Grafana, Jaeger, ELK
npm run monitoring:stop
npm run monitoring:logs

# Docker services
.\start-docker-services.ps1  # Start all infrastructure
docker-compose up -d         # Start specific services
docker-compose down          # Stop all

# Secrets management (infrastructure-level)
.\docker-secrets\create-dev-secrets.ps1         # Development
.\docker-secrets\deploy-with-secrets.ps1 -Mode Development
```

## 🔑 Key Scripts
- `start-docker-services.ps1` - Start infrastructure
- `scripts/check-local-health.ps1` - Health check
- `scripts/test-all-services.ps1` - Run all unit tests
- `scripts/run-migrations.ps1` - Database migrations
- `scripts/run-integration-tests.ps1` - Integration tests
- `scripts/run-e2e-tests.ps1` - E2E tests

## 📖 Documentation
- `docs/STATUS.md` - Platform status (VERIFIED: Oct 6, 2025)
- `docs/TESTING_SETUP.md` - Testing setup, issues, and solutions
- `TEST_EXECUTION_REPORT.md` - Detailed test results and analysis
- `docs/DEVELOPMENT.md` - Development guide
- `docs/TESTING.md` - Testing strategies
- `docs/TROUBLESHOOTING.md` - Common issues

## ⚡ Biome Linting Config
- **Formatter**: 2 spaces, LF line endings, 100 char width
- **JavaScript**: Single quotes, ES5 trailing commas, semicolons
- **Test files**: `noExplicitAny` and `noUnusedVariables` disabled
- **Migrations**: `noExplicitAny` disabled for TypeORM

## 🎯 Current Platform Status (VERIFIED: Oct 6, 2025)
For detailed service status, deployment progress, and known issues, see:
**[docs/STATUS.md](docs/STATUS.md)** | **[TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md)**

**Overall Readiness**: ~20% Production Ready

**Critical Blockers**:
1. ⭐ **Auth Service Jest Configuration** - 5 test suites blocked by ES module issue
2. ⭐ **Database Integration Test Setup** - 12 tests failing, needs proper test DB config
3. **API Versioning Incomplete** - 10 of 11 services need /api/v1 prefix (only Auth complete)
4. **Test Verification Needed** - 9 services not yet tested
5. **Docker Deployment** - Most services not deployed/verified

**Immediate Priorities**:
1. Fix Auth Jest config (transformIgnorePatterns for jwks-rsa/jose)
2. Fix database integration test environment
3. Run full test suite for all services (document results)
4. Update API versioning with TDD approach (write tests first!)
5. Deploy and verify services in Docker