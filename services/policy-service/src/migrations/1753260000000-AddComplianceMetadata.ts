import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplianceMetadata1753260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add complianceMetadata column to policies table
    await queryRunner.query(`
      ALTER TABLE "policies" 
      ADD COLUMN "complianceMetadata" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop complianceMetadata column
    await queryRunner.query(`
      ALTER TABLE "policies" 
      DROP COLUMN IF EXISTS "complianceMetadata"
    `);
  }
}
