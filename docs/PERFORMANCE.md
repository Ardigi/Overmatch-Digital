# Performance Optimization Guide - SOC Compliance Platform

**Last Updated**: August 1, 2025

This guide provides performance optimization strategies for local development and production deployment of the SOC Compliance Platform.

## Overview

The platform consists of 11 microservices plus frontend, which can be resource-intensive when running all simultaneously. These optimizations help improve development experience and production performance.

## Local Development Optimizations

### 1. Disable Kafka for Faster Local Development
```bash
# In service .env file
DISABLE_KAFKA=true

# Or when starting service
DISABLE_KAFKA=true npm run start:dev

# In code - check before initializing Kafka
if (process.env.DISABLE_KAFKA !== 'true') {
  app.connectMicroservice({
    transport: Transport.KAFKA,
    // ... kafka options
  });
}
```

### 2. Memory Optimization for Running All Services
```bash
# Limit Node.js memory per service (in package.json)
"scripts": {
  "start:dev": "node --max-old-space-size=512 node_modules/@nestjs/cli/bin/nest.js start --watch"
}

# Docker Compose memory limits
services:
  auth-service:
    mem_limit: 512m
    memswap_limit: 512m
```

### 3. Selective Service Startup
```bash
# Start only essential services for feature development
# Frontend + Auth + Client only
docker-compose up -d postgres redis
cd services/auth-service && npm run start:dev &
cd services/client-service && npm run start:dev &
npm run dev

# Use service groups in docker-compose
docker-compose up -d infrastructure  # Just databases
docker-compose up -d core-services   # Auth, Client, Policy
docker-compose up -d all-services    # Everything
```

## Database Optimizations

### 1. Connection Pooling
```typescript
// Optimize TypeORM connection pool
TypeOrmModule.forRoot({
  // ... other options
  extra: {
    max: 10,  // Maximum number of clients in pool
    min: 2,   // Minimum number of clients in pool
    idleTimeoutMillis: 30000,  // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000,  // Timeout for new connections
  }
})
```

### 2. Redis Connection Optimization
```typescript
// Reuse Redis connections across modules
@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
          password: process.env.REDIS_PASSWORD,
          lazyConnect: true,  // Don't connect until first command
          enableOfflineQueue: false,  // Fail fast if Redis is down
          maxRetriesPerRequest: 3
        });
      }
    }
  ],
  exports: ['REDIS_CLIENT']
})
export class RedisModule {}
```

## Build Optimizations

### 1. Development Build Optimization
```typescript
// webpack.config.js for faster rebuilds
module.exports = {
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000
  },
  cache: {
    type: 'filesystem',  // Cache webpack modules
    buildDependencies: {
      config: [__filename]
    }
  }
};
```

### 2. TypeScript Incremental Builds
```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

## Test Performance

### Jest Test Performance
```json
// jest.config.js optimizations
{
  "maxWorkers": "50%",  // Use only half of CPU cores
  "cache": true,
  "cacheDirectory": "<rootDir>/.jest-cache",
  "testTimeout": 10000,  // Fail fast on hanging tests
  "bail": 1,  // Stop on first test failure
  "detectOpenHandles": false,  // Only enable when debugging
  "forceExit": true  // Force exit after tests complete
}
```

## Docker Performance on Windows

### WSL2 Settings
```bash
# Create/edit %USERPROFILE%\.wslconfig
[wsl2]
memory=8GB  # Limit WSL2 memory usage
processors=4  # Limit CPU cores
swap=2GB
localhostForwarding=true

# Apply changes
wsl --shutdown
```

### Docker Desktop Settings
- Use WSL2 backend (not Hyper-V)
- Limit resources in Docker Desktop settings
- Enable "Use the WSL 2 based engine"
- Disable "Start Docker Desktop when you log in"

## Production Optimizations

### 1. Horizontal Scaling
```yaml
# Kubernetes deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### 2. Resource Limits
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### 3. Health Checks
```typescript
// Implement proper health checks
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
}
```

## Monitoring Performance

### Key Metrics to Track
- Response time (p50, p95, p99)
- Request rate
- Error rate
- Database query time
- Redis operation time
- Memory usage
- CPU usage

### Performance Monitoring Setup
```typescript
// Use the monitoring package
import { MetricsService } from '@soc-compliance/monitoring';

// Track operation timing
const timer = this.metrics.startTimer('operation_duration');
// ... perform operation
timer.end();
```

## Query Optimization

### Avoiding N+1 Query Problems

N+1 queries occur when you execute one query to fetch a list of items, then execute N additional queries (one for each item) to fetch related data. This is a common performance bottleneck.

#### Example: Evidence Collection Trends (Before Optimization)
```typescript
// ❌ BAD: N+1 Query Problem
const trends = [];
for (let day = 0; day < 7; day++) {
  const date = new Date();
  date.setDate(date.getDate() - day);
  
  // This executes a separate query for each day
  const count = await this.evidenceRepository
    .createQueryBuilder('evidence')
    .where('DATE(evidence.createdAt) = :date', { date })
    .getCount();
    
  trends.push({ date, count });
}
// Result: 1 + 7 = 8 database queries
```

#### Example: Evidence Collection Trends (After Optimization)
```typescript
// ✅ GOOD: Single Query with GROUP BY
const queryBuilder = this.evidenceRepository.createQueryBuilder('evidence');

queryBuilder
  .select("DATE(evidence.createdAt)", "date")
  .addSelect("evidence.type", "type")
  .addSelect("COUNT(*)", "count")
  .where('evidence.clientId = :organizationId', { organizationId })
  .andWhere('evidence.createdAt >= :startDate', { startDate })
  .andWhere('evidence.createdAt <= :endDate', { endDate })
  .groupBy('DATE(evidence.createdAt), evidence.type')
  .orderBy('DATE(evidence.createdAt)', 'ASC');

const rawResults = await queryBuilder.getRawMany();
// Result: Only 1 database query
```

### Best Practices for Query Optimization

1. **Use Aggregation Functions**: Let the database do the heavy lifting with SUM, COUNT, AVG, etc.
   ```typescript
   .select('AVG(evidence.qualityScore)', 'avgScore')
   .addSelect('COUNT(*)', 'total')
   ```

2. **Eager Loading with Relations**: Use TypeORM's relations to fetch related data in one query
   ```typescript
   const evidence = await this.evidenceRepository.find({
     relations: ['control', 'audit', 'collector'],
     where: { organizationId }
   });
   ```

3. **Index Your Queries**: Ensure database indexes match your query patterns
   ```typescript
   @Index(['clientId', 'status'])
   @Index(['collectionDate', 'type'])
   ```

4. **Time-Based Calculations**: Use database functions for date arithmetic
   ```typescript
   // PostgreSQL example: Calculate processing time in hours
   .select('AVG(EXTRACT(EPOCH FROM (evidence.approvedDate - evidence.collectionDate)) / 3600)', 'avgHours')
   ```

5. **Batch Operations**: Process multiple records in single queries
   ```typescript
   await this.evidenceRepository
     .createQueryBuilder()
     .update(Evidence)
     .set({ status: EvidenceStatus.EXPIRED })
     .where('expirationDate < :now', { now: new Date() })
     .execute();
   ```

### Monitoring Query Performance

Enable TypeORM query logging in development to identify slow queries:
```typescript
TypeOrmModule.forRoot({
  logging: ['query', 'error', 'warn'],
  maxQueryExecutionTime: 1000  // Log queries taking > 1 second
})
```

## Quick Performance Wins

1. **Disable unused services**: Only run services you're actively developing
2. **Use DISABLE_KAFKA=true**: For non-event-driven development
3. **Limit test scope**: Run only relevant tests during development
4. **Use caching**: Redis for session/cache, HTTP caching for API responses
5. **Optimize Docker**: Use WSL2 backend on Windows, limit resources

---

**Document Status**: Complete performance optimization guide