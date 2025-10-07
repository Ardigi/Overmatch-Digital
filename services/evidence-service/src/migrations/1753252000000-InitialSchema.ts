import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class InitialSchema1753252000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums
    await queryRunner.query(`
      CREATE TYPE evidence_type AS ENUM (
        'document', 'screenshot', 'log_file', 'configuration', 'report',
        'attestation', 'system_export', 'api_response', 'database_query',
        'interview', 'observation', 'policy', 'procedure', 'diagram',
        'video', 'code_snippet', 'security_scan', 'audit_log', 'other'
      );
      
      CREATE TYPE evidence_status AS ENUM (
        'draft', 'pending_collection', 'collecting', 'collected',
        'pending_review', 'under_review', 'approved', 'rejected',
        'needs_update', 'archived', 'expired'
      );
      
      CREATE TYPE evidence_source AS ENUM (
        'manual_upload', 'api_integration', 'automated_collection',
        'system_generated', 'third_party', 'auditor_provided', 'client_provided'
      );
      
      CREATE TYPE confidentiality_level AS ENUM (
        'public', 'internal', 'confidential', 'highly_confidential', 'restricted'
      );
      
      CREATE TYPE request_status AS ENUM (
        'draft', 'sent', 'acknowledged', 'in_progress',
        'partially_complete', 'complete', 'overdue', 'cancelled'
      );
      
      CREATE TYPE request_priority AS ENUM (
        'low', 'medium', 'high', 'critical'
      );
      
      CREATE TYPE request_type AS ENUM (
        'initial', 'follow_up', 'clarification', 'additional',
        'remediation', 'periodic', 'ad_hoc'
      );
    `);

    // Create evidence table
    await queryRunner.createTable(
      new Table({
        name: 'evidence',
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
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'evidence_type',
          },
          {
            name: 'status',
            type: 'evidence_status',
            default: "'draft'",
          },
          {
            name: 'source',
            type: 'evidence_source',
          },
          {
            name: 'confidentialityLevel',
            type: 'confidentiality_level',
            default: "'internal'",
          },
          {
            name: 'clientId',
            type: 'uuid',
          },
          {
            name: 'auditId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'controlId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'requestId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'collectorId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'collectorType',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'storageUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'storageProvider',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'storagePath',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'thumbnailUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'previewUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'collectionDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'effectiveDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expirationDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'reviewedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'approvedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'collectedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'uuid',
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
            name: 'validatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'validatedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'validationComments',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'qualityScore',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'validationResults',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'reviewComments',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'complianceMapping',
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
            name: 'version',
            type: 'int',
            default: 1,
          },
          {
            name: 'parentEvidenceId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isLatestVersion',
            type: 'boolean',
            default: true,
          },
          {
            name: 'versionHistory',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'accessControl',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'encryptionKey',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isEncrypted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isSensitive',
            type: 'boolean',
            default: false,
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
            name: 'lastAccessedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'usageMetrics',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'auditTrail',
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
          {
            name: 'deletedAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create evidence_requests table
    await queryRunner.createTable(
      new Table({
        name: 'evidence_requests',
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
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'request_type',
            default: "'initial'",
          },
          {
            name: 'status',
            type: 'request_status',
            default: "'draft'",
          },
          {
            name: 'priority',
            type: 'request_priority',
            default: "'medium'",
          },
          {
            name: 'clientId',
            type: 'uuid',
          },
          {
            name: 'auditId',
            type: 'uuid',
          },
          {
            name: 'parentRequestId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'requestedItems',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'templates',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'requestedBy',
            type: 'uuid',
          },
          {
            name: 'requestedByName',
            type: 'varchar',
          },
          {
            name: 'requestedByEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'requestedFrom',
            type: 'uuid',
          },
          {
            name: 'requestedFromName',
            type: 'varchar',
          },
          {
            name: 'requestedFromEmail',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'ccRecipients',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'assignedTo',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'dueDate',
            type: 'timestamptz',
          },
          {
            name: 'sentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'acknowledgedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'completedDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'cancelledDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'communications',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'reminders',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'completionPercentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'progressHistory',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'complianceContext',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'settings',
            type: 'jsonb',
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

    // Create evidence_templates table
    await queryRunner.createTable(
      new Table({
        name: 'evidence_templates',
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
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
          },
          {
            name: 'type',
            type: 'evidence_type',
          },
          {
            name: 'frameworks',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'controls',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'templateContent',
            type: 'jsonb',
          },
          {
            name: 'sampleData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'instructions',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'acceptedFormats',
            type: 'text[]',
            isNullable: true,
          },
          {
            name: 'requiredFields',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'validationRules',
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
            type: 'varchar',
            default: "'1.0'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
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
      }),
      true
    );

    // Create validation_rules table
    await queryRunner.createTable(
      new Table({
        name: 'validation_rules',
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
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'evidenceTypes',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          {
            name: 'condition',
            type: 'jsonb',
          },
          {
            name: 'action',
            type: 'jsonb',
          },
          {
            name: 'severity',
            type: 'varchar',
            default: "'medium'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'frameworks',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'controls',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'customScript',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'int',
            default: 1,
          },
          {
            name: 'organizationId',
            type: 'uuid',
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
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_client_status" ON "evidence" ("clientId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_audit_control" ON "evidence" ("auditId", "controlId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_type_status" ON "evidence" ("type", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_collection_date" ON "evidence" ("collectionDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_expiration_date" ON "evidence" ("expirationDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_evidence_deleted_at" ON "evidence" ("deletedAt") WHERE "deletedAt" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requests_client_status" ON "evidence_requests" ("clientId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requests_audit_status" ON "evidence_requests" ("auditId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requests_due_date" ON "evidence_requests" ("dueDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requests_requested_from" ON "evidence_requests" ("requestedFrom")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_templates_category" ON "evidence_templates" ("category")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_templates_type" ON "evidence_templates" ("type")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_templates_active" ON "evidence_templates" ("isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_validation_rules_type" ON "validation_rules" ("type")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_validation_rules_active" ON "validation_rules" ("isActive")`
    );

    // Create update trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_evidence_updated_at 
        BEFORE UPDATE ON evidence
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_evidence_requests_updated_at 
        BEFORE UPDATE ON evidence_requests
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_evidence_templates_updated_at 
        BEFORE UPDATE ON evidence_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_validation_rules_updated_at 
        BEFORE UPDATE ON validation_rules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS update_validation_rules_updated_at ON validation_rules;
      DROP TRIGGER IF EXISTS update_evidence_templates_updated_at ON evidence_templates;
      DROP TRIGGER IF EXISTS update_evidence_requests_updated_at ON evidence_requests;
      DROP TRIGGER IF EXISTS update_evidence_updated_at ON evidence;
      DROP FUNCTION IF EXISTS update_updated_at_column;
    `);

    // Drop tables
    await queryRunner.dropTable('validation_rules');
    await queryRunner.dropTable('evidence_templates');
    await queryRunner.dropTable('evidence_requests');
    await queryRunner.dropTable('evidence');

    // Drop enums
    await queryRunner.query(`
      DROP TYPE IF EXISTS request_type;
      DROP TYPE IF EXISTS request_priority;
      DROP TYPE IF EXISTS request_status;
      DROP TYPE IF EXISTS confidentiality_level;
      DROP TYPE IF EXISTS evidence_source;
      DROP TYPE IF EXISTS evidence_status;
      DROP TYPE IF EXISTS evidence_type;
    `);
  }
}
