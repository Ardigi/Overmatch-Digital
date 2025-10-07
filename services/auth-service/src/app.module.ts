import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
// Secrets are managed at infrastructure level via environment variables
import { DynamicConfigService } from './config/dynamic-config.service';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
// import { HealthModule } from './modules/health/health.module';
import { SimpleHealthModule } from './modules/health/simple-health.module';
import { KeycloakModule } from './modules/keycloak/keycloak.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { RedisModule } from './modules/redis/redis.module';
import { SecurityModule } from './modules/security/security.module';
import { SessionModule } from './modules/sessions/session.module';
import { SharedAuthModule } from './modules/shared-auth/shared-auth.module';
import { SsoModule } from './modules/sso/sso.module';
import { UsersModule } from './modules/users/users.module';
import { monitoringConfig } from './monitoring.config';
import { testMonitoringConfig } from './monitoring.test.config';

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

      // Secrets are managed at infrastructure level (Docker Secrets, Vault, K8s)
      // Services read from environment variables following 12-Factor App methodology
      console.log('[AppModule] Using infrastructure-managed secrets via environment variables');

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
          database: process.env.DB_NAME || 'soc_auth_test',
          entities: entityList,
          autoLoadEntities: false, // Use explicit entities in test mode
          synchronize: true,
          logging: false,
          dropSchema: false,
        });
        imports.push(typeOrmModule);
        console.log('[AppModule] Added TypeOrmModule (test mode)');
      } else {
        // For non-test environments, use async configuration with dynamic config
        const typeOrmModule = TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (
            configService: ConfigService,
            dynamicConfig?: DynamicConfigService
          ) => {
            let dbConfig;

            try {
              // Try to use dynamic config service if available
              if (dynamicConfig) {
                dbConfig = await dynamicConfig.getDatabaseConfig();
              } else {
                // Fallback to direct config service
                dbConfig = {
                  host: configService.get('DB_HOST', '127.0.0.1'),
                  port: configService.get('DB_PORT', 5432),
                  username: configService.get('DB_USERNAME', 'soc_user'),
                  password: configService.get('DB_PASSWORD', 'soc_pass'),
                  database: configService.get('DB_NAME', 'soc_auth'),
                };
              }
            } catch (error) {
              console.warn(
                '[AppModule] Dynamic DB config failed, using environment variables:',
                error.message
              );
              dbConfig = {
                host: configService.get('DB_HOST', '127.0.0.1'),
                port: configService.get('DB_PORT', 5432),
                username: configService.get('DB_USERNAME', 'soc_user'),
                password: configService.get('DB_PASSWORD', 'soc_pass'),
                database: configService.get('DB_NAME', 'soc_auth'),
              };
            }

            return {
              type: 'postgres',
              ...dbConfig,
              entities: [],
              autoLoadEntities: true,
              synchronize: true,
              logging: configService.get('NODE_ENV') === 'development',
            };
          },
          inject: [ConfigService, { token: DynamicConfigService, optional: true }],
        });
        imports.push(typeOrmModule);
        console.log('[AppModule] Added TypeOrmModule (async mode)');
      }

      // Dynamic Config Service - Must be added before JWT module
      const dynamicConfigService = {
        provide: DynamicConfigService,
        useFactory: (configService: ConfigService) => {
          return new DynamicConfigService(configService);
        },
        inject: [ConfigService],
      };

      // JWT with dynamic configuration
      const jwtModule = JwtModule.registerAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService, dynamicConfig?: DynamicConfigService) => {
          let jwtConfig;

          try {
            // Try to use dynamic config service if available
            if (dynamicConfig) {
              jwtConfig = await dynamicConfig.getJwtConfig();
            } else {
              // Fallback to direct config service
              jwtConfig = {
                secret: configService.get('JWT_SECRET'),
                expiresIn: configService.get('JWT_EXPIRATION', '8h'),
                clockTolerance: 30,
              };
            }
          } catch (error) {
            console.warn(
              '[AppModule] Dynamic JWT config failed, using environment variables:',
              error.message
            );
            jwtConfig = {
              secret: configService.get('JWT_SECRET'),
              expiresIn: configService.get('JWT_EXPIRATION', '8h'),
              clockTolerance: 30,
            };
          }

          if (!jwtConfig.secret) {
            throw new Error('JWT_SECRET is required but not configured');
          }

          return {
            secret: jwtConfig.secret,
            signOptions: {
              expiresIn: jwtConfig.expiresIn,
              // Don't include nbf claim to avoid timing issues
            },
            verifyOptions: {
              clockTolerance: jwtConfig.clockTolerance,
            },
          };
        },
        inject: [ConfigService, { token: DynamicConfigService, optional: true }],
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
          serviceName: 'auth-service',
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

      // SharedAuthModule - now working with RedisModule enabled and DISABLE_KAFKA=true
      imports.push(SharedAuthModule);
      console.log('[AppModule] Added SharedAuthModule');

      // Feature Modules - Gradually enabling core modules
      const featureModules = [
        // Core modules needed for authentication
        { name: 'AuditModule', module: AuditModule },
        { name: 'UsersModule', module: UsersModule },
        
        // Keycloak integration for SSO - temporarily disabled due to ESM issues
        // { name: 'KeycloakModule', module: KeycloakModule },
        
        // AuthModule dependencies - enabling before AuthModule
        { name: 'MfaModule', module: MfaModule },
        { name: 'SessionModule', module: SessionModule },
        { name: 'SecurityModule', module: SecurityModule },
        { name: 'SsoModule', module: SsoModule },
        
        // Enable AuthModule - all dependencies are now working
        { name: 'AuthModule', module: AuthModule },
        
        // Still disabled pending further testing:
        { name: 'SimpleHealthModule', module: SimpleHealthModule },
        // { name: 'ApiKeysModule', module: ApiKeysModule },
      ];
      
      console.log('[AppModule] Enabling core modules: AuditModule, UsersModule, MfaModule, SessionModule, SecurityModule, SsoModule');

      for (const { name, module } of featureModules) {
        if (module) {
          imports.push(module);
          console.log(`[AppModule] Added ${name}`);
        } else {
          console.error(`[AppModule] WARNING: ${name} is undefined!`);
        }
      }

      // DISABLED MonitoringModule due to dependency injection issues  
      // TODO: Fix monitoring package dependency injection before enabling
      console.log('[AppModule] MonitoringModule disabled - dependency injection issues');

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

      // Add providers - make DynamicConfigService globally available  
      const providers = [
        {
          ...dynamicConfigService,
          // Make provider available globally
        }
      ];

      const result = {
        module: AppModule,
        global: true, // Make entire module global so DynamicConfigService is available everywhere
        imports: validatedImports,
        controllers: [], // Controllers added by individual modules
        providers,
        exports: [DynamicConfigService], // Export for explicit imports
      };

      return result;
    } catch (error) {
      console.error('[AppModule] Error during module initialization:', error);
      console.error('[AppModule] Stack trace:', error.stack);
      throw error;
    }
  }
}
