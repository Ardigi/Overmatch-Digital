import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsTemplate1753270000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isTemplate column to policies table
    await queryRunner.query(`
      ALTER TABLE "policies" 
      ADD COLUMN "isTemplate" boolean DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop isTemplate column
    await queryRunner.query(`
      ALTER TABLE "policies" 
      DROP COLUMN IF EXISTS "isTemplate"
    `);
  }
}
