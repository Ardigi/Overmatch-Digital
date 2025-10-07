import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantAndSecurityEntities1736706000000 implements MigrationInterface {
  name = 'AddTenantAndSecurityEntities1736706000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenant_access_logs table
    await queryRunner.query(`
      CREATE TABLE "tenant_access_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "operation" character varying NOT NULL,
        "action" character varying NOT NULL,
        "resource" character varying NOT NULL,
        "resourceId" character varying,
        "result" character varying NOT NULL DEFAULT 'SUCCESS',
        "reason" character varying,
        "ipAddress" character varying,
        "userAgent" character varying,
        "performanceMs" integer,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_access_logs" PRIMARY KEY ("id")
      )
    `);

    // Create index for tenant_access_logs
    await queryRunner.query(`
      CREATE INDEX "IDX_tenant_access_logs_tenant_user" 
      ON "tenant_access_logs" ("tenantId", "userId")
    `);

    // Create cross_tenant_access_requests table
    await queryRunner.query(`
      CREATE TABLE "cross_tenant_access_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceTenantId" character varying NOT NULL,
        "targetTenantId" character varying NOT NULL,
        "requestedBy" character varying NOT NULL,
        "purpose" character varying NOT NULL,
        "resourceType" character varying,
        "resourceId" character varying,
        "resources" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "approvedBy" character varying,
        "approvedAt" TIMESTAMP,
        "deniedBy" character varying,
        "deniedAt" TIMESTAMP,
        "denialReason" character varying,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cross_tenant_access_requests" PRIMARY KEY ("id")
      )
    `);

    // Create user_roles table for RBAC
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "roleId" uuid NOT NULL,
        "tenantId" character varying NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "assignedBy" character varying,
        "assignedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("id")
      )
    `);

    // Create roles table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "tenantId" character varying,
        "parentRoleId" uuid,
        "isSystem" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id")
      )
    `);

    // Create permissions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "resource" character varying NOT NULL,
        "action" character varying NOT NULL,
        "conditions" jsonb,
        "description" character varying,
        "isSystem" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id")
      )
    `);

    // Create role_permissions junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permissions" (
        "roleId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("roleId", "permissionId")
      )
    `);

    // Create abac_policies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "abac_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "resource" character varying NOT NULL,
        "action" character varying NOT NULL,
        "conditions" jsonb NOT NULL,
        "obligations" jsonb,
        "priority" integer NOT NULL DEFAULT 100,
        "isActive" boolean NOT NULL DEFAULT true,
        "tenantId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_abac_policies" PRIMARY KEY ("id")
      )
    `);

    // Create threat_events table for risk assessment
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "threat_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "category" character varying NOT NULL,
        "threatActor" character varying NOT NULL,
        "likelihood" decimal(5,2) NOT NULL,
        "impact" decimal(5,2) NOT NULL,
        "riskScore" decimal(5,2) NOT NULL,
        "controlIds" text,
        "organizationId" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "lastAssessment" TIMESTAMP,
        "nextAssessment" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_threat_events" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_roles" 
      ADD CONSTRAINT "FK_user_roles_role" 
      FOREIGN KEY ("roleId") REFERENCES "roles"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "roles" 
      ADD CONSTRAINT "FK_roles_parent" 
      FOREIGN KEY ("parentRoleId") REFERENCES "roles"("id") 
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions" 
      ADD CONSTRAINT "FK_role_permissions_role" 
      FOREIGN KEY ("roleId") REFERENCES "roles"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions" 
      ADD CONSTRAINT "FK_role_permissions_permission" 
      FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") 
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_permission"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_role"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "FK_roles_parent"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_role"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "threat_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "abac_policies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE "cross_tenant_access_requests"`);
    await queryRunner.query(`DROP INDEX "IDX_tenant_access_logs_tenant_user"`);
    await queryRunner.query(`DROP TABLE "tenant_access_logs"`);
  }
}