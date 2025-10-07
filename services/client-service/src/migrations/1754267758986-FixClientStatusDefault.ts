import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FixClientStatusDefault1754267758986 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change default status from 'active' to 'pending' to match entity definition
    await queryRunner.query(`
            ALTER TABLE "clients" 
            ALTER COLUMN "status" SET DEFAULT 'pending'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to 'active' default
    await queryRunner.query(`
            ALTER TABLE "clients" 
            ALTER COLUMN "status" SET DEFAULT 'active'
        `);
  }
}
