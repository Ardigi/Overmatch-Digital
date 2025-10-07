import { Index, type MigrationInterface, type QueryRunner, Table } from 'typeorm';

export class CreateAuditTables1706202000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "audit_type" AS ENUM ('SOC1_TYPE1', 'SOC1_TYPE2', 'SOC2_TYPE1', 'SOC2_TYPE2', 'SOC3', 'SOCPS');
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_status" AS ENUM ('PLANNING', 'IN_FIELDWORK', 'REVIEW', 'DRAFT_REPORT', 'FINAL_REVIEW', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
    `);

    await queryRunner.query(`
      CREATE TYPE "audit_phase" AS ENUM ('KICKOFF', 'RISK_ASSESSMENT', 'CONTROL_DESIGN', 'CONTROL_TESTING', 'DEFICIENCY_REMEDIATION', 'REPORT_PREPARATION', 'QUALITY_REVIEW', 'ISSUANCE');
    `);

    await queryRunner.query(`
      CREATE TYPE "finding_severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OBSERVATION');
    `);

    await queryRunner.query(`
      CREATE TYPE "finding_status" AS ENUM ('IDENTIFIED', 'CONFIRMED', 'IN_REMEDIATION', 'REMEDIATED', 'ACCEPTED', 'CLOSED', 'REOPENED');
    `);

    await queryRunner.query(`
      CREATE TYPE "finding_type" AS ENUM ('CONTROL_DEFICIENCY', 'CONTROL_GAP', 'OPERATING_EFFECTIVENESS', 'DESIGN_DEFICIENCY', 'DOCUMENTATION_GAP', 'POLICY_VIOLATION', 'COMPLIANCE_GAP');
    `);

    await queryRunner.query(`
      CREATE TYPE "risk_rating" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    `);

    await queryRunner.query(`
      CREATE TYPE "test_result" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASS', 'FAIL', 'PASS_WITH_EXCEPTION', 'NOT_APPLICABLE');
    `);

    await queryRunner.query(`
      CREATE TYPE "test_method" AS ENUM ('INQUIRY', 'OBSERVATION', 'INSPECTION', 'REPERFORMANCE', 'RECALCULATION', 'CONFIRMATION', 'ANALYTICAL_PROCEDURES');
    `);

    // Create soc_audits table
    await queryRunner.createTable(
      new Table({
        name: 'soc_audits',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'auditNumber',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'clientId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'auditType',
            type: 'audit_type',
          },
          {
            name: 'status',
            type: 'audit_status',
            default: "'PLANNING'",
          },
          {
            name: 'currentPhase',
            type: 'audit_phase',
            default: "'KICKOFF'",
          },
          {
            name: 'auditPeriodStart',
            type: 'date',
          },
          {
            name: 'auditPeriodEnd',
            type: 'date',
          },
          {
            name: 'reportDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'plannedCompletionDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'actualCompletionDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'trustServiceCriteria',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'leadAuditorId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'engagementPartnerId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'auditTeamIds',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'qualityReviewerId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cpaFirmId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'cpaFirmName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'cpaEngagementLetter',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'auditObjectives',
            type: 'text',
          },
          {
            name: 'scopeDescription',
            type: 'text',
          },
          {
            name: 'inScopeServices',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'inScopeLocations',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'outOfScopeItems',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'controlFrameworkId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'totalControls',
            type: 'int',
            default: 0,
          },
          {
            name: 'testedControls',
            type: 'int',
            default: 0,
          },
          {
            name: 'effectiveControls',
            type: 'int',
            default: 0,
          },
          {
            name: 'deficientControls',
            type: 'int',
            default: 0,
          },
          {
            name: 'overallRiskRating',
            type: 'risk_rating',
            default: "'MEDIUM'",
          },
          {
            name: 'riskFactors',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'reportTemplateId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'draftReportUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'finalReportUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'reportIssuedDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'hasQualifiedOpinion',
            type: 'boolean',
            default: false,
          },
          {
            name: 'opinionModifications',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'managementAssertionReceived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'managementAssertionDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'managementAssertionDocument',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'complianceRequirements',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'regulatoryFrameworks',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'completionPercentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalFindings',
            type: 'int',
            default: 0,
          },
          {
            name: 'criticalFindings',
            type: 'int',
            default: 0,
          },
          {
            name: 'majorFindings',
            type: 'int',
            default: 0,
          },
          {
            name: 'minorFindings',
            type: 'int',
            default: 0,
          },
          {
            name: 'remediatedFindings',
            type: 'int',
            default: 0,
          },
          {
            name: 'budgetedHours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'actualHours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'budgetedCost',
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
            default: 0,
          },
          {
            name: 'clientMeetingsHeld',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastClientCommunication',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'nextScheduledMeeting',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'peerReviewCompleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'peerReviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'peerReviewComments',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'qualityReviewPassed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'qualityReviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'isArchived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'archiveDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'archiveLocation',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'customFields',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'notes',
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
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '255',
          },
        ],
      }),
      true
    );

    // Create audit_findings table
    await queryRunner.createTable(
      new Table({
        name: 'audit_findings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'findingNumber',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'auditId',
            type: 'uuid',
          },
          {
            name: 'controlId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'controlCode',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'controlName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'findingType',
            type: 'finding_type',
          },
          {
            name: 'severity',
            type: 'finding_severity',
          },
          {
            name: 'status',
            type: 'finding_status',
            default: "'IDENTIFIED'",
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
            name: 'condition',
            type: 'text',
          },
          {
            name: 'criteria',
            type: 'text',
          },
          {
            name: 'cause',
            type: 'text',
          },
          {
            name: 'effect',
            type: 'text',
          },
          {
            name: 'recommendation',
            type: 'text',
          },
          {
            name: 'riskRating',
            type: 'risk_rating',
            default: "'MEDIUM'",
          },
          {
            name: 'affectedTrustServiceCriteria',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'businessImpact',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isSystematic',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isPervasive',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isCompensatingControlsExist',
            type: 'boolean',
            default: false,
          },
          {
            name: 'managementResponse',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'managementResponseBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'managementResponseDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'targetRemediationDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'remediationOwner',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'remediationPlan',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'evidenceIds',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'testingProcedures',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testingDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'testedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'sampleSize',
            type: 'int',
            default: 0,
          },
          {
            name: 'exceptionsFound',
            type: 'int',
            default: 0,
          },
          {
            name: 'remediationStartDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'remediationCompleteDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'remediationEvidence',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'remediationValidatedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'remediationValidationDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'requiresRetest',
            type: 'boolean',
            default: false,
          },
          {
            name: 'retestDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'retestResults',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'relatedFindingIds',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'rootCauseFindingId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isPriorYearFinding',
            type: 'boolean',
            default: false,
          },
          {
            name: 'priorYearFindingId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'isRecurring',
            type: 'boolean',
            default: false,
          },
          {
            name: 'occurrenceCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'includeInReport',
            type: 'boolean',
            default: true,
          },
          {
            name: 'reportNarrative',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reportSection',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'reportOrder',
            type: 'int',
            default: 0,
          },
          {
            name: 'assignedTo',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'approvalDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'communicatedToClient',
            type: 'boolean',
            default: false,
          },
          {
            name: 'clientCommunicationDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'clientFeedback',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'customFields',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'notes',
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
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '255',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['auditId'],
            referencedTableName: 'soc_audits',
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
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'auditId',
            type: 'uuid',
          },
          {
            name: 'controlId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'controlCode',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'controlName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'testPeriodStart',
            type: 'date',
          },
          {
            name: 'testPeriodEnd',
            type: 'date',
          },
          {
            name: 'testMethod',
            type: 'test_method[]',
            default: "'{}'",
          },
          {
            name: 'populationSize',
            type: 'int',
            default: 0,
          },
          {
            name: 'sampleSize',
            type: 'int',
            default: 0,
          },
          {
            name: 'samplingMethod',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'testResult',
            type: 'test_result',
            default: "'NOT_STARTED'",
          },
          {
            name: 'exceptionsFound',
            type: 'int',
            default: 0,
          },
          {
            name: 'deviationRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'testProcedures',
            type: 'text',
          },
          {
            name: 'testObjective',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'testCompleteDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'testedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reviewDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'evidenceIds',
            type: 'text[]',
            default: "'{}'",
          },
          {
            name: 'workpaperReference',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'testAttributes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'testConclusion',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'exceptionsDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isKeyControl',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isITGC',
            type: 'boolean',
            default: false,
          },
          {
            name: 'requiresRetest',
            type: 'boolean',
            default: false,
          },
          {
            name: 'retestDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'retestResult',
            type: 'test_result',
            isNullable: true,
          },
          {
            name: 'notes',
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
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '255',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['auditId'],
            referencedTableName: 'soc_audits',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create audit_programs table
    await queryRunner.createTable(
      new Table({
        name: 'audit_programs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'auditId',
            type: 'uuid',
          },
          {
            name: 'programName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            default: "'1.0'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'approvedBy',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'approvalDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'sections',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'milestones',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'riskAssessment',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'testingStrategy',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'timeline',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'resources',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'budgetHours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'customFields',
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
          {
            name: 'createdBy',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '255',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['auditId'],
            referencedTableName: 'soc_audits',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create audit_sessions table (for audit trail)
    await queryRunner.createTable(
      new Table({
        name: 'audit_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'userEmail',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'userName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            length: '255',
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
            name: 'startTime',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'endTime',
            type: 'timestamp',
            isNullable: true,
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
        ],
      }),
      true
    );

    // Create audit_entries table (for audit trail)
    await queryRunner.createTable(
      new Table({
        name: 'audit_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'entityId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'method',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'endpoint',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'statusCode',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'changes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'oldValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'newValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['sessionId'],
            referencedTableName: 'audit_sessions',
            referencedColumnNames: ['sessionId'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Create indices
    await queryRunner.query(`CREATE INDEX "idx_audit_client" ON "soc_audits" ("clientId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_status" ON "soc_audits" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_dates" ON "soc_audits" ("auditPeriodStart", "auditPeriodEnd")`
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_number" ON "soc_audits" ("auditNumber")`);
    await queryRunner.query(`CREATE INDEX "idx_finding_audit" ON "audit_findings" ("auditId")`);
    await queryRunner.query(`CREATE INDEX "idx_finding_control" ON "audit_findings" ("controlId")`);
    await queryRunner.query(`CREATE INDEX "idx_finding_status" ON "audit_findings" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_finding_severity" ON "audit_findings" ("severity")`);
    await queryRunner.query(`CREATE INDEX "idx_control_test_audit" ON "control_tests" ("auditId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_control_test_control" ON "control_tests" ("controlId")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_control_test_result" ON "control_tests" ("testResult")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_program_audit" ON "audit_programs" ("auditId")`
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_session_user" ON "audit_sessions" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_session_org" ON "audit_sessions" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_session_time" ON "audit_sessions" ("startTime")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_entry_session" ON "audit_entries" ("sessionId")`
    );
    await queryRunner.query(`CREATE INDEX "idx_audit_entry_user" ON "audit_entries" ("userId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_entry_entity" ON "audit_entries" ("entityType", "entityId")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_entry_timestamp" ON "audit_entries" ("timestamp")`
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
      CREATE TRIGGER update_soc_audits_updated_at BEFORE UPDATE ON soc_audits
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_audit_findings_updated_at BEFORE UPDATE ON audit_findings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_control_tests_updated_at BEFORE UPDATE ON control_tests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_audit_programs_updated_at BEFORE UPDATE ON audit_programs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_audit_programs_updated_at ON audit_programs;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_control_tests_updated_at ON control_tests;`
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_audit_findings_updated_at ON audit_findings;`
    );
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_soc_audits_updated_at ON soc_audits;`);

    // Drop function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column;`);

    // Drop indices
    await queryRunner.dropIndex('audit_entries', 'idx_audit_entry_timestamp');
    await queryRunner.dropIndex('audit_entries', 'idx_audit_entry_entity');
    await queryRunner.dropIndex('audit_entries', 'idx_audit_entry_user');
    await queryRunner.dropIndex('audit_entries', 'idx_audit_entry_session');
    await queryRunner.dropIndex('audit_sessions', 'idx_audit_session_time');
    await queryRunner.dropIndex('audit_sessions', 'idx_audit_session_org');
    await queryRunner.dropIndex('audit_sessions', 'idx_audit_session_user');
    await queryRunner.dropIndex('audit_programs', 'idx_audit_program_audit');
    await queryRunner.dropIndex('control_tests', 'idx_control_test_result');
    await queryRunner.dropIndex('control_tests', 'idx_control_test_control');
    await queryRunner.dropIndex('control_tests', 'idx_control_test_audit');
    await queryRunner.dropIndex('audit_findings', 'idx_finding_severity');
    await queryRunner.dropIndex('audit_findings', 'idx_finding_status');
    await queryRunner.dropIndex('audit_findings', 'idx_finding_control');
    await queryRunner.dropIndex('audit_findings', 'idx_finding_audit');
    await queryRunner.dropIndex('soc_audits', 'idx_audit_number');
    await queryRunner.dropIndex('soc_audits', 'idx_audit_dates');
    await queryRunner.dropIndex('soc_audits', 'idx_audit_status');
    await queryRunner.dropIndex('soc_audits', 'idx_audit_client');

    // Drop tables
    await queryRunner.dropTable('audit_entries');
    await queryRunner.dropTable('audit_sessions');
    await queryRunner.dropTable('audit_programs');
    await queryRunner.dropTable('control_tests');
    await queryRunner.dropTable('audit_findings');
    await queryRunner.dropTable('soc_audits');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "test_method";`);
    await queryRunner.query(`DROP TYPE "test_result";`);
    await queryRunner.query(`DROP TYPE "risk_rating";`);
    await queryRunner.query(`DROP TYPE "finding_type";`);
    await queryRunner.query(`DROP TYPE "finding_status";`);
    await queryRunner.query(`DROP TYPE "finding_severity";`);
    await queryRunner.query(`DROP TYPE "audit_phase";`);
    await queryRunner.query(`DROP TYPE "audit_status";`);
    await queryRunner.query(`DROP TYPE "audit_type";`);
  }
}
