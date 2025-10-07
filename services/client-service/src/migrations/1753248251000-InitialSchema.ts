import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1753248251000 implements MigrationInterface {
  name = 'InitialSchema1753248251000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create all enums
    // Client enums
    await queryRunner.query(
      `CREATE TYPE "public"."client_type" AS ENUM('direct', 'partner_referral', 'managed')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."client_status" AS ENUM('active', 'inactive', 'pending', 'suspended', 'archived')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."company_size" AS ENUM('1-50', '51-200', '201-500', '501-1000', '1000+')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."industry" AS ENUM('technology', 'healthcare', 'finance', 'retail', 'manufacturing', 'education', 'government', 'nonprofit', 'other')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."compliance_framework" AS ENUM('soc1_type1', 'soc1_type2', 'soc2_type1', 'soc2_type2', 'iso27001', 'hipaa', 'gdpr', 'pci_dss', 'nist', 'fedramp')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."compliance_status" AS ENUM('not_started', 'assessment', 'remediation', 'implementation', 'ready_for_audit', 'under_audit', 'compliant', 'non_compliant', 'expired')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical')`
    );

    // Client user enums
    await queryRunner.query(
      `CREATE TYPE "public"."client_user_role" AS ENUM('owner', 'admin', 'manager', 'user', 'viewer', 'auditor')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."client_user_status" AS ENUM('active', 'inactive', 'pending', 'suspended')`
    );

    // Document enums
    await queryRunner.query(
      `CREATE TYPE "public"."document_type" AS ENUM('contract', 'policy', 'procedure', 'evidence', 'report', 'certificate', 'audit_report', 'assessment', 'other')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'expired', 'archived')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_confidentiality" AS ENUM('public', 'internal', 'confidential', 'highly_confidential')`
    );

    // Audit enums
    await queryRunner.query(
      `CREATE TYPE "public"."audit_type" AS ENUM('internal', 'external', 'readiness', 'surveillance', 'recertification')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_status" AS ENUM('planned', 'scheduled', 'in_preparation', 'in_progress', 'field_work_complete', 'pending_report', 'completed', 'cancelled')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_result" AS ENUM('passed', 'passed_with_conditions', 'failed', 'pending')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_scope" AS ENUM('full', 'limited', 'focused')`
    );

    // Contract enums
    await queryRunner.query(
      `CREATE TYPE "public"."contract_type" AS ENUM('msa', 'sow', 'nda', 'subscription', 'project', 'retainer', 'amendment')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contract_status" AS ENUM('draft', 'sent', 'negotiation', 'signed', 'active', 'expired', 'terminated', 'renewed')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."billing_frequency" AS ENUM('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_terms" AS ENUM('net_0', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom')`
    );

    // Contract line item enums
    await queryRunner.query(
      `CREATE TYPE "public"."line_item_type" AS ENUM('service', 'product', 'discount', 'tax', 'fee', 'credit')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."line_item_billing_cycle" AS ENUM('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual', 'usage_based')`
    );

    // Audit trail enums
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'view', 'export', 'status_change', 'permission_change', 'login', 'logout', 'contract_signed', 'contract_terminated', 'contract_renewed', 'document_uploaded', 'document_deleted', 'audit_started', 'audit_completed', 'compliance_status_changed')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_resource_type" AS ENUM('client', 'contract', 'document', 'user', 'organization', 'audit', 'evidence', 'policy', 'control', 'risk', 'finding', 'report')`
    );

    // Create clients table
    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "legalName" character varying,
        "slug" character varying NOT NULL,
        "clientType" "public"."client_type" NOT NULL DEFAULT 'direct',
        "organizationId" character varying,
        "parentClientId" uuid,
        "logo" character varying,
        "website" character varying,
        "description" character varying,
        "industry" "public"."industry",
        "size" "public"."company_size",
        "employeeCount" integer,
        "annualRevenue" numeric(15,2),
        "status" "public"."client_status" NOT NULL DEFAULT 'active',
        "complianceStatus" "public"."compliance_status" NOT NULL DEFAULT 'not_started',
        "targetFrameworks" text,
        "riskLevel" "public"."risk_level" NOT NULL DEFAULT 'medium',
        "complianceScore" numeric(3,2) DEFAULT '0',
        "contactInfo" text,
        "address" text,
        "billingInfo" text,
        "partnerId" character varying,
        "partnerReferralDate" date,
        "salesRepId" character varying,
        "accountManagerId" character varying,
        "technicalLeadId" character varying,
        "onboardingStartDate" date,
        "onboardingCompleteDate" date,
        "firstAuditDate" date,
        "lastAuditDate" date,
        "nextAuditDate" date,
        "certificateExpiryDate" date,
        "auditHistory" text,
        "integrations" text,
        "settings" text,
        "metadata" text,
        "tags" text,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        "deletedAt" TIMESTAMP,
        "deletedBy" character varying,
        CONSTRAINT "UQ_ad0c1c446ac158de654e8820221" UNIQUE ("slug"),
        CONSTRAINT "PK_f1cd1a279e3e338feb7d47eaabc" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for clients
    await queryRunner.query(
      `CREATE INDEX "IDX_0a7eb01e21b1bfd0797ec1db50a" ON "clients" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5cf96d22cbc89ee6f67f7e3e8a" ON "clients" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_54bb80ce854029cdc1ca9b7c6c5" ON "clients" ("complianceStatus")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ad0c1c446ac158de654e8820221" ON "clients" ("slug")`
    );

    // Create client_users table
    await queryRunner.query(`
      CREATE TABLE "client_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "role" "public"."client_user_role" NOT NULL DEFAULT 'user',
        "status" "public"."client_user_status" NOT NULL DEFAULT 'active',
        "title" character varying,
        "department" character varying,
        "isPrimaryContact" boolean NOT NULL DEFAULT false,
        "isBillingContact" boolean NOT NULL DEFAULT false,
        "isTechnicalContact" boolean NOT NULL DEFAULT false,
        "isSecurityContact" boolean NOT NULL DEFAULT false,
        "permissions" text,
        "preferences" text,
        "lastLoginAt" TIMESTAMP,
        "invitedAt" TIMESTAMP,
        "acceptedAt" TIMESTAMP,
        "invitedBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "UQ_client_user" UNIQUE ("clientId", "userId"),
        CONSTRAINT "PK_445d27cfebdb37ff8fd89a68b67" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for client_users
    await queryRunner.query(
      `CREATE INDEX "IDX_e2e4dc395e772074fb2fb64b8e6" ON "client_users" ("clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0c67c77c5e638e147c67ed2b84" ON "client_users" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6c68f25bb5f1e8c58c89f59cf38" ON "client_users" ("status")`
    );

    // Create client_documents table
    await queryRunner.query(`
      CREATE TABLE "client_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "type" "public"."document_type" NOT NULL,
        "status" "public"."document_status" NOT NULL DEFAULT 'draft',
        "confidentiality" "public"."document_confidentiality" NOT NULL DEFAULT 'internal',
        "fileUrl" character varying,
        "fileName" character varying,
        "mimeType" character varying,
        "fileSize" integer,
        "checksum" character varying,
        "version" character varying,
        "versionNumber" integer DEFAULT 1,
        "parentDocumentId" uuid,
        "tags" text,
        "metadata" text,
        "approvalHistory" text,
        "accessControl" text,
        "effectiveDate" date,
        "expiryDate" date,
        "reviewDate" date,
        "approvedDate" date,
        "reviewedBy" character varying,
        "approvedBy" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "PK_2c7e8cfb19b44a269b00b6a4ad1" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for client_documents
    await queryRunner.query(
      `CREATE INDEX "IDX_4a3c8cfb19b44a269b00b6a4be7" ON "client_documents" ("clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a8d7d6e1d3f5463aa1e7f3c9876" ON "client_documents" ("type")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9e8f7c2e4d74832bb5f8a2c431" ON "client_documents" ("status")`
    );

    // Create client_audits table
    await queryRunner.query(`
      CREATE TABLE "client_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "type" "public"."audit_type" NOT NULL,
        "status" "public"."audit_status" NOT NULL DEFAULT 'planned',
        "result" "public"."audit_result",
        "scope" "public"."audit_scope" NOT NULL DEFAULT 'full',
        "framework" "public"."compliance_framework" NOT NULL,
        "leadAuditorId" character varying,
        "auditFirmId" character varying,
        "auditFirmName" character varying,
        "certificateNumber" character varying,
        "auditTeamIds" text,
        "findingIds" text,
        "documentIds" text,
        "evidenceRequestIds" text,
        "scheduledStartDate" date,
        "scheduledEndDate" date,
        "actualStartDate" date,
        "actualEndDate" date,
        "reportDueDate" date,
        "reportDeliveredDate" date,
        "certificateIssueDate" date,
        "certificateExpiryDate" date,
        "scopeDetails" text,
        "findings" text,
        "timeline" text,
        "costBreakdown" text,
        "metrics" text,
        "feedback" text,
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "PK_3f9d8b5e19c44e269c00c7b5ae2" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for client_audits
    await queryRunner.query(
      `CREATE INDEX "IDX_6a4e9cfb19b44a269b00b6a5cd3" ON "client_audits" ("clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b7f9d1e2c3e4567ab1d2e4f789" ON "client_audits" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c8fa2b3d4e5678bc2e3f5a890" ON "client_audits" ("framework")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad9eb3c5e6f7890cd3f4a5b9012" ON "client_audits" ("scheduledStartDate")`
    );

    // Create contracts table
    await queryRunner.query(`
      CREATE TABLE "contracts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "contractNumber" character varying NOT NULL,
        "clientId" uuid NOT NULL,
        "parentContractId" uuid,
        "title" character varying NOT NULL,
        "description" character varying,
        "type" "public"."contract_type" NOT NULL DEFAULT 'sow',
        "status" "public"."contract_status" NOT NULL DEFAULT 'draft',
        "currency" character varying NOT NULL DEFAULT 'USD',
        "totalValue" numeric(12,2) DEFAULT '0',
        "monthlyValue" numeric(12,2) DEFAULT '0',
        "billingFrequency" "public"."billing_frequency" NOT NULL DEFAULT 'monthly',
        "paymentTerms" "public"."payment_terms" NOT NULL DEFAULT 'net_30',
        "customPaymentTerms" character varying,
        "startDate" date,
        "endDate" date,
        "signedDate" date,
        "autoRenew" boolean NOT NULL DEFAULT false,
        "renewalNoticePeriod" integer DEFAULT 90,
        "terminationNoticePeriod" integer DEFAULT 30,
        "signedBy" character varying,
        "clientSignatory" character varying,
        "clientSignatoryTitle" character varying,
        "clientSignatoryEmail" character varying,
        "mspSignatory" character varying,
        "mspSignatoryTitle" character varying,
        "documentUrl" character varying,
        "signedDocumentUrl" character varying,
        "attachmentUrls" text,
        "services" text,
        "deliverables" text,
        "pricing" text,
        "sla" text,
        "terms" text,
        "renewalHistory" text,
        "metadata" text,
        "notes" text,
        "tags" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "UQ_f7c91e57a5f344e18b93f97ed54" UNIQUE ("contractNumber"),
        CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for contracts
    await queryRunner.query(
      `CREATE INDEX "IDX_d3c91e4b2e3f48359c7b8000e12" ON "contracts" ("clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e4f73a5b3c2d45678a9b1d3e456" ON "contracts" ("status")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f7c91e57a5f344e18b93f97ed54" ON "contracts" ("contractNumber")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1a2b3c4d5e6f7890ab1c2d3e456" ON "contracts" ("startDate")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2b3c4d5e6f7890ab1c2d3e45678" ON "contracts" ("endDate")`
    );

    // Create contract_line_items table
    await queryRunner.query(`
      CREATE TABLE "contract_line_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "contractId" uuid NOT NULL,
        "type" "public"."line_item_type" NOT NULL DEFAULT 'service',
        "name" character varying NOT NULL,
        "description" character varying,
        "sku" character varying,
        "quantity" numeric(10,2) NOT NULL DEFAULT '1',
        "unitPrice" numeric(12,2) NOT NULL DEFAULT '0',
        "totalPrice" numeric(12,2) NOT NULL DEFAULT '0',
        "unitOfMeasure" character varying DEFAULT 'unit',
        "billingCycle" "public"."line_item_billing_cycle" NOT NULL DEFAULT 'monthly',
        "isRecurring" boolean NOT NULL DEFAULT false,
        "startDate" date,
        "endDate" date,
        "taxRate" numeric(5,2) DEFAULT '0',
        "taxAmount" numeric(12,2) DEFAULT '0',
        "isTaxable" boolean NOT NULL DEFAULT true,
        "discountPercentage" numeric(5,2) DEFAULT '0',
        "discountAmount" numeric(12,2) DEFAULT '0',
        "discountReason" character varying,
        "sortOrder" integer DEFAULT 0,
        "tags" text,
        "metadata" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" character varying,
        "updatedBy" character varying,
        CONSTRAINT "PK_7d8f9a5b3c2e4567890ab1c2d3e" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for contract_line_items
    await queryRunner.query(
      `CREATE INDEX "IDX_9e8f7a5b3c2d4567890ab1c2d3f" ON "contract_line_items" ("contractId")`
    );

    // Create audit_trails table
    await queryRunner.query(`
      CREATE TABLE "audit_trails" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" "public"."audit_action" NOT NULL,
        "resourceType" "public"."audit_resource_type" NOT NULL,
        "resourceId" uuid NOT NULL,
        "resourceName" character varying,
        "userId" uuid NOT NULL,
        "userName" character varying,
        "userEmail" character varying,
        "userRole" character varying,
        "clientId" uuid,
        "organizationId" uuid,
        "organizationName" character varying,
        "ipAddress" character varying,
        "userAgent" character varying,
        "sessionId" character varying,
        "description" character varying,
        "changes" jsonb,
        "metadata" jsonb,
        "isSystemAction" boolean NOT NULL DEFAULT false,
        "isSensitive" boolean NOT NULL DEFAULT false,
        "complianceFramework" character varying,
        "controlId" character varying,
        "riskLevel" character varying,
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_0a1f2b3c4d5e6f7890ab1c2d3e4" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for audit_trails
    await queryRunner.query(
      `CREATE INDEX "IDX_1b2c3d4e5f6789ab01c2d3e4567" ON "audit_trails" ("resourceType", "resourceId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c3d4e5f67890ab1c2d3e456789" ON "audit_trails" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d4e5f6789ab01c2d3e45678901" ON "audit_trails" ("clientId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e5f67890ab1c2d3e45678901ab" ON "audit_trails" ("action")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5f67890ab1c2d3e45678901abcd" ON "audit_trails" ("timestamp")`
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "FK_c47fe86b09ef5bb993680471802" FOREIGN KEY ("parentClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "client_users" ADD CONSTRAINT "FK_e2e4dc395e772074fb2fb64b8e6" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "client_documents" ADD CONSTRAINT "FK_4a3c8cfb19b44a269b00b6a4be7" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "client_audits" ADD CONSTRAINT "FK_6a4e9cfb19b44a269b00b6a5cd3" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "FK_d3c91e4b2e3f48359c7b8000e12" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "FK_8e9f7a5b3c2d45678901ab1c2d3" FOREIGN KEY ("parentContractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contract_line_items" ADD CONSTRAINT "FK_9e8f7a5b3c2d4567890ab1c2d3f" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "audit_trails" ADD CONSTRAINT "FK_3d4e5f6789ab01c2d3e45678901" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "audit_trails" DROP CONSTRAINT "FK_3d4e5f6789ab01c2d3e45678901"`
    );
    await queryRunner.query(
      `ALTER TABLE "contract_line_items" DROP CONSTRAINT "FK_9e8f7a5b3c2d4567890ab1c2d3f"`
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "FK_8e9f7a5b3c2d45678901ab1c2d3"`
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "FK_d3c91e4b2e3f48359c7b8000e12"`
    );
    await queryRunner.query(
      `ALTER TABLE "client_audits" DROP CONSTRAINT "FK_6a4e9cfb19b44a269b00b6a5cd3"`
    );
    await queryRunner.query(
      `ALTER TABLE "client_documents" DROP CONSTRAINT "FK_4a3c8cfb19b44a269b00b6a4be7"`
    );
    await queryRunner.query(
      `ALTER TABLE "client_users" DROP CONSTRAINT "FK_e2e4dc395e772074fb2fb64b8e6"`
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT "FK_c47fe86b09ef5bb993680471802"`
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "public"."IDX_5f67890ab1c2d3e45678901abcd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e5f67890ab1c2d3e45678901ab"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d4e5f6789ab01c2d3e45678901"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2c3d4e5f67890ab1c2d3e456789"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1b2c3d4e5f6789ab01c2d3e4567"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9e8f7a5b3c2d4567890ab1c2d3f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2b3c4d5e6f7890ab1c2d3e45678"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1a2b3c4d5e6f7890ab1c2d3e456"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f7c91e57a5f344e18b93f97ed54"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e4f73a5b3c2d45678a9b1d3e456"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d3c91e4b2e3f48359c7b8000e12"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ad9eb3c5e6f7890cd3f4a5b9012"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9c8fa2b3d4e5678bc2e3f5a890"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8b7f9d1e2c3e4567ab1d2e4f789"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6a4e9cfb19b44a269b00b6a5cd3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b9e8f7c2e4d74832bb5f8a2c431"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a8d7d6e1d3f5463aa1e7f3c9876"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4a3c8cfb19b44a269b00b6a4be7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6c68f25bb5f1e8c58c89f59cf38"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f0c67c77c5e638e147c67ed2b84"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2e4dc395e772074fb2fb64b8e6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ad0c1c446ac158de654e8820221"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_54bb80ce854029cdc1ca9b7c6c5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f5cf96d22cbc89ee6f67f7e3e8a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0a7eb01e21b1bfd0797ec1db50a"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "audit_trails"`);
    await queryRunner.query(`DROP TABLE "contract_line_items"`);
    await queryRunner.query(`DROP TABLE "contracts"`);
    await queryRunner.query(`DROP TABLE "client_audits"`);
    await queryRunner.query(`DROP TABLE "client_documents"`);
    await queryRunner.query(`DROP TABLE "client_users"`);
    await queryRunner.query(`DROP TABLE "clients"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."audit_resource_type"`);
    await queryRunner.query(`DROP TYPE "public"."audit_action"`);
    await queryRunner.query(`DROP TYPE "public"."line_item_billing_cycle"`);
    await queryRunner.query(`DROP TYPE "public"."line_item_type"`);
    await queryRunner.query(`DROP TYPE "public"."payment_terms"`);
    await queryRunner.query(`DROP TYPE "public"."billing_frequency"`);
    await queryRunner.query(`DROP TYPE "public"."contract_status"`);
    await queryRunner.query(`DROP TYPE "public"."contract_type"`);
    await queryRunner.query(`DROP TYPE "public"."audit_scope"`);
    await queryRunner.query(`DROP TYPE "public"."audit_result"`);
    await queryRunner.query(`DROP TYPE "public"."audit_status"`);
    await queryRunner.query(`DROP TYPE "public"."audit_type"`);
    await queryRunner.query(`DROP TYPE "public"."document_confidentiality"`);
    await queryRunner.query(`DROP TYPE "public"."document_status"`);
    await queryRunner.query(`DROP TYPE "public"."document_type"`);
    await queryRunner.query(`DROP TYPE "public"."client_user_status"`);
    await queryRunner.query(`DROP TYPE "public"."client_user_role"`);
    await queryRunner.query(`DROP TYPE "public"."risk_level"`);
    await queryRunner.query(`DROP TYPE "public"."compliance_status"`);
    await queryRunner.query(`DROP TYPE "public"."compliance_framework"`);
    await queryRunner.query(`DROP TYPE "public"."industry"`);
    await queryRunner.query(`DROP TYPE "public"."company_size"`);
    await queryRunner.query(`DROP TYPE "public"."client_status"`);
    await queryRunner.query(`DROP TYPE "public"."client_type"`);
  }
}
