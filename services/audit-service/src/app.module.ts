import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { AuditTrailModule } from './modules/audit-trail/audit-trail.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { AuditsModule } from './modules/audits/audits.module';
import { EventsModule } from './modules/events/events.module';
import { FindingsModule } from './modules/findings/findings.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './modules/redis/redis.module';
import { SOCAuditsModule } from './modules/soc-audits/soc-audits.module';
import { JwtStrategy } from './shared/strategies/jwt.strategy';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    // Determine environment file based on NODE_ENV
    const isTest = process.env.NODE_ENV === 'test';
    const envFilePath = isTest ? 'test/e2e/test.env' : '.env';

    imports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath,
        ignoreEnvFile: false,
        expandVariables: true,
      }),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'audit_service'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false, // Disabled to avoid schema conflicts
          logging: configService.get('NODE_ENV') === 'development',
        }),
        inject: [ConfigService],
      }),
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        maxListeners: 10,
        verboseMemoryLeak: true,
      }),
      ScheduleModule.forRoot(),
      HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
      }),
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD', 'soc_redis_pass'),
          },
        }),
        inject: [ConfigService],
      }),
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.registerAsync({
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          secret: configService.get('JWT_SECRET', 'your-secret-key'),
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION', '24h'),
          },
        }),
        inject: [ConfigService],
      }),
      HttpCommonModule.forRoot(),
      // Monitoring
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),
      RedisModule,
      AuditTrailModule,
      SOCAuditsModule,
      AuditsModule,
      FindingsModule,
      EventsModule,
      HealthModule
    );

    return {
      module: AppModule,
      imports,
      providers: [JwtStrategy],
    };
  }
}
