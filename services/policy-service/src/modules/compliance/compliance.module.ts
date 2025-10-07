import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedServicesModule } from '../../shared/shared-services.module';
import { CacheModule } from '../cache/cache.module';
import { Policy } from '../policies/entities/policy.entity';
import { ComplianceMappingController } from './compliance-mapping.controller';
import { ComplianceMappingService } from './compliance-mapping.service';
import { ControlsController } from './controls.controller';
import { ControlsService } from './controls.service';
import { ComplianceMapping } from './entities/compliance-mapping.entity';
import { Control } from './entities/control.entity';
import { ComplianceFramework } from './entities/framework.entity';
import { FrameworksController } from './frameworks.controller';
import { FrameworksService } from './frameworks.service';

// Import correct modules based on environment
const HttpModule =
  process.env.NODE_ENV === 'test'
    ? require('../../../test/mocks/test-http.module').TestHttpModule
    : require('@nestjs/axios').HttpModule;

const SearchModule =
  process.env.NODE_ENV === 'test'
    ? require('../../../test/mocks/test-search.module').TestSearchModule
    : require('../search/search.module').SearchModule;

@Module({
  imports: [
    SharedServicesModule, // Import this to ensure guards are available
    TypeOrmModule.forFeature([ComplianceFramework, Control, Policy, ComplianceMapping]),
    HttpModule,
    CacheModule,
    SearchModule,
  ],
  controllers: [FrameworksController, ControlsController, ComplianceMappingController],
  providers: [FrameworksService, ControlsService, ComplianceMappingService],
  exports: [FrameworksService, ControlsService, ComplianceMappingService],
})
export class ComplianceModule {}
