import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class InitialSchema1753250000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums
    await queryRunner.query(`
      CREATE TYPE policy_type AS ENUM (
        'security', 'privacy', 'access_control', 'data_governance',
        'incident_response', 'business_continuity', 'compliance',
        'operational', 'administrative', 'technical', 'physical', 'custom'
      );
      
      CREATE TYPE policy_status AS ENUM (
        'draft', 'pending_review', 'under_review', 'approved',
        'published', 'effective', 'suspended', 'retired', 'superseded'
      );
      
      CREATE TYPE workflow_state AS ENUM (
        'draft', 'submitted', 'in_review', 'changes_requested',
        'approved', 'rejected', 'published', 'archived'
      );
      
      CREATE TYPE policy_priority AS ENUM (
        'critical', 'high', 'medium', 'low'
      );
      
      CREATE TYPE policy_scope AS ENUM (
        'global', 'organization', 'department', 'team',
        'system', 'process', 'role'
      );
      
      CREATE TYPE control_priority AS ENUM (
        'critical', 'high', 'medium', 'low'
      );
      
      CREATE TYPE control_category AS ENUM (
        'preventive', 'detective', 'corrective', 'compensating',
        'administrative', 'technical', 'physical'
      );
      
      CREATE TYPE implementation_status AS ENUM (
        'not_started', 'in_progress', 'partial', 'implemented', 'not_applicable'
      );
      
      CREATE TYPE evidence_status AS ENUM (
        'pending_collection', 'pending_review', 'under_review',
        'approved', 'rejected', 'expired'
      );
      
      CREATE TYPE framework_type AS ENUM (
        'regulatory', 'standard', 'best_practice', 'custom'
      );
      
      CREATE TYPE framework_status AS ENUM (
        'active', 'draft', 'deprecated', 'archived'
      );
      
      CREATE TYPE risk_category AS ENUM (
        'strategic', 'operational', 'financial', 'compliance',
        'reputational', 'security', 'privacy', 'technology',
        'third_party', 'environmental', 'legal', 'project'
      );
      
      CREATE TYPE risk_status AS ENUM (
        'identified', 'assessed', 'accepted', 'mitigated',
        'transferred', 'avoided', 'monitoring', 'closed', 'escalated'
      );
      
      CREATE TYPE risk_level AS ENUM (
        'low', 'medium', 'high', 'critical'
      );
      
      CREATE TYPE risk_treatment AS ENUM (
        'accept', 'mitigate', 'transfer', 'avoid'
      );
    `);

    // Create compliance_frameworks table
    await queryRunner.createTable(
      new Table({
        name: 'compliance_frameworks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'frameworkId',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'version',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'framework_type',
          },
          {
            name: 'status',
            type: 'framework_status',
            default: "'active'",
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'mappings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'keywords',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'isCustom',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isPublic',
            type: 'boolean',
            default: true,
          },
          {
            name: 'controlCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'implementedControlCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'implementationPercentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'statistics',
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
            name: 'archivedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create compliance_controls table
    await queryRunner.createTable(
      new Table({
        name: 'compliance_controls',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'controlId',
            type: 'varchar',
          },
          {
            name: 'frameworkId',
            type: 'uuid',
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
            name: 'category',
            type: 'control_category',
          },
          {
            name: 'priority',
            type: 'control_priority',
            default: "'medium'",
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'requirements',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'objective',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'rationale',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testingGuidance',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'implementationStatus',
            type: 'implementation_status',
            default: "'not_started'",
          },
          {
            name: 'implementationScore',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'implementationNotes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'implementationDetails',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'gaps',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'evidence',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'relatedPolicies',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'crossFrameworkMappings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'compensatingControls',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'dependencies',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'lastAssessmentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'nextAssessmentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'assessmentHistory',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'riskAssessment',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isAutomated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'automationConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'keywords',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'customFields',
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
            name: 'FK_controls_framework',
            columnNames: ['frameworkId'],
            referencedTableName: 'compliance_frameworks',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create policies table
    await queryRunner.createTable(
      new Table({
        name: 'policies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'policyNumber',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'version',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'purpose',
            type: 'text',
          },
          {
            name: 'type',
            type: 'policy_type',
          },
          {
            name: 'status',
            type: 'policy_status',
            default: "'draft'",
          },
          {
            name: 'priority',
            type: 'policy_priority',
            default: "'medium'",
          },
          {
            name: 'scope',
            type: 'policy_scope',
            default: "'organization'",
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'ownerId',
            type: 'uuid',
          },
          {
            name: 'ownerName',
            type: 'varchar',
          },
          {
            name: 'ownerEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'ownerDepartment',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'delegateOwnerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'stakeholders',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'content',
            type: 'jsonb',
          },
          {
            name: 'requirements',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'exceptions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'complianceMapping',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'relatedPolicies',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'supersededPolicies',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'implementation',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'effectiveDate',
            type: 'timestamptz',
          },
          {
            name: 'expirationDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'nextReviewDate',
            type: 'timestamptz',
          },
          {
            name: 'lastReviewDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'approvalDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'publishedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'reviewCycle',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'approvalWorkflow',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'riskAssessment',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'impactAnalysis',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'viewCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'downloadCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'complianceScore',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'adoptionRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'metrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'workflowState',
            type: 'workflow_state',
            default: "'draft'",
          },
          {
            name: 'regoPolicy',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'opaMetadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'isEvaluatable',
            type: 'boolean',
            default: false,
          },
          {
            name: 'evaluationError',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'lastEvaluated',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'lastComplianceCheck',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'evaluationHistory',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'automationRules',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'policyAsCode',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'policyAsCodeLanguage',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'integrations',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'templates',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'keywords',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'changeHistory',
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
            name: 'archivedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create risks table
    await queryRunner.createTable(
      new Table({
        name: 'risks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'riskId',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'category',
            type: 'risk_category',
          },
          {
            name: 'status',
            type: 'risk_status',
            default: "'identified'",
          },
          {
            name: 'organizationId',
            type: 'uuid',
          },
          {
            name: 'ownerId',
            type: 'uuid',
          },
          {
            name: 'ownerName',
            type: 'varchar',
          },
          {
            name: 'ownerEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'ownerDepartment',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'stakeholders',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'assessment',
            type: 'jsonb',
          },
          {
            name: 'details',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'impactAnalysis',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'treatment',
            type: 'risk_treatment',
            isNullable: true,
          },
          {
            name: 'treatmentPlan',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'monitoring',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'incidents',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'incidentCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastIncidentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'mitigationMeasures',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'mitigationEffectiveness',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'reporting',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'attachments',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'references',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'auditTrail',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'identifiedDate',
            type: 'timestamptz',
          },
          {
            name: 'assessmentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'treatmentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'closedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'closureReason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'nextReviewDate',
            type: 'timestamptz',
          },
          {
            name: 'tags',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'keywords',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'version',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdBy',
            type: 'uuid',
          },
          {
            name: 'updatedBy',
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

    // Create junction tables
    await queryRunner.createTable(
      new Table({
        name: 'policy_control_mapping',
        columns: [
          {
            name: 'policyId',
            type: 'uuid',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_policy_control_mapping_policy',
            columnNames: ['policyId'],
            referencedTableName: 'policies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_policy_control_mapping_control',
            columnNames: ['controlId'],
            referencedTableName: 'compliance_controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: 'risk_controls',
        columns: [
          {
            name: 'riskId',
            type: 'uuid',
          },
          {
            name: 'controlId',
            type: 'uuid',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_risk_controls_risk',
            columnNames: ['riskId'],
            referencedTableName: 'risks',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'FK_risk_controls_control',
            columnNames: ['controlId'],
            referencedTableName: 'compliance_controls',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_frameworks_org_status" ON "compliance_frameworks" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_frameworks_type_status" ON "compliance_frameworks" ("type", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_controls_framework_control" ON "compliance_controls" ("frameworkId", "controlId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_controls_org_status" ON "compliance_controls" ("organizationId", "implementationStatus")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_controls_category_priority" ON "compliance_controls" ("category", "priority")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_org_status" ON "policies" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_type_status" ON "policies" ("type", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_effective_date" ON "policies" ("effectiveDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_policies_next_review" ON "policies" ("nextReviewDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risks_org_status" ON "risks" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_risks_category_status" ON "risks" ("category", "status")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_risks_owner" ON "risks" ("ownerId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_policy_control_mapping" ON "policy_control_mapping" ("policyId", "controlId")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_risk_controls" ON "risk_controls" ("riskId", "controlId")`
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

      CREATE TRIGGER update_compliance_frameworks_updated_at 
        BEFORE UPDATE ON compliance_frameworks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_compliance_controls_updated_at 
        BEFORE UPDATE ON compliance_controls
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_policies_updated_at 
        BEFORE UPDATE ON policies
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_risks_updated_at 
        BEFORE UPDATE ON risks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_risks_updated_at ON risks;
      DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
      DROP TRIGGER IF EXISTS update_compliance_controls_updated_at ON compliance_controls;
      DROP TRIGGER IF EXISTS update_compliance_frameworks_updated_at ON compliance_frameworks;
      DROP FUNCTION IF EXISTS update_updated_at_column;
    `);

    // Drop tables
    await queryRunner.dropTable('risk_controls');
    await queryRunner.dropTable('policy_control_mapping');
    await queryRunner.dropTable('risks');
    await queryRunner.dropTable('policies');
    await queryRunner.dropTable('compliance_controls');
    await queryRunner.dropTable('compliance_frameworks');

    // Drop enums
    await queryRunner.query(`
      DROP TYPE IF EXISTS risk_treatment;
      DROP TYPE IF EXISTS risk_level;
      DROP TYPE IF EXISTS risk_status;
      DROP TYPE IF EXISTS risk_category;
      DROP TYPE IF EXISTS framework_status;
      DROP TYPE IF EXISTS framework_type;
      DROP TYPE IF EXISTS evidence_status;
      DROP TYPE IF EXISTS implementation_status;
      DROP TYPE IF EXISTS control_category;
      DROP TYPE IF EXISTS control_priority;
      DROP TYPE IF EXISTS policy_scope;
      DROP TYPE IF EXISTS policy_priority;
      DROP TYPE IF EXISTS workflow_state;
      DROP TYPE IF EXISTS policy_status;
      DROP TYPE IF EXISTS policy_type;
    `);
  }
}
