import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateWorkflowTables1706200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "workflow_status" AS ENUM ('draft', 'active', 'inactive', 'archived');
    `);

    await queryRunner.query(`
      CREATE TYPE "instance_status" AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout');
    `);

    await queryRunner.query(`
      CREATE TYPE "execution_status" AS ENUM ('pending', 'running', 'waiting_approval', 'completed', 'failed', 'skipped', 'cancelled', 'timeout');
    `);

    await queryRunner.query(`
      CREATE TYPE "trigger_type" AS ENUM ('manual', 'event', 'schedule', 'webhook');
    `);

    // Create workflows table
    await queryRunner.createTable(
      new Table({
        name: 'workflows',
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
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'status',
            type: 'workflow_status',
            default: "'draft'",
          },
          {
            name: 'isDraft',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isTemplate',
            type: 'boolean',
            default: false,
          },
          {
            name: 'maxExecutionTime',
            type: 'int',
            isNullable: true,
            comment: 'Maximum execution time in seconds',
          },
          {
            name: 'retryConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'triggers',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'modifiedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'archivedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'archivedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'archiveReason',
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
      }),
      true
    );

    // Create workflow_steps table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_steps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflowId',
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
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'user_task, approval, system_task, email, condition, etc.',
          },
          {
            name: 'order',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'config',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'nextStepId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'errorStepIds',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'retryConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'parallel',
            type: 'boolean',
            isNullable: true,
          },
          {
            name: 'parallelGroup',
            type: 'varchar',
            length: '100',
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
            columnNames: ['workflowId'],
            referencedTableName: 'workflows',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create workflow_instances table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_instances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflowId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organizationId',
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
            name: 'status',
            type: 'instance_status',
            default: "'pending'",
          },
          {
            name: 'currentStepId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'context',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'totalSteps',
            type: 'int',
            default: 0,
          },
          {
            name: 'completedSteps',
            type: 'int',
            default: 0,
          },
          {
            name: 'triggerInfo',
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
            name: 'pausedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'pausedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'pauseReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cancelledAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelledBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cancelReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'executionTime',
            type: 'int',
            default: 0,
            comment: 'Execution time in seconds',
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'priority',
            type: 'int',
            isNullable: true,
            comment: '1-10, higher is more important',
          },
          {
            name: 'correlationId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'initiatedBy',
            type: 'varchar',
            length: '255',
            isNullable: false,
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
            columnNames: ['workflowId'],
            referencedTableName: 'workflows',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true
    );

    // Create workflow_step_executions table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_step_executions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'instanceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stepId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stepName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'stepType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'order',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'execution_status',
            default: "'pending'",
          },
          {
            name: 'inputs',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'outputs',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'approvals',
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
            name: 'executionTime',
            type: 'int',
            default: 0,
            comment: 'Execution time in seconds',
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastRetryAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'executedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'skippedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'skipReason',
            type: 'text',
            isNullable: true,
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
            columnNames: ['instanceId'],
            referencedTableName: 'workflow_instances',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indices for workflows table
    await queryRunner.query(
      `CREATE INDEX "IDX_workflows_organizationId_status" ON "workflows" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflows_organizationId_category" ON "workflows" ("organizationId", "category")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_workflows_organizationId_name" ON "workflows" ("organizationId", "name")`
    );

    // Create indices for workflow_steps table
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_steps_workflowId_order" ON "workflow_steps" ("workflowId", "order")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_steps_workflowId_name" ON "workflow_steps" ("workflowId", "name")`
    );

    // Create indices for workflow_instances table
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_instances_organizationId_status" ON "workflow_instances" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_instances_workflowId_status" ON "workflow_instances" ("workflowId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_instances_organizationId_startedAt" ON "workflow_instances" ("organizationId", "startedAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_instances_correlationId" ON "workflow_instances" ("correlationId")`
    );

    // Create indices for workflow_step_executions table
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_step_executions_instanceId_stepId" ON "workflow_step_executions" ("instanceId", "stepId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_step_executions_instanceId_status" ON "workflow_step_executions" ("instanceId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_step_executions_instanceId_order" ON "workflow_step_executions" ("instanceId", "order")`
    );

    // Create update trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updatedAt = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create update triggers for all tables
    await queryRunner.query(`
      CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_workflow_step_executions_updated_at BEFORE UPDATE ON workflow_step_executions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_workflow_step_executions_updated_at ON workflow_step_executions;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_workflow_instances_updated_at ON workflow_instances;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_workflow_steps_updated_at ON workflow_steps;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;`);

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex(
      'workflow_step_executions',
      'IDX_workflow_step_executions_instanceId_order'
    );
    await queryRunner.dropIndex(
      'workflow_step_executions',
      'IDX_workflow_step_executions_instanceId_status'
    );
    await queryRunner.dropIndex(
      'workflow_step_executions',
      'IDX_workflow_step_executions_instanceId_stepId'
    );

    await queryRunner.dropIndex('workflow_instances', 'IDX_workflow_instances_correlationId');
    await queryRunner.dropIndex(
      'workflow_instances',
      'IDX_workflow_instances_organizationId_startedAt'
    );
    await queryRunner.dropIndex('workflow_instances', 'IDX_workflow_instances_workflowId_status');
    await queryRunner.dropIndex(
      'workflow_instances',
      'IDX_workflow_instances_organizationId_status'
    );

    await queryRunner.dropIndex('workflow_steps', 'IDX_workflow_steps_workflowId_name');
    await queryRunner.dropIndex('workflow_steps', 'IDX_workflow_steps_workflowId_order');

    await queryRunner.dropIndex('workflows', 'IDX_workflows_organizationId_name');
    await queryRunner.dropIndex('workflows', 'IDX_workflows_organizationId_category');
    await queryRunner.dropIndex('workflows', 'IDX_workflows_organizationId_status');

    // Drop tables
    await queryRunner.dropTable('workflow_step_executions');
    await queryRunner.dropTable('workflow_instances');
    await queryRunner.dropTable('workflow_steps');
    await queryRunner.dropTable('workflows');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "trigger_type";`);
    await queryRunner.query(`DROP TYPE "execution_status";`);
    await queryRunner.query(`DROP TYPE "instance_status";`);
    await queryRunner.query(`DROP TYPE "workflow_status";`);
  }
}
