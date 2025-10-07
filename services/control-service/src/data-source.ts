import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ControlTest } from './modules/control-tests/entities/control-test.entity';
import { Control } from './modules/controls/entities/control.entity';
import { ControlAssessment } from './modules/controls/entities/control-assessment.entity';
import { ControlException } from './modules/controls/entities/control-exception.entity';
import { ControlImplementation } from './modules/implementation/entities/control-implementation.entity';
import { ControlMapping } from './modules/controls/entities/control-mapping.entity';
import { ControlTestResult } from './modules/controls/entities/control-test-result.entity';

// Load environment variables
dotenv.config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DB_HOST') || '127.0.0.1',
  port: parseInt(configService.get('DB_PORT') || '5432', 10),
  username: configService.get('DB_USERNAME') || 'soc_user',
  password: configService.get('DB_PASSWORD') || (() => { throw new Error('SECURITY ERROR: DB_PASSWORD environment variable is required for SOC 2 compliance'); })(),
  database: configService.get('DB_NAME') || 'soc_controls',
  entities: [
    Control,
    ControlImplementation,
    ControlTestResult,
    ControlException,
    ControlAssessment,
    ControlMapping,
    ControlTest,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
});
