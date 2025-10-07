import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Control } from '../modules/compliance/entities/control.entity';
import { ComplianceFramework } from '../modules/compliance/entities/framework.entity';
import { Policy } from '../modules/policies/entities/policy.entity';
import { Risk } from '../modules/risks/entities/risk.entity';
import { AuthorizationGuard } from './guards/authorization.guard';

// Import guards
import { KongAuthGuard } from './guards/kong-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthorizationService } from './services/authorization.service';

/**
 * SharedServicesModule provides common services and guards needed across the application.
 * This module is global to ensure guards and their dependencies are available everywhere.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Policy, Control, Risk, ComplianceFramework])
  ],
  providers: [
    // Core NestJS services needed by guards
    Reflector,

    // Services
    AuthorizationService,

    // Guards
    KongAuthGuard,
    RolesGuard,
    AuthorizationGuard,
  ],
  exports: [
    // Export core services
    Reflector,

    // Export services
    AuthorizationService,

    // Export guards for use in controllers
    KongAuthGuard,
    RolesGuard,
    AuthorizationGuard,
  ],
})
export class SharedServicesModule {}
