import { type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class AddNotificationRulesAndUpdates1706205000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add PUSH to notification_channel enum
    await queryRunner.query(`
      ALTER TYPE "notification_channel" ADD VALUE IF NOT EXISTS 'push';
    `);

    // Add MARKETING to notification_type enum (if not exists)
    await queryRunner.query(`
      ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'marketing';
    `);

    // Create notification rule type enum
    await queryRunner.query(`
      CREATE TYPE "notification_rule_type" AS ENUM ('EVENT_BASED', 'SCHEDULED', 'CONDITIONAL', 'THRESHOLD');
    `);

    // Update notification_templates table to match current entity
    await queryRunner.query(`
      ALTER TABLE "notification_templates" 
      ADD COLUMN IF NOT EXISTS "code" varchar(100),
      ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "isSystem" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 100,
      ADD COLUMN IF NOT EXISTS "isTransactional" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "performance" jsonb DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "defaultVariables" jsonb,
      ADD COLUMN IF NOT EXISTS "supportedLocales" text[],
      ADD COLUMN IF NOT EXISTS "defaultLocale" varchar(10) DEFAULT 'en';
    `);

    // Rename templateId to code if needed and make it unique with organizationId
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_templates' 
                   AND column_name = 'templateId') THEN
          -- Copy templateId to code if code is empty
          UPDATE notification_templates SET code = "templateId" WHERE code IS NULL;
          -- Drop the old templateId column
          ALTER TABLE notification_templates DROP COLUMN "templateId";
        END IF;
      END $$;
    `);

    // Create unique constraint on organizationId + code
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_templates_org_code" 
      ON "notification_templates" ("organizationId", "code");
    `);

    // Rename columns to match entity
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_templates' 
                   AND column_name = 'htmlContent') THEN
          ALTER TABLE notification_templates RENAME COLUMN "htmlContent" TO "htmlBody";
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'notification_templates' 
                       AND column_name = 'content' 
                       AND data_type = 'jsonb') THEN
          -- Convert content from text to jsonb
          ALTER TABLE notification_templates ADD COLUMN "content_new" jsonb;
          UPDATE notification_templates SET "content_new" = jsonb_build_object('body', content);
          ALTER TABLE notification_templates DROP COLUMN content;
          ALTER TABLE notification_templates RENAME COLUMN "content_new" TO "content";
        END IF;
      END $$;
    `);

    // Create notification_rules table
    await queryRunner.createTable(
      new Table({
        name: 'notification_rules',
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
            name: 'ruleId',
            type: 'varchar',
            length: '100',
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
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 0,
          },
          {
            name: 'ruleType',
            type: 'notification_rule_type',
            default: "'EVENT_BASED'",
          },
          {
            name: 'conditions',
            type: 'jsonb',
          },
          {
            name: 'actions',
            type: 'jsonb',
          },
          {
            name: 'schedule',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rateLimits',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'integer',
            default: 1,
          },
          {
            name: 'eventType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'eventCategory',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'startDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'endDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'maxTriggers',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'cooldownMinutes',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
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

    // Create notification_rule_history table
    await queryRunner.createTable(
      new Table({
        name: 'notification_rule_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'ruleId',
            type: 'uuid',
          },
          {
            name: 'version',
            type: 'integer',
          },
          {
            name: 'changes',
            type: 'jsonb',
          },
          {
            name: 'changedBy',
            type: 'uuid',
          },
          {
            name: 'changeReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['ruleId'],
            referencedTableName: 'notification_rules',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create rule_evaluation_metrics table
    await queryRunner.createTable(
      new Table({
        name: 'rule_evaluation_metrics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'ruleId',
            type: 'uuid',
          },
          {
            name: 'evaluationDate',
            type: 'date',
          },
          {
            name: 'totalEvaluations',
            type: 'integer',
            default: 0,
          },
          {
            name: 'matchedEvaluations',
            type: 'integer',
            default: 0,
          },
          {
            name: 'failedEvaluations',
            type: 'integer',
            default: 0,
          },
          {
            name: 'avgExecutionTimeMs',
            type: 'float',
            default: 0,
          },
          {
            name: 'notificationsTriggered',
            type: 'integer',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['ruleId'],
            referencedTableName: 'notification_rules',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create event_notification_mapping table
    await queryRunner.createTable(
      new Table({
        name: 'event_notification_mapping',
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
            name: 'eventType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'ruleId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'templateId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'channel',
            type: 'notification_channel',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'integer',
            default: 100,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
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
        foreignKeys: [
          {
            columnNames: ['ruleId'],
            referencedTableName: 'notification_rules',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['templateId'],
            referencedTableName: 'notification_templates',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true
    );

    // Create indices for notification_rules
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rules_organizationId_isActive" 
      ON "notification_rules" ("organizationId", "isActive");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rules_ruleType_priority" 
      ON "notification_rules" ("ruleType", "priority");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_notification_rules_organizationId_ruleId" 
      ON "notification_rules" ("organizationId", "ruleId");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rules_eventType" 
      ON "notification_rules" ("eventType") WHERE "eventType" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rules_tags" 
      ON "notification_rules" USING GIN ("tags") WHERE "tags" IS NOT NULL;
    `);

    // Create indices for notification_rule_history
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rule_history_ruleId" 
      ON "notification_rule_history" ("ruleId");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_rule_history_createdAt" 
      ON "notification_rule_history" ("createdAt");
    `);

    // Create indices for rule_evaluation_metrics
    await queryRunner.query(`
      CREATE INDEX "IDX_rule_evaluation_metrics_ruleId_evaluationDate" 
      ON "rule_evaluation_metrics" ("ruleId", "evaluationDate");
    `);

    // Create indices for event_notification_mapping
    await queryRunner.query(`
      CREATE INDEX "IDX_event_notification_mapping_organizationId_eventType" 
      ON "event_notification_mapping" ("organizationId", "eventType");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_notification_mapping_isActive" 
      ON "event_notification_mapping" ("isActive");
    `);

    // Create update triggers for new tables
    await queryRunner.query(`
      CREATE TRIGGER update_notification_rules_updated_at BEFORE UPDATE ON notification_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_rule_evaluation_metrics_updated_at BEFORE UPDATE ON rule_evaluation_metrics
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await queryRunner.query(`
      CREATE TRIGGER update_event_notification_mapping_updated_at BEFORE UPDATE ON event_notification_mapping
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_event_notification_mapping_updated_at ON event_notification_mapping;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_rule_evaluation_metrics_updated_at ON rule_evaluation_metrics;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;`
    );

    // Drop indices
    await queryRunner.dropIndex('event_notification_mapping', 'IDX_event_notification_mapping_isActive');
    await queryRunner.dropIndex(
      'event_notification_mapping',
      'IDX_event_notification_mapping_organizationId_eventType'
    );
    await queryRunner.dropIndex(
      'rule_evaluation_metrics',
      'IDX_rule_evaluation_metrics_ruleId_evaluationDate'
    );
    await queryRunner.dropIndex('notification_rule_history', 'IDX_notification_rule_history_createdAt');
    await queryRunner.dropIndex('notification_rule_history', 'IDX_notification_rule_history_ruleId');
    await queryRunner.dropIndex('notification_rules', 'IDX_notification_rules_tags');
    await queryRunner.dropIndex('notification_rules', 'IDX_notification_rules_eventType');
    await queryRunner.dropIndex(
      'notification_rules',
      'IDX_notification_rules_organizationId_ruleId'
    );
    await queryRunner.dropIndex('notification_rules', 'IDX_notification_rules_ruleType_priority');
    await queryRunner.dropIndex(
      'notification_rules',
      'IDX_notification_rules_organizationId_isActive'
    );

    // Drop tables
    await queryRunner.dropTable('event_notification_mapping');
    await queryRunner.dropTable('rule_evaluation_metrics');
    await queryRunner.dropTable('notification_rule_history');
    await queryRunner.dropTable('notification_rules');

    // Drop unique constraint
    await queryRunner.dropIndex('notification_templates', 'UQ_notification_templates_org_code');

    // Revert notification_templates changes
    await queryRunner.query(`
      ALTER TABLE "notification_templates" 
      DROP COLUMN IF EXISTS "code",
      DROP COLUMN IF EXISTS "isActive",
      DROP COLUMN IF EXISTS "isSystem",
      DROP COLUMN IF EXISTS "priority",
      DROP COLUMN IF EXISTS "isTransactional",
      DROP COLUMN IF EXISTS "performance",
      DROP COLUMN IF EXISTS "defaultVariables",
      DROP COLUMN IF EXISTS "supportedLocales",
      DROP COLUMN IF EXISTS "defaultLocale";
    `);

    // Drop notification rule type enum
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_rule_type";`);

    // Note: We cannot easily remove enum values from existing types in PostgreSQL
    // The PUSH value will remain in the notification_channel enum
  }
}