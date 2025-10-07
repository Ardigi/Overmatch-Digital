import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { Evidence } from './modules/evidence/entities/evidence.entity';
import { EvidenceRequest } from './modules/requests/entities/evidence-request.entity';
import { EvidenceTemplate } from './modules/templates/entities/evidence-template.entity';
import { ValidationRule } from './modules/validation/entities/validation-rule.entity';

// Load environment variables
dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST') || '127.0.0.1',
  port: parseInt(configService.get('DB_PORT') || '5432', 10),
  username: configService.get('DB_USERNAME') || 'postgres',
  password: configService.get('DB_PASSWORD') || 'postgres',
  database: configService.get('DB_NAME') || 'soc_evidence',
  entities: [Evidence, EvidenceRequest, EvidenceTemplate, ValidationRule],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
});
