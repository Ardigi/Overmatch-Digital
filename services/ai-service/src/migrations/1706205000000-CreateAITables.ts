import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateAITables1706205000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "analysis_type" AS ENUM ('compliance_gap', 'risk_assessment', 'predictive', 'trend', 'control_mapping');
    `);

    await queryRunner.query(`
      CREATE TYPE "analysis_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TYPE "prediction_type" AS ENUM ('risk_score', 'compliance_score', 'audit_success', 'control_effectiveness', 'custom');
    `);

    await queryRunner.query(`
      CREATE TYPE "prediction_status" AS ENUM ('pending', 'completed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TYPE "mapping_status" AS ENUM ('draft', 'active', 'review', 'approved', 'deprecated');
    `);

    await queryRunner.query(`
      CREATE TYPE "remediation_priority" AS ENUM ('critical', 'high', 'medium', 'low');
    `);

    await queryRunner.query(`
      CREATE TYPE "remediation_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');
    `);

    await queryRunner.query(`
      CREATE TYPE "model_status" AS ENUM ('training', 'ready', 'deployed', 'deprecated', 'failed');
    `);

    // Create compliance_analyses table
    await queryRunner.createTable(
      new Table({
        name: 'compliance_analyses',
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
            name: 'clientId',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'analysis_type',
          },
          {
            name: 'status',
            type: 'analysis_status',
            default: "'pending'",
          },
          {
            name: 'findings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorDetails',
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

    // Create predictions table
    await queryRunner.createTable(
      new Table({
        name: 'predictions',
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
            name: 'clientId',
            type: 'uuid',
          },
          {
            name: 'type',
            type: 'prediction_type',
          },
          {
            name: 'status',
            type: 'prediction_status',
            default: "'pending'",
          },
          {
            name: 'targetDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'predictedValue',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'actualValue',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'confidence',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'factors',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'modelId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'modelVersion',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'accuracy',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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

    // Create framework_mappings table
    await queryRunner.createTable(
      new Table({
        name: 'framework_mappings',
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
            name: 'sourceFramework',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'targetFramework',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'status',
            type: 'mapping_status',
            default: "'draft'",
          },
          {
            name: 'mappings',
            type: 'jsonb',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            default: "'1.0'",
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'confidence',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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

    // Create remediations table
    await queryRunner.createTable(
      new Table({
        name: 'remediations',
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
            name: 'clientId',
            type: 'uuid',
          },
          {
            name: 'findingId',
            type: 'uuid',
          },
          {
            name: 'controlId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'priority',
            type: 'remediation_priority',
          },
          {
            name: 'status',
            type: 'remediation_status',
            default: "'pending'",
          },
          {
            name: 'steps',
            type: 'jsonb',
          },
          {
            name: 'estimatedEffort',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'actualEffort',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'estimatedCost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'actualCost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'targetDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'assignedTo',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'effectiveness',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'aiGenerated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'aiConfidence',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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

    // Create ai_models table
    await queryRunner.createTable(
      new Table({
        name: 'ai_models',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'modelId',
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
            name: 'type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'model_status',
            default: "'training'",
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'parameters',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'trainingData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'deploymentInfo',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'lastTrainedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deployedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deprecatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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

    // Create ai_training_jobs table
    await queryRunner.createTable(
      new Table({
        name: 'ai_training_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'modelId',
            type: 'uuid',
          },
          {
            name: 'jobType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'progress',
            type: 'int',
            default: 0,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'results',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
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
            name: 'duration',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
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
            columnNames: ['modelId'],
            referencedTableName: 'ai_models',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indices
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_analyses_organizationId_clientId" ON "compliance_analyses" ("organizationId", "clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_analyses_type_status" ON "compliance_analyses" ("type", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_analyses_createdAt" ON "compliance_analyses" ("createdAt")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_organizationId_clientId" ON "predictions" ("organizationId", "clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_type_status" ON "predictions" ("type", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_predictions_targetDate" ON "predictions" ("targetDate")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_framework_mappings_organizationId" ON "framework_mappings" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_framework_mappings_frameworks" ON "framework_mappings" ("sourceFramework", "targetFramework")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_framework_mappings_status" ON "framework_mappings" ("status")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_remediations_organizationId_clientId" ON "remediations" ("organizationId", "clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_remediations_findingId" ON "remediations" ("findingId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_remediations_priority_status" ON "remediations" ("priority", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_remediations_assignedTo" ON "remediations" ("assignedTo")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_models_type_status" ON "ai_models" ("type", "status")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_ai_training_jobs_modelId" ON "ai_training_jobs" ("modelId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_training_jobs_status" ON "ai_training_jobs" ("status")`
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
      CREATE TRIGGER update_compliance_analyses_updated_at BEFORE UPDATE ON compliance_analyses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_framework_mappings_updated_at BEFORE UPDATE ON framework_mappings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_remediations_updated_at BEFORE UPDATE ON remediations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_ai_training_jobs_updated_at BEFORE UPDATE ON ai_training_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_ai_training_jobs_updated_at ON ai_training_jobs;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_ai_models_updated_at ON ai_models;`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_remediations_updated_at ON remediations;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_framework_mappings_updated_at ON framework_mappings;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_compliance_analyses_updated_at ON compliance_analyses;`
    );

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex('ai_training_jobs', 'IDX_ai_training_jobs_status');
    await queryRunner.dropIndex('ai_training_jobs', 'IDX_ai_training_jobs_modelId');
    await queryRunner.dropIndex('ai_models', 'IDX_ai_models_type_status');
    await queryRunner.dropIndex('remediations', 'IDX_remediations_assignedTo');
    await queryRunner.dropIndex('remediations', 'IDX_remediations_priority_status');
    await queryRunner.dropIndex('remediations', 'IDX_remediations_findingId');
    await queryRunner.dropIndex('remediations', 'IDX_remediations_organizationId_clientId');
    await queryRunner.dropIndex('framework_mappings', 'IDX_framework_mappings_status');
    await queryRunner.dropIndex('framework_mappings', 'IDX_framework_mappings_frameworks');
    await queryRunner.dropIndex('framework_mappings', 'IDX_framework_mappings_organizationId');
    await queryRunner.dropIndex('predictions', 'IDX_predictions_targetDate');
    await queryRunner.dropIndex('predictions', 'IDX_predictions_type_status');
    await queryRunner.dropIndex('predictions', 'IDX_predictions_organizationId_clientId');
    await queryRunner.dropIndex('compliance_analyses', 'IDX_compliance_analyses_createdAt');
    await queryRunner.dropIndex('compliance_analyses', 'IDX_compliance_analyses_type_status');
    await queryRunner.dropIndex(
      'compliance_analyses',
      'IDX_compliance_analyses_organizationId_clientId'
    );

    // Drop tables
    await queryRunner.dropTable('ai_training_jobs');
    await queryRunner.dropTable('ai_models');
    await queryRunner.dropTable('remediations');
    await queryRunner.dropTable('framework_mappings');
    await queryRunner.dropTable('predictions');
    await queryRunner.dropTable('compliance_analyses');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "model_status";`);
    await queryRunner.query(`DROP TYPE "remediation_status";`);
    await queryRunner.query(`DROP TYPE "remediation_priority";`);
    await queryRunner.query(`DROP TYPE "mapping_status";`);
    await queryRunner.query(`DROP TYPE "prediction_status";`);
    await queryRunner.query(`DROP TYPE "prediction_type";`);
    await queryRunner.query(`DROP TYPE "analysis_status";`);
    await queryRunner.query(`DROP TYPE "analysis_type";`);
  }
}
