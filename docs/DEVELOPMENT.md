# Development Guide - SOC Compliance Platform

Complete guide for setting up and developing the SOC Compliance Platform.

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Build shared packages (REQUIRED!)
npm run build:shared

# 3. Start infrastructure
.\start-docker-services.ps1
# OR
docker-compose up -d

# 4. Run migrations
.\scripts\run-migrations.ps1

# 5. Start development
npm run dev              # Frontend only (port 3000)
npm run dev:all          # Frontend + all services
```

Access the platform at http://localhost:3000

---

## 📋 Prerequisites

### Required Software
- **Node.js** 20+ (LTS recommended)
- **Docker Desktop** 20.10+
- **Git** 2.30+
- **RAM** 16GB minimum

### Optional Tools
- **PostgreSQL** 15+ (for local development without Docker)
- **Redis** 7+ (for local development without Docker)
- **VS Code** with recommended extensions

### Windows-Specific Requirements
- **PowerShell** 7+ or Windows PowerShell 5.1
- **WSL2** (optional but recommended)
- Enable script execution: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

## 🏗️ Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/soc-compliance-platform.git
cd soc-compliance-platform
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# If you encounter issues, try:
npm install --legacy-peer-deps
```

### 3. Build Shared Packages

**CRITICAL**: Always build shared packages first!

```bash
# Build all shared packages
npm run build:shared

# This builds:
# - @soc-compliance/contracts
# - @soc-compliance/events
# - @soc-compliance/auth-common
# - @soc-compliance/http-common
# - @soc-compliance/cache-common
# - @soc-compliance/monitoring
# - @soc-compliance/secrets
```

### 4. Environment Configuration

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
# Key variables:
# - JWT_SECRET=your-secret-key
# - DB_PASSWORD=soc_pass
# - REDIS_PASSWORD=soc_redis_pass
```

---

## 🐳 Docker Development

### Start All Infrastructure

```bash
# Windows PowerShell
.\start-docker-services.ps1

# OR using docker-compose directly
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Infrastructure Services

| Service | Port | Purpose | Credentials |
|---------|------|---------|-------------|
| PostgreSQL | 5432 | Primary database | soc_user/soc_pass |
| Redis | 6379 | Caching layer | soc_redis_pass |
| Kafka | 9092 | Event streaming | - |
| MongoDB | 27017 | Document storage | soc_user/soc_pass |
| Elasticsearch | 9200 | Search engine | - |
| Keycloak | 8180 | SSO provider | admin/admin |

### Database Setup

```bash
# Create all databases
.\scripts\create-all-databases.ps1

# Run migrations
.\scripts\run-migrations.ps1

# Seed demo data (optional)
.\scripts\seed-demo-data.ps1
```

---

## 💻 Local Development (Without Docker)

### PostgreSQL Setup

```bash
# Windows - Start PostgreSQL
net start postgresql-x64-15

# Create databases
psql -U postgres -c "CREATE DATABASE soc_auth;"
psql -U postgres -c "CREATE DATABASE soc_clients;"
psql -U postgres -c "CREATE DATABASE soc_policies;"
# ... (create all 12 databases)

# Run migrations
cd services/auth-service && npm run migration:run
cd ../client-service && npm run migration:run
# ... (run for all services)
```

### Redis Setup

```bash
# Windows - Start Redis
redis-server --requirepass soc_redis_pass

# Mac/Linux
redis-server --requirepass soc_redis_pass --daemonize yes

# Verify connection
redis-cli -a soc_redis_pass ping
```

### Kafka Setup (Optional)

```bash
# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# Start Kafka
bin/kafka-server-start.sh config/server.properties

# Create topics
.\scripts\create-kafka-topics.ps1
```

---

## 🔧 Development Workflow

### Frontend Development

```bash
# Start Next.js development server
npm run dev

# The frontend will be available at:
# http://localhost:3000

# Hot reload is enabled by default
```

### Backend Service Development

```bash
# Start individual service
cd services/auth-service
npm run start:dev

# Start all services
npm run dev:all

# Start specific services
npm run dev:services
```

### Service Ports

| Service | Dev Port | Docker Port | API Path |
|---------|----------|-------------|----------|
| Frontend | 3000 | 3000 | / |
| Auth | 3001 | 3001 | /api/auth |
| Client | 3002 | 3002 | /api/clients |
| Policy | 3003 | 3003 | /api/policies |
| Control | 3004 | 3004 | /api/controls |
| Evidence | 3005 | 3005 | /api/evidence |
| Workflow | 3006 | 3006 | /api/workflows |
| Reporting | 3007 | 3007 | /api/reports |
| Audit | 3008 | 3008 | /api/audits |
| Integration | 3009 | 3009 | /api/integrations |
| Notification | 3010 | 3010 | /api/notifications |
| AI | 3011 | 3011 | /api/ai |

---

## 📝 Code Standards

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "target": "ES2022",
    "module": "commonjs",
    "esModuleInterop": true
  }
}
```

### Build Output Standards

**CRITICAL**: All services MUST build to `dist/main.js`

```typescript
// ✅ CORRECT - Files in subdirectories
src/
├── main.ts
├── app.module.ts
└── modules/

// ❌ WRONG - TypeScript files in root
main.ts  // This causes dist/src/main.js
app.module.ts
```

### Import Patterns

```typescript
// ✅ CORRECT - Package imports
import { AuthGuard } from '@soc-compliance/auth-common';
import { OrganizationCreatedEvent } from '@soc-compliance/shared-events';

// ❌ WRONG - Relative imports to packages
import { AuthGuard } from '../../../packages/auth-common';
```

### Linting & Formatting

```bash
# Run Biome linter
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format

# Type check all workspaces
npm run type-check
```

---

## 🔨 Common Development Tasks

### Adding a New Service

```bash
# 1. Create service directory
mkdir services/new-service
cd services/new-service

# 2. Initialize NestJS
nest new . --skip-git

# 3. Configure package.json
# Add name: "@soc-compliance/new-service"

# 4. Update root package.json workspaces

# 5. Install dependencies
npm install
```

### Creating Migrations

```bash
cd services/[service-name]

# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Working with Kafka Events

```typescript
// Publishing events
await this.eventBus.emit('service.entity.action', {
  entityId: id,
  timestamp: new Date(),
});

// Consuming events
@EventPattern('service.entity.action')
async handleEvent(data: EventPayload) {
  // Handle event
}
```

---

## 🐛 Debugging

### VS Code Launch Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["src/main.ts"],
      "cwd": "${workspaceFolder}/services/auth-service",
      "protocol": "inspector",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### Logging

```typescript
// Use NestJS Logger
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);
  
  async method() {
    this.logger.debug('Debug message');
    this.logger.log('Info message');
    this.logger.warn('Warning message');
    this.logger.error('Error message', stackTrace);
  }
}
```

### Health Checks

```bash
# Check service health
curl http://localhost:3001/health

# Check all services
.\scripts\check-local-health-fixed.ps1 -Detailed

# View logs
docker-compose logs -f [service-name]
```

---

## 🌐 API Development

### Swagger Documentation

All services expose Swagger UI at `/api-docs`:

- Auth: http://localhost:3001/api-docs
- Client: http://localhost:3002/api-docs
- Policy: http://localhost:3003/api-docs
- etc.

### API Client Generation

```bash
# Generate TypeScript client
npx openapi-generator-cli generate \
  -i http://localhost:3001/api-json \
  -g typescript-axios \
  -o ./generated/auth-client
```

---

## ⚡ Performance Optimization

### Build Optimization

```bash
# Production build
npm run build

# Analyze bundle size
npm run build:analyze

# Build specific service
cd services/auth-service && npm run build
```

### Caching Strategy

```typescript
// Use cache decorators
@Cacheable({ ttl: 300, key: 'user-stats' })
async getUserStats(userId: string) {
  // Expensive operation
}

// Clear cache
await this.cacheService.del('user-stats:*');
```

---

## 🔍 Troubleshooting

### Common Issues

#### Module Not Found
```bash
# Solution: Rebuild shared packages
npm run build:shared
```

#### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3001

# Kill process
npx kill-port 3001
```

#### Database Connection Failed
```bash
# Windows: Use 127.0.0.1 instead of localhost
DB_HOST=127.0.0.1
```

#### Docker Issues
```bash
# Reset Docker environment
docker-compose down -v
docker system prune -a
docker-compose up -d
```

### Windows-Specific Issues

```bash
# Line ending issues
git config core.autocrlf false

# Permission issues with scripts
powershell -ExecutionPolicy Bypass -File script.ps1

# Path issues
# Use forward slashes in imports: 'path/to/file'
```

---

## 📚 Additional Resources

### Documentation
- [Architecture Guide](ARCHITECTURE.md)
- [Testing Guide](TESTING.md)
- [API Reference](API.md)
- [Security Guide](SECURITY.md)
- [Deployment Guide](DEPLOYMENT.md)

### Tools & Extensions
- [NestJS DevTools](https://docs.nestjs.com/devtools/overview)
- [React Developer Tools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)

### Learning Resources
- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeORM Documentation](https://typeorm.io)
- [Kafka Documentation](https://kafka.apache.org/documentation)