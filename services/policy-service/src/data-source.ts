import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ApiKey } from './modules/api-keys/entities/api-key.entity';
import { AuditLog } from './modules/audit/entities/audit-log.entity';
import { Control } from './modules/compliance/entities/control.entity';
import { ComplianceFramework } from './modules/compliance/entities/framework.entity';
import { Policy } from './modules/policies/entities/policy.entity';
import { Risk } from './modules/risks/entities/risk.entity';

// Load environment variables
dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST') || '127.0.0.1',
  port: parseInt(configService.get('DB_PORT') || '5432', 10),
  username: configService.get('DB_USERNAME') || 'postgres',
  password: configService.get('DB_PASSWORD') || 'postgres',
  database: configService.get('DB_NAME') || 'soc_policies',
  entities: [Policy, Control, ComplianceFramework, Risk, AuditLog, ApiKey],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
});
