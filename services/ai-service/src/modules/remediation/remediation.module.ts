import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remediation } from './entities/remediation.entity';
import { RemediationController } from './remediation.controller';
import { RemediationService } from './remediation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Remediation]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [RemediationController],
  providers: [RemediationService],
  exports: [RemediationService],
})
export class RemediationModule {}
