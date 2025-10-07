import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class FixEnumMismatches1753251001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing AutomationLevel enum
    await queryRunner.query(`
      CREATE TYPE automation_level AS ENUM (
        'MANUAL', 'SEMI_AUTOMATED', 'AUTOMATED', 'FULLY_AUTOMATED'
      );
    `);
    
    // Add automationLevel column to controls table
    await queryRunner.query(`
      ALTER TABLE "controls" 
      ADD COLUMN "automationLevel" automation_level DEFAULT 'MANUAL';
    `);
    
    // Add priority column to controls table
    await queryRunner.query(`
      ALTER TABLE "controls" 
      ADD COLUMN "priority" varchar DEFAULT 'medium';
    `);
    
    // Add effectiveness column to controls table
    await queryRunner.query(`
      ALTER TABLE "controls" 
      ADD COLUMN "effectiveness" jsonb DEFAULT '{}'::jsonb;
    `);

    // Add testMethod enum for control test results
    await queryRunner.query(`
      CREATE TYPE test_method AS ENUM (
        'MANUAL', 'AUTOMATED', 'HYBRID'
      );
    `);
    
    // Add testMethod column to control_test_results
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      ADD COLUMN "testMethod" test_method DEFAULT 'MANUAL';
    `);
    
    // Fix TestResultStatus enum to match entity
    await queryRunner.query(`
      CREATE TYPE test_result_status AS ENUM (
        'PASSED', 'FAILED', 'PARTIALLY_PASSED', 'NOT_TESTED', 'NOT_APPLICABLE'
      );
    `);
    
    // Update control_test_results to use correct result enum
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      ALTER COLUMN "result" DROP DEFAULT;
    `);
    
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      ALTER COLUMN "result" TYPE test_result_status 
      USING CASE 
        WHEN "result"::text = 'PASS' THEN 'PASSED'::test_result_status
        WHEN "result"::text = 'FAIL' THEN 'FAILED'::test_result_status
        WHEN "result"::text = 'PARTIAL' THEN 'PARTIALLY_PASSED'::test_result_status
        WHEN "result"::text = 'NOT_APPLICABLE' THEN 'NOT_APPLICABLE'::test_result_status
        ELSE 'NOT_TESTED'::test_result_status
      END;
    `);
    
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      ALTER COLUMN "result" SET DEFAULT 'NOT_TESTED';
    `);

    // Add missing columns to control_test_results for entity alignment
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      ADD COLUMN "testProcedures" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN "sampleData" jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN "managementComments" text,
      ADD COLUMN "isRetest" boolean DEFAULT false,
      ADD COLUMN "previousTestId" uuid,
      ADD COLUMN "metrics" jsonb DEFAULT '{}'::jsonb;
    `);

    // Performance indexes for critical queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_controls_frameworks_gin" 
      ON "controls" USING GIN ("frameworks");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_controls_automation_level" 
      ON "controls" ("automationLevel");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_controls_org_status_category" 
      ON "controls" ("organizationId", "status", "category");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_test_results_result" 
      ON "control_test_results" ("result");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_test_results_test_date_desc" 
      ON "control_test_results" ("testDate" DESC);
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_implementations_org_status" 
      ON "control_implementations" ("organizationId", "status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_controls_related_gin" 
      ON "controls" USING GIN ("relatedControls");
    `);
    
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_controls_compensating_gin" 
      ON "controls" USING GIN ("compensatingControls");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_controls_compensating_gin";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_controls_related_gin";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_implementations_org_status";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_test_results_test_date_desc";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_test_results_result";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_controls_org_status_category";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_controls_automation_level";`);
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS "IDX_controls_frameworks_gin";`);

    // Remove added columns
    await queryRunner.query(`
      ALTER TABLE "control_test_results" 
      DROP COLUMN IF EXISTS "metrics",
      DROP COLUMN IF EXISTS "previousTestId",
      DROP COLUMN IF EXISTS "isRetest",
      DROP COLUMN IF EXISTS "managementComments",
      DROP COLUMN IF EXISTS "sampleData",
      DROP COLUMN IF EXISTS "testProcedures",
      DROP COLUMN IF EXISTS "testMethod";
    `);
    
    await queryRunner.query(`
      ALTER TABLE "controls" 
      DROP COLUMN IF EXISTS "effectiveness",
      DROP COLUMN IF EXISTS "priority",
      DROP COLUMN IF EXISTS "automationLevel";
    `);

    // Drop types
    await queryRunner.query(`DROP TYPE IF EXISTS test_result_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS test_method;`);
    await queryRunner.query(`DROP TYPE IF EXISTS automation_level;`);
  }
}
