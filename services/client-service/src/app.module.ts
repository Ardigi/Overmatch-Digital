import { HttpModule } from '@nestjs/axios';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { AuditsModule } from './modules/audits/audits.module';
import { BillingModule } from './modules/billing/billing.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RedisModule } from './modules/redis/redis.module';
import { SharedClientModule } from './modules/shared-client/shared-client.module';
import { TestModule } from './modules/test/test.module';
// DynamicConfigService not available for Client Service
import { monitoringConfig } from './monitoring.config';
import { testMonitoringConfig } from './monitoring.config.test';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    console.log('[AppModule] NODE_ENV at runtime:', process.env.NODE_ENV);
    console.log('[AppModule] DB_HOST:', process.env.DB_HOST);
    console.log('[AppModule] DB_PORT:', process.env.DB_PORT);

    // Build imports array at runtime to properly handle NODE_ENV
    const imports: any[] = [];

    try {
      // Configuration - Always first
      // ConfigModule.forRoot() is now async, so we need to await it
      const configModule = await ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
      });
      imports.push(configModule);
      console.log('[AppModule] Added ConfigModule');

      // Database - Use synchronous config in test environment
      if (process.env.NODE_ENV === 'test') {
        // Import all entities explicitly for test mode
        const entities = await import('./entities');
        const entityList = Object.values(entities);
        console.log(`[AppModule] Loaded ${entityList.length} entities for test mode`);

        // For tests, use synchronous configuration with explicit values
        const typeOrmModule = TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5433'),
          username: process.env.DB_USERNAME || 'test_user',
          password: process.env.DB_PASSWORD || 'test_pass',
          database: process.env.DB_NAME || 'soc_clients_test',
          entities: entityList,
          autoLoadEntities: false, // Use explicit entities in test mode
          synchronize: true,
          logging: false,
          dropSchema: false,
        });
        imports.push(typeOrmModule);
        console.log('[AppModule] Added TypeOrmModule (test mode)');
      } else {
        // For non-test environments, use async configuration
        const typeOrmModule = TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            return {
              type: 'postgres',
              host: configService.get('DB_HOST', '127.0.0.1'),
              port: configService.get('DB_PORT', 5432),
              username: configService.get('DB_USERNAME', 'soc_user'),
              password: configService.get('DB_PASSWORD', 'soc_pass'),
              database: configService.get('DB_NAME', 'soc_clients'),
              entities: [],
              autoLoadEntities: true,
              synchronize: true,
              logging: configService.get('NODE_ENV') === 'development',
            };
          },
          inject: [ConfigService],
        });
        imports.push(typeOrmModule);
        console.log('[AppModule] Added TypeOrmModule (async mode)');
      }

      // JWT Module with simple configuration
      const jwtModule = JwtModule.registerAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const jwtSecret = configService.get('JWT_SECRET');
          if (!jwtSecret) {
            throw new Error('JWT_SECRET is required but not configured');
          }

          return {
            secret: jwtSecret,
            signOptions: {
              expiresIn: configService.get('JWT_EXPIRATION', '8h'),
            },
            verifyOptions: {
              clockTolerance: 30,
            },
          };
        },
        inject: [ConfigService],
        global: true,
      });
      imports.push(jwtModule);
      console.log('[AppModule] Added JwtModule');

      // Passport
      const passportModule = PassportModule.register({ defaultStrategy: 'jwt' });
      imports.push(passportModule);
      console.log('[AppModule] Added PassportModule');

      // Event Emitter
      const eventEmitterModule = EventEmitterModule.forRoot();
      imports.push(eventEmitterModule);
      console.log('[AppModule] Added EventEmitterModule');

      // HTTP Module for inter-service communication
      imports.push(
        HttpModule.register({
          timeout: 30000,
          maxRedirects: 5,
        })
      );
      console.log('[AppModule] Added HttpModule');

      // HTTP Common Module for service discovery
      imports.push(
        HttpCommonModule.forRoot({
          serviceName: 'client-service',
          serviceVersion: '1.0.0',
          enableRequestContext: true,
          enableLogging: process.env.NODE_ENV !== 'test',
          enableCorrelationId: true,
        })
      );
      console.log('[AppModule] Added HttpCommonModule');

      // Core Modules
      imports.push(RedisModule);
      console.log('[AppModule] Added RedisModule');

      imports.push(SharedClientModule);
      console.log('[AppModule] Added SharedClientModule');

      // Feature Modules
      const featureModules = [
        { name: 'ClientsModule', module: ClientsModule },
        { name: 'ContractsModule', module: ContractsModule },
        { name: 'OrganizationsModule', module: OrganizationsModule },
        { name: 'BillingModule', module: BillingModule },
        { name: 'AuditsModule', module: AuditsModule },
        { name: 'EventsModule', module: EventsModule },
        { name: 'HealthModule', module: HealthModule },
        { name: 'SharedClientModule', module: SharedClientModule },
        { name: 'TestModule', module: TestModule },
      ];

      for (const { name, module } of featureModules) {
        if (module) {
          imports.push(module);
          console.log(`[AppModule] Added ${name}`);
        } else {
          console.error(`[AppModule] WARNING: ${name} is undefined!`);
        }
      }

      // Add monitoring module with appropriate config
      // Use test config for test environment to avoid external connections
      if (process.env.NODE_ENV === 'test') {
        console.log('[AppModule] Adding MonitoringModule with test config');
        imports.push(MonitoringModule.forRoot(testMonitoringConfig));
      } else {
        console.log('[AppModule] Adding MonitoringModule with production config');
        imports.push(MonitoringModule.forRoot(monitoringConfig));
      }

      // Debug: Check for undefined values in imports
      console.log('[AppModule] Final validation of imports array...');
      const validatedImports = [];
      imports.forEach((module, index) => {
        if (module === undefined || module === null) {
          console.error(`[AppModule] ERROR: Import at index ${index} is ${module} - skipping`);
        } else {
          validatedImports.push(module);
        }
      });

      console.log(`[AppModule] Successfully validated ${validatedImports.length} imports`);

      // Add providers (no dynamic config service for client service)
      const providers = [];

      const result = {
        module: AppModule,
        imports: validatedImports,
        providers,
        exports: [],
      };

      return result;
    } catch (error) {
      console.error('[AppModule] Error during module initialization:', error);
      console.error('[AppModule] Stack trace:', error.stack);
      throw error;
    }
  }
}
