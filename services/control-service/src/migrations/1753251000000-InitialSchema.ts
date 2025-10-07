import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class InitialSchema1753251000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums
    await queryRunner.query(`
      CREATE TYPE control_type AS ENUM (
        'PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'COMPENSATING'
      );
      
      CREATE TYPE control_category AS ENUM (
        'ACCESS_CONTROL', 'AUTHENTICATION', 'AUTHORIZATION', 'DATA_PROTECTION',
        'ENCRYPTION', 'MONITORING', 'INCIDENT_RESPONSE', 'BUSINESS_CONTINUITY',
        'PHYSICAL_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY',
        'VENDOR_MANAGEMENT', 'AUDIT_ACCOUNTABILITY'
      );
      
      CREATE TYPE control_frequency AS ENUM (
        'CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY',
        'SEMI_ANNUAL', 'ANNUAL', 'ON_DEMAND'
      );
      
      CREATE TYPE control_status AS ENUM (
        'ACTIVE', 'INACTIVE', 'UNDER_REVIEW', 'DEPRECATED', 'RETIRED'
      );
      
      CREATE TYPE implementation_status AS ENUM (
        'NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED',
        'PARTIALLY_IMPLEMENTED', 'NOT_APPLICABLE'
      );
      
      CREATE TYPE exception_status AS ENUM (
        'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'
      );
      
      CREATE TYPE assessment_result AS ENUM (
        'EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE', 'NOT_TESTED'
      );
      
      CREATE TYPE test_result AS ENUM (
        'PASS', 'FAIL', 'PARTIAL', 'NOT_APPLICABLE', 'ERROR'
      );
      
      CREATE TYPE test_status AS ENUM (
        'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'
      );
    `);

    // Create controls table
    await queryRunner.createTable(
      new Table({
        name: 'controls',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'code',
            type: 'varchar',
            length: '50',
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
          },
          {
            name: 'objective',
            type: 'text',
          },
          {
            name: 'requirements',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'control_type',
          },
          {
            name: 'category',
            type: 'control_category',
          },
          {
            name: 'frequency',
            type: 'control_frequency',
            default: "'QUARTERLY'",
          },
          {
            name: 'status',
            type: 'control_status',
            default: "'ACTIVE'",
          },
          {
            name: 'frameworks',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'implementationGuidance',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testProcedures',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'evidenceRequirements',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'metrics',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'automationCapable',
            type: 'boolean',
            default: false,
          },
          {
            name: 'automationImplemented',
            type: 'boolean',
            default: false,
          },
          {
            name: 'automationDetails',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'automationConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'relatedControls',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'compensatingControls',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'tags',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'ownerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'riskRating',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'costOfImplementation',
            type: 'decimal',
            isNullable: true,
          },
          {
            name: 'costOfTesting',
            type: 'decimal',
            isNullable: true,
          },
          {
            name: 'regulatoryRequirement',
            type: 'boolean',
            default: false,
          },
          {
            name: 'dataClassification',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'businessProcesses',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'systemComponents',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'riskFactors',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'stakeholders',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'customFields',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
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

    // Create control_implementations table
    await queryRunner.createTable(
      new Table({
        name: 'control_implementations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'implementation_status',
            default: "'NOT_STARTED'",
          },
          {
            name: 'implementationDescription',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'implementationDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'plannedDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'implementedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'maturityLevel',
            type: 'varchar',
            default: "'INITIAL'",
          },
          {
            name: 'configuration',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'responsibleParty',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'evidence',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'effectivenessScore',
            type: 'integer',
            default: 100,
          },
          {
            name: 'lastAssessmentDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'nextReviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'gaps',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'compensatingControls',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'isTemporary',
            type: 'boolean',
            default: false,
          },
          {
            name: 'expiryDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'lastReviewDate',
            type: 'timestamp',
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
            name: 'FK_implementation_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create control_test_results table
    await queryRunner.createTable(
      new Table({
        name: 'control_test_results',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'testName',
            type: 'varchar',
          },
          {
            name: 'testType',
            type: 'varchar',
          },
          {
            name: 'testDate',
            type: 'date',
          },
          {
            name: 'testedBy',
            type: 'uuid',
          },
          {
            name: 'result',
            type: 'test_result',
            default: "'NOT_APPLICABLE'",
          },
          {
            name: 'score',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'details',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'evidence',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'sampleSize',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'populationSize',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'exceptionsFound',
            type: 'integer',
            default: 0,
          },
          {
            name: 'findings',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'recommendations',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'retestRequired',
            type: 'boolean',
            default: false,
          },
          {
            name: 'retestDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvalDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'duration',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'automated',
            type: 'boolean',
            default: false,
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
            name: 'FK_test_result_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create control_exceptions table
    await queryRunner.createTable(
      new Table({
        name: 'control_exceptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'exception_status',
            default: "'PENDING'",
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'justification',
            type: 'text',
          },
          {
            name: 'requestedBy',
            type: 'uuid',
          },
          {
            name: 'requestDate',
            type: 'date',
          },
          {
            name: 'riskAssessment',
            type: 'jsonb',
            default: "'{}'::jsonb",
          },
          {
            name: 'compensatingControls',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'startDate',
            type: 'date',
          },
          {
            name: 'endDate',
            type: 'date',
          },
          {
            name: 'approvers',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'currentApprover',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvalComments',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'conditions',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'reviewFrequency',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'lastReviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'nextReviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'jsonb',
            default: "'[]'::jsonb",
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
            name: 'FK_exception_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create control_assessments table
    await queryRunner.createTable(
      new Table({
        name: 'control_assessments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'assessmentDate',
            type: 'date',
          },
          {
            name: 'assessedBy',
            type: 'uuid',
          },
          {
            name: 'assessmentType',
            type: 'varchar',
          },
          {
            name: 'result',
            type: 'assessment_result',
            default: "'NOT_TESTED'",
          },
          {
            name: 'effectivenessScore',
            type: 'integer',
          },
          {
            name: 'maturityLevel',
            type: 'integer',
          },
          {
            name: 'findings',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'gaps',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'recommendations',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'evidenceReviewed',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'remediationRequired',
            type: 'boolean',
            default: false,
          },
          {
            name: 'remediationPlan',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'followUpDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'jsonb',
            default: "'[]'::jsonb",
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
            name: 'FK_assessment_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create control_mappings table
    await queryRunner.createTable(
      new Table({
        name: 'control_mappings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'frameworkName',
            type: 'varchar',
          },
          {
            name: 'frameworkVersion',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'section',
            type: 'varchar',
          },
          {
            name: 'requirement',
            type: 'text',
          },
          {
            name: 'mappingType',
            type: 'varchar',
            default: "'direct'",
          },
          {
            name: 'mappingStrength',
            type: 'integer',
            default: 100,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'validatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'validationDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
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
            name: 'FK_mapping_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create control_tests table
    await queryRunner.createTable(
      new Table({
        name: 'control_tests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testType',
            type: 'varchar',
          },
          {
            name: 'frequency',
            type: 'control_frequency',
            default: "'QUARTERLY'",
          },
          {
            name: 'testProcedures',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'sampleSelectionMethod',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'minimumSampleSize',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'expectedEvidence',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'automationCapable',
            type: 'boolean',
            default: false,
          },
          {
            name: 'automationConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'assignedTo',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'lastTestDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'nextTestDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'test_status',
            default: "'SCHEDULED'",
          },
          {
            name: 'priority',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'estimatedDuration',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
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
        foreignKeys: [
          {
            name: 'FK_control_test_control',
            columnNames: ['controlId'],
            referencedTableName: 'controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_controls_code" ON "controls" ("code")`);
    await queryRunner.query(`CREATE INDEX "IDX_controls_org" ON "controls" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_controls_status" ON "controls" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_controls_category" ON "controls" ("category")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_implementations_control_org" ON "control_implementations" ("controlId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_implementations_status" ON "control_implementations" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_results_control_org" ON "control_test_results" ("controlId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_test_results_date" ON "control_test_results" ("testDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_exceptions_control_org" ON "control_exceptions" ("controlId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_exceptions_status" ON "control_exceptions" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assessments_control_org" ON "control_assessments" ("controlId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assessments_date" ON "control_assessments" ("assessmentDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mappings_control" ON "control_mappings" ("controlId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mappings_framework" ON "control_mappings" ("frameworkName")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_control_tests_control" ON "control_tests" ("controlId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_control_tests_next_date" ON "control_tests" ("nextTestDate")`
    );

    // Create update trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updatedAt = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_controls_updated_at 
        BEFORE UPDATE ON controls
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_implementations_updated_at 
        BEFORE UPDATE ON control_implementations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_test_results_updated_at 
        BEFORE UPDATE ON control_test_results
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_exceptions_updated_at 
        BEFORE UPDATE ON control_exceptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_assessments_updated_at 
        BEFORE UPDATE ON control_assessments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_mappings_updated_at 
        BEFORE UPDATE ON control_mappings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_control_tests_updated_at 
        BEFORE UPDATE ON control_tests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_control_tests_updated_at ON control_tests;
      DROP TRIGGER IF EXISTS update_control_mappings_updated_at ON control_mappings;
      DROP TRIGGER IF EXISTS update_control_assessments_updated_at ON control_assessments;
      DROP TRIGGER IF EXISTS update_control_exceptions_updated_at ON control_exceptions;
      DROP TRIGGER IF EXISTS update_control_test_results_updated_at ON control_test_results;
      DROP TRIGGER IF EXISTS update_control_implementations_updated_at ON control_implementations;
      DROP TRIGGER IF EXISTS update_controls_updated_at ON controls;
      DROP FUNCTION IF EXISTS update_updated_at_column;
    `);

    // Drop tables
    await queryRunner.dropTable('control_tests');
    await queryRunner.dropTable('control_mappings');
    await queryRunner.dropTable('control_assessments');
    await queryRunner.dropTable('control_exceptions');
    await queryRunner.dropTable('control_test_results');
    await queryRunner.dropTable('control_implementations');
    await queryRunner.dropTable('controls');

    // Drop enums
    await queryRunner.query(`
      DROP TYPE IF EXISTS test_status;
      DROP TYPE IF EXISTS test_result;
      DROP TYPE IF EXISTS assessment_result;
      DROP TYPE IF EXISTS exception_status;
      DROP TYPE IF EXISTS implementation_status;
      DROP TYPE IF EXISTS control_status;
      DROP TYPE IF EXISTS control_frequency;
      DROP TYPE IF EXISTS control_category;
      DROP TYPE IF EXISTS control_type;
    `);
  }
}
