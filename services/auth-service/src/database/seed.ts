import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import * as fs from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import {
  Organization,
  Permission,
  Role,
  RolePermission,
  User,
  UserRole,
} from '../modules/users/entities';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

async function runSeeds() {
  const configService = new ConfigService();

  // Create data source
  const dataSource = new DataSource({
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DB_NAME', 'soc_auth'),
    entities: [User, Organization, Role, UserRole, Permission, RolePermission, AuditLog],
    synchronize: false,
    logging: true,
  });

  try {
    // Initialize connection
    await dataSource.initialize();
    console.log('📊 Database connected successfully');

    // Check if database is already seeded
    const userCount = await dataSource.getRepository(User).count();
    if (userCount > 0) {
      console.log('⚠️  Database already contains data. Skipping seed.');
      await dataSource.destroy();
      return;
    }

    // Get all seed files
    const seedsPath = join(__dirname, 'seeds');
    const seedFiles = fs
      .readdirSync(seedsPath)
      .filter((file) => file.endsWith('.seed.ts') || file.endsWith('.seed.js'))
      .sort();

    console.log(`🌱 Found ${seedFiles.length} seed file(s)`);

    // Run each seed file
    for (const seedFile of seedFiles) {
      console.log(`\n🚀 Running seed: ${seedFile}`);
      const seedModule = await import(join(seedsPath, seedFile));

      if (typeof seedModule.seed === 'function') {
        await seedModule.seed(dataSource);
      } else {
        console.warn(`⚠️  No seed function found in ${seedFile}`);
      }
    }

    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// Run the seed
runSeeds().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
