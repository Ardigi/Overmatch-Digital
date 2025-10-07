import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateNotificationTables1706204000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "notification_channel" AS ENUM ('email', 'sms', 'in_app', 'slack', 'teams', 'webhook');
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_type" AS ENUM ('alert', 'info', 'warning', 'error', 'success', 'reminder', 'approval', 'assignment', 'mention', 'system', 'transactional', 'announcement');
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_priority" AS ENUM ('low', 'medium', 'high', 'urgent');
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_status" AS ENUM ('pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'unsubscribed');
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_category" AS ENUM ('system', 'security', 'compliance', 'audit', 'policy', 'control', 'evidence', 'workflow', 'report', 'user', 'billing', 'marketing');
    `);

    await queryRunner.query(`
      CREATE TYPE "preference_status" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');
    `);

    await queryRunner.query(`
      CREATE TYPE "delivery_method" AS ENUM ('IMMEDIATE', 'BATCHED', 'SCHEDULED');
    `);

    await queryRunner.query(`
      CREATE TYPE "template_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
    `);

    // Create notifications table
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
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
            type: 'uuid',
          },
          {
            name: 'notificationId',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'channel',
            type: 'notification_channel',
          },
          {
            name: 'type',
            type: 'notification_type',
          },
          {
            name: 'priority',
            type: 'notification_priority',
            default: "'medium'",
          },
          {
            name: 'status',
            type: 'notification_status',
            default: "'pending'",
          },
          {
            name: 'category',
            type: 'notification_category',
            default: "'system'",
          },
          {
            name: 'templateId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'recipient',
            type: 'jsonb',
          },
          {
            name: 'recipientId',
            type: 'uuid',
          },
          {
            name: 'content',
            type: 'jsonb',
          },
          {
            name: 'variables',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'scheduledFor',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'sentAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deliveredAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'openedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'clickedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'openCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'clickCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'deliveryAttempts',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'deliveryAttemptsCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'lastError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'providerResponse',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'providerMessageId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'tracking',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'groupId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'batchId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isTransactional',
            type: 'boolean',
            default: false,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
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

    // Create notification_templates table
    await queryRunner.createTable(
      new Table({
        name: 'notification_templates',
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
            type: 'uuid',
          },
          {
            name: 'templateId',
            type: 'varchar',
            length: '100',
            isUnique: true,
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
            name: 'channel',
            type: 'notification_channel',
          },
          {
            name: 'type',
            type: 'notification_type',
          },
          {
            name: 'category',
            type: 'notification_category',
            default: "'system'",
          },
          {
            name: 'status',
            type: 'template_status',
            default: "'DRAFT'",
          },
          {
            name: 'subject',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'htmlContent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'variables',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'defaultValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'attachments',
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
            isNullable: true,
          },
          {
            name: 'version',
            type: 'integer',
            default: 1,
          },
          {
            name: 'lastUsedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'usageCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'createdBy',
            type: 'uuid',
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
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
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create notification_preferences table
    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
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
            type: 'uuid',
          },
          {
            name: 'userId',
            type: 'uuid',
          },
          {
            name: 'channel',
            type: 'notification_channel',
          },
          {
            name: 'category',
            type: 'notification_category',
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'deliveryMethod',
            type: 'delivery_method',
            default: "'IMMEDIATE'",
          },
          {
            name: 'frequency',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'schedule',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'filters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'unsubscribedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'unsubscribeToken',
            type: 'varchar',
            length: '100',
            isNullable: true,
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

    // Create notification_logs table for audit trail
    await queryRunner.createTable(
      new Table({
        name: 'notification_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'notificationId',
            type: 'uuid',
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'eventData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['notificationId'],
            referencedTableName: 'notifications',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create notification_batches table
    await queryRunner.createTable(
      new Table({
        name: 'notification_batches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'batchId',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'totalCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'processedCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'successCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failureCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
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
            name: 'createdBy',
            type: 'uuid',
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

    // Create indices
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_organizationId_status" ON "notifications" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_recipientId_status" ON "notifications" ("recipientId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_channel_status" ON "notifications" ("channel", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_type_priority" ON "notifications" ("type", "priority")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_scheduledFor" ON "notifications" ("scheduledFor") WHERE "scheduledFor" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_createdAt_status" ON "notifications" ("createdAt", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_batchId" ON "notifications" ("batchId") WHERE "batchId" IS NOT NULL`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_templates_organizationId" ON "notification_templates" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_templates_channel_type" ON "notification_templates" ("channel", "type")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_templates_status" ON "notification_templates" ("status")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_preferences_userId" ON "notification_preferences" ("userId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_notification_preferences_userId_channel_category" ON "notification_preferences" ("userId", "channel", "category")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_logs_notificationId" ON "notification_logs" ("notificationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_logs_timestamp" ON "notification_logs" ("timestamp")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notification_batches_organizationId" ON "notification_batches" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_batches_status" ON "notification_batches" ("status")`
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
      CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_notification_batches_updated_at BEFORE UPDATE ON notification_batches
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notification_batches_updated_at ON notification_batches;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;`
    );

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex('notification_batches', 'IDX_notification_batches_status');
    await queryRunner.dropIndex('notification_batches', 'IDX_notification_batches_organizationId');
    await queryRunner.dropIndex('notification_logs', 'IDX_notification_logs_timestamp');
    await queryRunner.dropIndex('notification_logs', 'IDX_notification_logs_notificationId');
    await queryRunner.dropIndex(
      'notification_preferences',
      'IDX_notification_preferences_userId_channel_category'
    );
    await queryRunner.dropIndex('notification_preferences', 'IDX_notification_preferences_userId');
    await queryRunner.dropIndex('notification_templates', 'IDX_notification_templates_status');
    await queryRunner.dropIndex(
      'notification_templates',
      'IDX_notification_templates_channel_type'
    );
    await queryRunner.dropIndex(
      'notification_templates',
      'IDX_notification_templates_organizationId'
    );
    await queryRunner.dropIndex('notifications', 'IDX_notifications_batchId');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_createdAt_status');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_scheduledFor');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_type_priority');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_channel_status');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_recipientId_status');
    await queryRunner.dropIndex('notifications', 'IDX_notifications_organizationId_status');

    // Drop tables
    await queryRunner.dropTable('notification_batches');
    await queryRunner.dropTable('notification_logs');
    await queryRunner.dropTable('notification_preferences');
    await queryRunner.dropTable('notification_templates');
    await queryRunner.dropTable('notifications');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "template_status";`);
    await queryRunner.query(`DROP TYPE "delivery_method";`);
    await queryRunner.query(`DROP TYPE "preference_status";`);
    await queryRunner.query(`DROP TYPE "notification_category";`);
    await queryRunner.query(`DROP TYPE "notification_status";`);
    await queryRunner.query(`DROP TYPE "notification_priority";`);
    await queryRunner.query(`DROP TYPE "notification_type";`);
    await queryRunner.query(`DROP TYPE "notification_channel";`);
  }
}
