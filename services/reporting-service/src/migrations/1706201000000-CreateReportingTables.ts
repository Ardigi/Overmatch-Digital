import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateReportingTables1706201000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "report_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TYPE "report_format" AS ENUM ('PDF', 'EXCEL', 'WORD', 'CSV', 'JSON');
    `);

    await queryRunner.query(`
      CREATE TYPE "delivery_method" AS ENUM ('email', 'webhook', 'storage');
    `);

    // Create report_templates table
    await queryRunner.createTable(
      new Table({
        name: 'report_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'report_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'format',
            type: 'varchar',
            length: '20',
            default: "'PDF'",
          },
          {
            name: 'template_content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'default_sections',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'sections',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'data_schema',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create reports table
    await queryRunner.createTable(
      new Table({
        name: 'reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'template_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'report_type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'report_status',
            default: "'pending'",
          },
          {
            name: 'format',
            type: 'report_format',
            default: "'PDF'",
          },
          {
            name: 'file_path',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'file_size',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'mime_type',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'checksum',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'file_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'generated_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'generated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'period_start',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'period_end',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'reporting_period_start',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'reporting_period_end',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'sections',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'filters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'summary',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error_details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'processing_started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'processing_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'generation_time_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['template_id'],
            referencedTableName: 'report_templates',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true
    );

    // Create report_schedules table
    await queryRunner.createTable(
      new Table({
        name: 'report_schedules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'report_template_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cron_expression',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '50',
            default: "'UTC'",
          },
          {
            name: 'recipients',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'format',
            type: 'varchar',
            length: '20',
            default: "'PDF'",
          },
          {
            name: 'parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'filters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'delivery_method',
            type: 'delivery_method',
            default: "'email'",
          },
          {
            name: 'delivery_config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'last_run_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_run_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'execution_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'success_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'failure_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'last_error_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['report_template_id'],
            referencedTableName: 'report_templates',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indices for report_templates table
    await queryRunner.query(
      `CREATE INDEX "IDX_report_templates_organizationId" ON "report_templates" ("organization_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_templates_organizationId_isActive" ON "report_templates" ("organization_id", "is_active")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_templates_organizationId_reportType" ON "report_templates" ("organization_id", "report_type")`
    );

    // Create indices for reports table
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_organizationId" ON "reports" ("organization_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_organizationId_createdAt" ON "reports" ("organization_id", "created_at")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_organizationId_status" ON "reports" ("organization_id", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_organizationId_reportType" ON "reports" ("organization_id", "report_type")`
    );

    // Create indices for report_schedules table
    await queryRunner.query(
      `CREATE INDEX "IDX_report_schedules_organizationId" ON "report_schedules" ("organization_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_report_schedules_organizationId_isActive" ON "report_schedules" ("organization_id", "is_active")`
    );

    // Create update trigger function if not exists
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create update triggers for all tables
    await queryRunner.query(`
      CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_report_schedules_updated_at BEFORE UPDATE ON report_schedules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_report_schedules_updated_at ON report_schedules;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_report_templates_updated_at ON report_templates;`
    );

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex('report_schedules', 'IDX_report_schedules_organizationId_isActive');
    await queryRunner.dropIndex('report_schedules', 'IDX_report_schedules_organizationId');

    await queryRunner.dropIndex('reports', 'IDX_reports_organizationId_reportType');
    await queryRunner.dropIndex('reports', 'IDX_reports_organizationId_status');
    await queryRunner.dropIndex('reports', 'IDX_reports_organizationId_createdAt');
    await queryRunner.dropIndex('reports', 'IDX_reports_organizationId');

    await queryRunner.dropIndex(
      'report_templates',
      'IDX_report_templates_organizationId_reportType'
    );
    await queryRunner.dropIndex('report_templates', 'IDX_report_templates_organizationId_isActive');
    await queryRunner.dropIndex('report_templates', 'IDX_report_templates_organizationId');

    // Drop tables
    await queryRunner.dropTable('report_schedules');
    await queryRunner.dropTable('reports');
    await queryRunner.dropTable('report_templates');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "delivery_method";`);
    await queryRunner.query(`DROP TYPE "report_format";`);
    await queryRunner.query(`DROP TYPE "report_status";`);
  }
}
