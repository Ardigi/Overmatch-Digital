# Migration Framework Improvements

**Last Updated**: August 10, 2025  
**Status**: Implementation Guide

## Executive Summary

This document outlines comprehensive improvements to the database migration framework, including testing strategies, automation tools, and best practices for the SOC Compliance Platform.

## Current State Analysis

### Strengths
- All services use TypeORM migrations
- Consistent directory structure (`src/migrations`)
- Version control for all schema changes
- Rollback capabilities

### Weaknesses
- No automated migration testing
- Limited rollback verification
- No data migration patterns
- Missing migration validation
- No performance testing for migrations

## Improvement Framework

### 1. Migration Testing Pipeline

#### Automated Test Suite
Created `test-migrations.ps1` script with:
- **File Validation**: Checks for up() and down() methods
- **Schema Verification**: Validates table creation
- **Rollback Testing**: Tests down() migrations
- **Data Integrity**: Validates data preservation
- **Performance Metrics**: Measures migration execution time

#### Test Execution
```powershell
# Test all services
.\scripts\test-migrations.ps1 -Service all -TestRollback -GenerateReport

# Test specific service with data validation
.\scripts\test-migrations.ps1 -Service auth -TestData -Verbose

# Dry run mode
.\scripts\test-migrations.ps1 -Service policy -DryRun
```

### 2. Migration Patterns Library

#### Pattern 1: Safe Column Addition
```typescript
// Safe nullable column addition
export class AddEmailVerifiedColumn1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add nullable column
    await queryRunner.addColumn('users', new TableColumn({
      name: 'email_verified',
      type: 'boolean',
      isNullable: true,
      default: false
    }));
    
    // Step 2: Backfill existing data
    await queryRunner.query(`
      UPDATE users 
      SET email_verified = false 
      WHERE email_verified IS NULL
    `);
    
    // Step 3: Make non-nullable in separate migration
    // This allows zero-downtime deployment
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'email_verified');
  }
}
```

#### Pattern 2: Safe Index Creation
```typescript
// Non-blocking index creation
export class AddUserEmailIndex1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use CONCURRENTLY to avoid table locks
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
      ON users(email)
    `);
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_users_email
    `);
  }
}
```

#### Pattern 3: Data Migration with Batching
```typescript
export class MigrateUserData1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await queryRunner.query(`
        UPDATE users 
        SET new_field = old_field * 2
        WHERE id IN (
          SELECT id FROM users 
          WHERE new_field IS NULL
          LIMIT ${batchSize}
        )
        RETURNING id
      `);
      
      hasMore = result.length === batchSize;
      offset += batchSize;
      
      // Add delay to reduce database load
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET new_field = NULL
    `);
  }
}
```

#### Pattern 4: Enum Type Management
```typescript
export class AddUserStatus1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type safely
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Add column using enum
    await queryRunner.addColumn('users', new TableColumn({
      name: 'status',
      type: 'user_status',
      default: "'active'"
    }));
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'status');
    await queryRunner.query('DROP TYPE IF EXISTS user_status');
  }
}
```

### 3. Migration Validation Framework

#### Pre-Migration Checks
```typescript
class MigrationValidator {
  async validateMigration(migration: MigrationInterface): Promise<ValidationResult> {
    const checks = [
      this.checkSyntax(migration),
      this.checkNaming(migration),
      this.checkIdempotency(migration),
      this.checkPerformance(migration),
      this.checkRollback(migration)
    ];
    
    return {
      passed: checks.every(c => c.passed),
      checks
    };
  }
  
  private async checkIdempotency(migration: MigrationInterface): Promise<Check> {
    // Run migration twice, should not fail
    const testDb = await this.createTestDatabase();
    
    try {
      await migration.up(testDb.queryRunner);
      await migration.up(testDb.queryRunner); // Should handle already-migrated state
      return { passed: true, message: 'Migration is idempotent' };
    } catch (error) {
      return { passed: false, message: `Not idempotent: ${error.message}` };
    }
  }
}
```

### 4. Migration Performance Testing

#### Performance Test Suite
```typescript
class MigrationPerformanceTester {
  async testMigrationPerformance(
    migration: MigrationInterface,
    dataSize: 'small' | 'medium' | 'large'
  ): Promise<PerformanceReport> {
    const testDb = await this.createTestDatabase();
    await this.seedTestData(testDb, dataSize);
    
    // Measure migration time
    const startTime = Date.now();
    await migration.up(testDb.queryRunner);
    const upTime = Date.now() - startTime;
    
    // Measure rollback time
    const rollbackStart = Date.now();
    await migration.down(testDb.queryRunner);
    const downTime = Date.now() - rollbackStart;
    
    return {
      dataSize,
      upTime,
      downTime,
      acceptable: upTime < this.getThreshold(dataSize)
    };
  }
  
  private getThreshold(size: string): number {
    return {
      small: 1000,   // 1 second
      medium: 5000,  // 5 seconds
      large: 30000   // 30 seconds
    }[size];
  }
}
```

### 5. Zero-Downtime Migration Strategies

#### Blue-Green Deployment Pattern
```yaml
# Step 1: Deploy new code that handles both schemas
# Step 2: Run migration
# Step 3: Deploy code that only uses new schema
# Step 4: Clean up old schema elements

deployment:
  stages:
    - name: dual-schema
      migrations: [AddNewColumn]
      code: v2.0-dual
    - name: migrate
      migrations: [MigrateData]
    - name: new-schema
      code: v2.0-final
    - name: cleanup
      migrations: [RemoveOldColumn]
```

#### Expand-Contract Pattern
```typescript
// Phase 1: Expand (Add new without removing old)
export class ExpandSchema1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new column alongside old
    await queryRunner.addColumn('users', new TableColumn({
      name: 'email_normalized',
      type: 'varchar',
      isNullable: true
    }));
    
    // Copy data
    await queryRunner.query(`
      UPDATE users 
      SET email_normalized = LOWER(TRIM(email))
    `);
  }
}

// Phase 2: Transition (Use new, deprecate old)
// Application code uses new column

// Phase 3: Contract (Remove old)
export class ContractSchema1234567891 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'email');
    await queryRunner.renameColumn('users', 'email_normalized', 'email');
  }
}
```

### 6. Migration Monitoring

#### Health Checks
```typescript
class MigrationMonitor {
  async checkMigrationHealth(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkPendingMigrations(),
      this.checkFailedMigrations(),
      this.checkMigrationPerformance(),
      this.checkSchemaConsistency()
    ]);
    
    return {
      healthy: checks.every(c => c.healthy),
      checks,
      recommendations: this.generateRecommendations(checks)
    };
  }
  
  private async checkPendingMigrations(): Promise<Check> {
    const pending = await this.queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM migrations 
      WHERE executed_at IS NULL
    `);
    
    return {
      healthy: pending[0].count === 0,
      message: `${pending[0].count} pending migrations`
    };
  }
}
```

### 7. Migration Documentation Generator

#### Auto-Documentation
```typescript
class MigrationDocGenerator {
  async generateDocs(migrationDir: string): Promise<string> {
    const migrations = await this.loadMigrations(migrationDir);
    
    return `
# Migration Documentation

## Migration History

${migrations.map(m => `
### ${m.name} (${m.timestamp})

**Changes:**
${this.extractChanges(m)}

**Rollback:**
${this.extractRollback(m)}

**Performance Impact:** ${this.estimateImpact(m)}
`).join('\n')}

## Schema Evolution

\`\`\`mermaid
graph LR
${this.generateSchemaEvolution(migrations)}
\`\`\`
    `;
  }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [x] Create migration test framework (`test-migrations.ps1`)
- [x] Document migration patterns
- [ ] Set up migration validation

### Phase 2: Automation (Week 2)
- [ ] Integrate migration tests in CI/CD
- [ ] Add pre-commit hooks for migrations
- [ ] Create migration generator templates

### Phase 3: Monitoring (Week 3)
- [ ] Implement migration health checks
- [ ] Add performance monitoring
- [ ] Create alerting for failed migrations

### Phase 4: Advanced Features (Week 4)
- [ ] Implement zero-downtime patterns
- [ ] Add data migration utilities
- [ ] Create migration rollback automation

## Best Practices

### Do's
1. **Always test rollbacks**: Every up() must have a working down()
2. **Use transactions**: Wrap changes in transactions when possible
3. **Make migrations idempotent**: Running twice shouldn't fail
4. **Keep migrations small**: One logical change per migration
5. **Version control everything**: Including migration test results
6. **Document breaking changes**: Clearly mark migrations that require coordination
7. **Test with production-like data**: Use realistic data volumes

### Don'ts
1. **Don't modify executed migrations**: Create new ones instead
2. **Don't use DELETE without WHERE**: Always be explicit
3. **Don't ignore performance**: Test with large datasets
4. **Don't skip rollback methods**: Even if "never needed"
5. **Don't mix schema and data**: Separate structural and data migrations
6. **Don't use timestamps for names**: Use descriptive names with timestamps
7. **Don't forget indexes**: But create them CONCURRENTLY

## Migration Checklist

Before running any migration in production:

- [ ] Migration tested locally
- [ ] Rollback tested and verified
- [ ] Performance tested with production-like data
- [ ] Review for breaking changes
- [ ] Documentation updated
- [ ] Backup strategy confirmed
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Team notified of maintenance window
- [ ] Migration added to changelog

## Emergency Procedures

### Failed Migration Recovery
```bash
# 1. Stop application deployments
kubectl scale deployment all --replicas=0

# 2. Check migration status
psql -U soc_user -d soc_auth -c "SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 5;"

# 3. Manually rollback if needed
npm run migration:revert

# 4. Fix the issue
# Edit migration file or create fix migration

# 5. Re-run migrations
npm run migration:run

# 6. Restart applications
kubectl scale deployment all --replicas=1
```

### Data Corruption Recovery
```sql
-- Check for corruption
SELECT COUNT(*) FROM users WHERE email IS NULL OR email = '';

-- Restore from backup if needed
pg_restore -U soc_user -d soc_auth_temp backup.dump

-- Verify data integrity
SELECT 
  COUNT(*) as total,
  COUNT(DISTINCT email) as unique_emails,
  COUNT(*) FILTER (WHERE email_verified = true) as verified
FROM users;
```

## Success Metrics

Track these metrics to measure migration framework improvements:

1. **Migration Success Rate**: Target >99.9%
2. **Average Migration Time**: <5 seconds for schema, <30 seconds for data
3. **Rollback Success Rate**: 100%
4. **Failed Migration Recovery Time**: <15 minutes
5. **Migration Test Coverage**: 100%
6. **Zero-Downtime Deployments**: >95%

## Conclusion

These improvements transform our migration framework from basic to enterprise-grade, ensuring:
- **Reliability**: Tested, validated migrations
- **Safety**: Rollback capabilities and data protection
- **Performance**: Optimized for production scale
- **Observability**: Monitoring and alerting
- **Automation**: CI/CD integration