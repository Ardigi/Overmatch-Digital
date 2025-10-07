import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyStrategy } from '../../shared/strategies/api-key.strategy';
import { AuditModule } from '../audit/audit.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    PassportModule.register({ defaultStrategy: 'api-key' }),
    AuditModule,
  ],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyStrategy],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
