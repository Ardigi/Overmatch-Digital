import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateIntegrationTables1706203000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "integration_type" AS ENUM ('CRM', 'MARKETING', 'SECURITY', 'CLOUD', 'TICKETING', 'COMMUNICATION', 'ANALYTICS', 'CUSTOM');
    `);

    await queryRunner.query(`
      CREATE TYPE "integration_status" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'ERROR', 'MAINTENANCE');
    `);

    await queryRunner.query(`
      CREATE TYPE "auth_type" AS ENUM ('API_KEY', 'OAUTH2', 'BASIC', 'TOKEN', 'CUSTOM');
    `);

    await queryRunner.query(`
      CREATE TYPE "sync_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');
    `);

    await queryRunner.query(`
      CREATE TYPE "webhook_status" AS ENUM ('ACTIVE', 'INACTIVE', 'FAILED');
    `);

    await queryRunner.query(`
      CREATE TYPE "webhook_event_status" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'RETRY');
    `);

    await queryRunner.query(`
      CREATE TYPE "log_level" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');
    `);

    // Create integrations table
    await queryRunner.createTable(
      new Table({
        name: 'integrations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'integrationType',
            type: 'integration_type',
          },
          {
            name: 'authType',
            type: 'auth_type',
          },
          {
            name: 'status',
            type: 'integration_status',
            default: "'PENDING'",
          },
          {
            name: 'isHealthy',
            type: 'boolean',
            default: false,
          },
          {
            name: 'healthMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'configuration',
            type: 'jsonb',
          },
          {
            name: 'healthCheck',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'stats',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create integration_credentials table
    await queryRunner.createTable(
      new Table({
        name: 'integration_credentials',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'integrationId',
            type: 'uuid',
          },
          {
            name: 'credentialType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'encryptedValue',
            type: 'text',
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isExpired',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['integrationId'],
            referencedTableName: 'integrations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create integration_logs table
    await queryRunner.createTable(
      new Table({
        name: 'integration_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'integrationId',
            type: 'uuid',
          },
          {
            name: 'level',
            type: 'log_level',
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'request',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'duration',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['integrationId'],
            referencedTableName: 'integrations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create sync_schedules table
    await queryRunner.createTable(
      new Table({
        name: 'sync_schedules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'integrationId',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'cronExpression',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'UTC'",
          },
          {
            name: 'syncConfig',
            type: 'jsonb',
          },
          {
            name: 'lastRunAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'nextRunAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'runCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'successCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'failureCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['integrationId'],
            referencedTableName: 'integrations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create sync_jobs table
    await queryRunner.createTable(
      new Table({
        name: 'sync_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'integrationId',
            type: 'uuid',
          },
          {
            name: 'scheduleId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'jobType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'sync_status',
            default: "'PENDING'",
          },
          {
            name: 'progress',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalItems',
            type: 'int',
            default: 0,
          },
          {
            name: 'processedItems',
            type: 'int',
            default: 0,
          },
          {
            name: 'successfulItems',
            type: 'int',
            default: 0,
          },
          {
            name: 'failedItems',
            type: 'int',
            default: 0,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'duration',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorDetails',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'maxRetries',
            type: 'int',
            default: 3,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['integrationId'],
            referencedTableName: 'integrations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['scheduleId'],
            referencedTableName: 'sync_schedules',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true
    );

    // Create webhook_endpoints table
    await queryRunner.createTable(
      new Table({
        name: 'webhook_endpoints',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'secret',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'status',
            type: 'webhook_status',
            default: "'ACTIVE'",
          },
          {
            name: 'events',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'headers',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'retryConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'lastTriggeredAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failureCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'successCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create webhook_events table
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'endpointId',
            type: 'uuid',
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'status',
            type: 'webhook_event_status',
            default: "'PENDING'",
          },
          {
            name: 'payload',
            type: 'jsonb',
          },
          {
            name: 'headers',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'signature',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'attempts',
            type: 'int',
            default: 0,
          },
          {
            name: 'maxAttempts',
            type: 'int',
            default: 3,
          },
          {
            name: 'lastAttemptAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'nextRetryAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deliveredAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'response',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'duration',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['endpointId'],
            referencedTableName: 'webhook_endpoints',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indices
    await queryRunner.query(
      `CREATE INDEX "IDX_integrations_organizationId" ON "integrations" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_integrations_organizationId_name" ON "integrations" ("organizationId", "name") WHERE "deletedAt" IS NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_integrations_organizationId_integrationType" ON "integrations" ("organizationId", "integrationType")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_integrations_status" ON "integrations" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_integrations_tags" ON "integrations" ("tags")`);

    await queryRunner.query(
      `CREATE INDEX "IDX_integration_credentials_integrationId" ON "integration_credentials" ("integrationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_integration_credentials_expiresAt" ON "integration_credentials" ("expiresAt")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_integration_logs_integrationId" ON "integration_logs" ("integrationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_integration_logs_level" ON "integration_logs" ("level")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_integration_logs_createdAt" ON "integration_logs" ("createdAt")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_sync_schedules_integrationId" ON "sync_schedules" ("integrationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_schedules_isActive" ON "sync_schedules" ("isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_schedules_nextRunAt" ON "sync_schedules" ("nextRunAt")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_sync_jobs_integrationId" ON "sync_jobs" ("integrationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_jobs_scheduleId" ON "sync_jobs" ("scheduleId")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_status" ON "sync_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_createdAt" ON "sync_jobs" ("createdAt")`);

    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_endpoints_organizationId" ON "webhook_endpoints" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_endpoints_status" ON "webhook_endpoints" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_endpoints_events" ON "webhook_endpoints" ("events")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_events_endpointId" ON "webhook_events" ("endpointId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_events_eventType" ON "webhook_events" ("eventType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_events_status" ON "webhook_events" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_events_createdAt" ON "webhook_events" ("createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_webhook_events_nextRetryAt" ON "webhook_events" ("nextRetryAt") WHERE "status" IN ('PENDING', 'RETRY')`
    );

    // Create update trigger function if not exists
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updatedAt = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create update triggers
    await queryRunner.query(`
      CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_integration_credentials_updated_at BEFORE UPDATE ON integration_credentials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_sync_schedules_updated_at BEFORE UPDATE ON sync_schedules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_sync_jobs_updated_at BEFORE UPDATE ON sync_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON webhook_endpoints
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON webhook_endpoints;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_sync_jobs_updated_at ON sync_jobs;`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_sync_schedules_updated_at ON sync_schedules;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_integration_credentials_updated_at ON integration_credentials;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_integrations_updated_at ON integrations;`
    );

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_nextRetryAt');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_createdAt');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_status');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_eventType');
    await queryRunner.dropIndex('webhook_events', 'IDX_webhook_events_endpointId');

    await queryRunner.dropIndex('webhook_endpoints', 'IDX_webhook_endpoints_events');
    await queryRunner.dropIndex('webhook_endpoints', 'IDX_webhook_endpoints_status');
    await queryRunner.dropIndex('webhook_endpoints', 'IDX_webhook_endpoints_organizationId');

    await queryRunner.dropIndex('sync_jobs', 'IDX_sync_jobs_createdAt');
    await queryRunner.dropIndex('sync_jobs', 'IDX_sync_jobs_status');
    await queryRunner.dropIndex('sync_jobs', 'IDX_sync_jobs_scheduleId');
    await queryRunner.dropIndex('sync_jobs', 'IDX_sync_jobs_integrationId');

    await queryRunner.dropIndex('sync_schedules', 'IDX_sync_schedules_nextRunAt');
    await queryRunner.dropIndex('sync_schedules', 'IDX_sync_schedules_isActive');
    await queryRunner.dropIndex('sync_schedules', 'IDX_sync_schedules_integrationId');

    await queryRunner.dropIndex('integration_logs', 'IDX_integration_logs_createdAt');
    await queryRunner.dropIndex('integration_logs', 'IDX_integration_logs_level');
    await queryRunner.dropIndex('integration_logs', 'IDX_integration_logs_integrationId');

    await queryRunner.dropIndex('integration_credentials', 'IDX_integration_credentials_expiresAt');
    await queryRunner.dropIndex(
      'integration_credentials',
      'IDX_integration_credentials_integrationId'
    );

    await queryRunner.dropIndex('integrations', 'IDX_integrations_tags');
    await queryRunner.dropIndex('integrations', 'IDX_integrations_status');
    await queryRunner.dropIndex('integrations', 'IDX_integrations_organizationId_integrationType');
    await queryRunner.dropIndex('integrations', 'IDX_integrations_organizationId_name');
    await queryRunner.dropIndex('integrations', 'IDX_integrations_organizationId');

    // Drop tables
    await queryRunner.dropTable('webhook_events');
    await queryRunner.dropTable('webhook_endpoints');
    await queryRunner.dropTable('sync_jobs');
    await queryRunner.dropTable('sync_schedules');
    await queryRunner.dropTable('integration_logs');
    await queryRunner.dropTable('integration_credentials');
    await queryRunner.dropTable('integrations');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "log_level";`);
    await queryRunner.query(`DROP TYPE "webhook_event_status";`);
    await queryRunner.query(`DROP TYPE "webhook_status";`);
    await queryRunner.query(`DROP TYPE "sync_status";`);
    await queryRunner.query(`DROP TYPE "auth_type";`);
    await queryRunner.query(`DROP TYPE "integration_status";`);
    await queryRunner.query(`DROP TYPE "integration_type";`);
  }
}
