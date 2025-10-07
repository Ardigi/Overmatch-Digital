# Database Migration Guide

This guide covers database migration best practices for the SOC Compliance Platform microservices.

## Table of Contents
- [Overview](#overview)
- [Migration Strategy](#migration-strategy)
- [Creating Migrations](#creating-migrations)
- [Running Migrations](#running-migrations)
- [Migration Best Practices](#migration-best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

Each microservice in the SOC Compliance Platform has its own PostgreSQL database and manages its schema through TypeORM migrations. This ensures:

- Version-controlled database changes
- Reproducible deployments
- Zero-downtime upgrades
- Rollback capabilities

### Current Migration Status (UPDATED - August 10, 2025)

| Service | Database | Migrations Created | Location | Notes |
|---------|----------|-------------------|----------|-------|
| Auth | soc_auth | ✅ | `src/migrations` | Fixed - Now using standard location |
| Client | soc_clients | ✅ | `src/migrations` | Standard location |
| Policy | soc_policies | ✅ | `src/migrations` | Standard location |
| Control | soc_controls | ✅ | `src/migrations` | Standard location |
| Evidence | soc_evidence | ✅ | `src/migrations` | Standard location |
| Workflow | soc_workflows | ✅ | `src/migrations` | **Service not in docker-compose.yml** |
| Reporting | soc_reporting | ✅ | `src/migrations` | Standard location |
| Audit | soc_audits | ✅ | `src/migrations` | Standard location |
| Integration | soc_integrations | ✅ | `src/migrations` | Standard location |
| Notification | soc_notifications | ✅ | `src/migrations` | Standard location |
| AI | soc_ai | ✅ | `src/migrations` | Standard location |

**Status Notes:**
- All services have migration directories in standard location `src/migrations`
- Auth service migration location has been fixed (was in `src/database/migrations`, now in `src/migrations`)
- Workflow service exists but is not configured in docker-compose.yml
- Initial migration created for auth-service to match other services

## Migration Strategy

### Development Workflow

1. **Entity Changes First**: Always modify TypeORM entities before generating migrations
2. **Generate Migration**: Use the PowerShell script to generate migrations
3. **Review Generated SQL**: Check the generated migration for accuracy
4. **Test Locally**: Run migration against local database
5. **Test Rollback**: Ensure the down() method works correctly
6. **Commit**: Include migration with entity changes

### Naming Conventions

```bash
# Format: timestamp-DescriptiveName
1753250000000-InitialSchema.ts
1753260000000-AddUserMetadata.ts
1753270000000-CreateAuditIndexes.ts
```

## Creating Migrations

### Using the Generation Script

```powershell
# Generate a new migration
.\scripts\generate-migration.ps1 -Service policy -MigrationName "AddPolicyTemplates"

# Dry run to see what would be generated
.\scripts\generate-migration.ps1 -Service policy -MigrationName "AddPolicyTemplates" -DryRun
```

### Manual Migration Creation

For complex migrations that can't be auto-generated:

```typescript
// services/[service-name]/src/migrations/[timestamp]-[Name].ts
import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class AddPolicyTemplates1753260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new table
    await queryRunner.createTable(
      new Table({
        name: 'policy_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'content',
            type: 'jsonb',
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'policy_templates',
      new Index({
        name: 'IDX_policy_templates_name',
        columnNames: ['name'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('policy_templates', 'IDX_policy_templates_name');
    await queryRunner.dropTable('policy_templates');
  }
}
```

## Running Migrations

### Using the Run Script

```powershell
# Run all pending migrations for a service
.\scripts\run-migrations.ps1 -Service policy

# Run migrations for all services
.\scripts\run-migrations.ps1 -Service all

# Show migration status
.\scripts\run-migrations.ps1 -Service policy -Show

# Revert last migration
.\scripts\run-migrations.ps1 -Service policy -Revert

# Dry run
.\scripts\run-migrations.ps1 -Service policy -DryRun
```

### Using NPM Scripts

```bash
# Navigate to service directory
cd services/policy-service

# Run migrations
npm run migration:run

# Show migrations
npm run migration:show

# Revert last migration
npm run migration:revert
```

### Running All Service Migrations (July 31, 2025)

To execute migrations for all 11 services in the correct order:

```bash
# Execute all migrations
cd services/auth-service && npm run migration:run
cd ../client-service && npm run migration:run
cd ../policy-service && npm run migration:run
cd ../control-service && npm run migration:run
cd ../evidence-service && npm run migration:run
cd ../workflow-service && npm run migration:run
cd ../reporting-service && npm run migration:run
cd ../audit-service && npm run migration:run
cd ../integration-service && npm run migration:run
cd ../notification-service && npm run migration:run
cd ../ai-service && npm run migration:run

# Or use the PowerShell script
.\scripts\run-all-migrations.ps1
```

### In Production

```bash
# Run migrations during deployment
NODE_ENV=production npm run migration:run

# With explicit database URL
DATABASE_URL=postgresql://user:pass@host:5432/soc_policies npm run migration:run
```

## Migration Best Practices

### 1. Always Include Down Method

```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Reverse all changes made in up()
  // Order matters - reverse the sequence
  await queryRunner.dropTable('new_table');
  await queryRunner.query('DROP TYPE IF EXISTS new_enum');
}
```

### 2. Handle Enums Carefully

```typescript
// Creating enums
await queryRunner.query(`
  CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
`);

// Adding enum values (PostgreSQL 9.1+)
await queryRunner.query(`
  ALTER TYPE user_status ADD VALUE 'archived';
`);

// Note: You cannot remove enum values in PostgreSQL
```

### 3. Zero-Downtime Migrations

```typescript
// Step 1: Add nullable column
await queryRunner.addColumn(
  'users',
  new TableColumn({
    name: 'email_verified',
    type: 'boolean',
    isNullable: true,
    default: false,
  })
);

// Step 2: Backfill data
await queryRunner.query(`
  UPDATE users SET email_verified = false WHERE email_verified IS NULL;
`);

// Step 3: Make column NOT NULL (in separate migration)
await queryRunner.changeColumn(
  'users',
  'email_verified',
  new TableColumn({
    name: 'email_verified',
    type: 'boolean',
    isNullable: false,
    default: false,
  })
);
```

### 4. Index Management

```typescript
// Create index concurrently (doesn't lock table)
await queryRunner.query(`
  CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
`);

// Partial indexes for performance
await queryRunner.createIndex(
  'orders',
  new Index({
    name: 'IDX_orders_active',
    columnNames: ['status', 'createdAt'],
    where: 'status = \'active\'',
  })
);
```

### 5. Use Transactions Wisely

```typescript
// Some operations can't be in transactions
public async up(queryRunner: QueryRunner): Promise<void> {
  // This must be outside transaction
  await queryRunner.query('CREATE INDEX CONCURRENTLY ...');
  
  // These can be in transaction
  await queryRunner.startTransaction();
  try {
    await queryRunner.query('ALTER TABLE ...');
    await queryRunner.query('UPDATE ...');
    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  }
}
```

## Common Patterns

### Adding JSONB Column with Default

```typescript
await queryRunner.addColumn(
  'policies',
  new TableColumn({
    name: 'metadata',
    type: 'jsonb',
    default: "'{}'::jsonb",
    isNullable: false,
  })
);

// Create GIN index for JSONB queries
await queryRunner.query(`
  CREATE INDEX idx_policies_metadata ON policies USING GIN (metadata);
`);
```

### Creating Composite Indexes

```typescript
await queryRunner.createIndex(
  'audit_logs',
  new Index({
    name: 'IDX_audit_logs_composite',
    columnNames: ['organizationId', 'createdAt', 'action'],
  })
);
```

### Adding Foreign Keys

```typescript
await queryRunner.createForeignKey(
  'controls',
  new TableForeignKey({
    name: 'FK_controls_framework',
    columnNames: ['frameworkId'],
    referencedTableName: 'frameworks',
    referencedColumnNames: ['id'],
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
);
```

### Update Triggers

```typescript
// Create update trigger for updatedAt
await queryRunner.query(`
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updatedAt = CURRENT_TIMESTAMP;
      RETURN NEW;
  END;
  $$ language 'plpgsql';

  CREATE TRIGGER update_policies_updated_at 
    BEFORE UPDATE ON policies
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
`);
```

## Troubleshooting

### Common Issues

#### 1. Migration Already Exists
```
Error: Migration "AddUserTable1234567890" has already been executed.
```

**Solution**: Check the migrations table:
```sql
SELECT * FROM migrations;
```

#### 2. Enum Type Already Exists
```
Error: type "user_status" already exists
```

**Solution**: Check if type exists before creating:
```typescript
await queryRunner.query(`
  DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$;
`);
```

#### 3. Cannot Drop Column with Dependencies
```
Error: cannot drop column because other objects depend on it
```

**Solution**: Drop dependencies first:
```typescript
// Drop index first
await queryRunner.dropIndex('table_name', 'IDX_table_column');
// Then drop column
await queryRunner.dropColumn('table_name', 'column_name');
```

### Debugging Migrations

```bash
# Enable TypeORM logging
export DEBUG=typeorm:*

# Check migration SQL without running
npm run typeorm migration:show

# Connect to database directly
docker exec -it overmatch-digital-postgres-1 psql -U postgres -d soc_policies
```

### Recovery Procedures

If a migration fails halfway:

1. **Check transaction status**:
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';
   ```

2. **Manually rollback if needed**:
   ```sql
   ROLLBACK;
   ```

3. **Fix the migration and retry**:
   ```bash
   npm run migration:revert
   # Fix the migration file
   npm run migration:run
   ```

## Migration Checklist

Before committing a migration:

- [ ] Entity changes are complete
- [ ] Migration has both up() and down() methods
- [ ] Migration has been tested locally
- [ ] Rollback has been tested
- [ ] No syntax errors in SQL
- [ ] Indexes are named consistently
- [ ] Foreign keys have proper constraints
- [ ] Large data migrations are batched
- [ ] Production impact has been assessed

## Recent Migration Improvements (July 31, 2025)

### Key Achievements
1. **All Services Migrated**: Successfully created and executed migrations for all 11 services
2. **Index Syntax Fixed**: Resolved all index creation syntax errors across services
3. **TypeORM Configuration**: Standardized configuration with proper credentials
4. **Entity Enhancements**: Updated entities with proper fields instead of generic metadata

### Lessons Learned
1. **Consistent Index Naming**: Use `IDX_` prefix for all indexes
2. **Enum Handling**: Always check for existing enums before creation
3. **Foreign Key Order**: Create tables before adding foreign key constraints
4. **Migration Testing**: Always test both up() and down() methods

## Next Steps

1. ✅ **COMPLETED**: All service migrations created and executed
2. **Set up CI/CD integration**: Automate migration running in deployment pipeline
3. **Create backup strategy**: Implement pre-migration backups
4. **Monitor migration performance**: Track migration execution times
5. **Document rollback procedures**: Create detailed rollback guides