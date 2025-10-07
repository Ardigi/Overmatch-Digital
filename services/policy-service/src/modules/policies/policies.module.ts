import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationService } from '../../shared/services/authorization.service';
import { CacheModule } from '../cache/cache.module';
import { Control } from '../compliance/entities/control.entity';
import { ComplianceFramework } from '../compliance/entities/framework.entity';
import { EventsModule } from '../events/events.module';
import { Risk } from '../risks/entities/risk.entity';
import { Policy } from './entities/policy.entity';
import { PoliciesController } from './policies.controller';
import { PoliciesService } from './policies.service';

// Import correct modules based on environment
const SearchModule =
  process.env.NODE_ENV === 'test'
    ? require('../../../test/mocks/test-search.module').TestSearchModule
    : require('../search/search.module').SearchModule;

const OpaModule =
  process.env.NODE_ENV === 'test'
    ? require('../../../test/mocks/test-opa.module').TestOpaModule
    : require('../opa/opa.module').OpaModule;

@Module({
  imports: [
    TypeOrmModule.forFeature([Policy, Control, Risk, ComplianceFramework]),
    ScheduleModule.forRoot(),
    CacheModule,
    SearchModule,
    OpaModule,
    EventsModule, // Import EventsModule to get KafkaService
  ],
  controllers: [PoliciesController],
  providers: [
    PoliciesService,
    AuthorizationService,
    // Monitoring services are provided globally via MonitoringPackageModule
    // and are optional in services via @Optional() decorator
  ],
  exports: [PoliciesService],
})
export class PoliciesModule {}
