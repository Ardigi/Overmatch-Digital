import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('ReportingService');

  try {
    // Set service identification for service discovery
    if (!process.env.SERVICE_NAME) {
      process.env.SERVICE_NAME = 'reporting-service';
    }
    if (!process.env.SERVICE_PORT && !process.env.PORT) {
      process.env.PORT = '3007';
      process.env.SERVICE_PORT = '3007';
    }

    const appModule = await AppModule.forRoot();
    const app = await NestFactory.create(appModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3007);
    const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
    });

    // Global prefix
    app.setGlobalPrefix(apiPrefix);

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('SOC Compliance Reporting Service')
      .setDescription('Service for generating and managing compliance reports')
      .setVersion('1.0')
      .addTag('reports', 'Report generation and management')
      .addTag('templates', 'Report template management')
      .addTag('schedules', 'Report scheduling')
      .addTag('analytics', 'Reporting analytics')
      .addTag('health', 'Health checks')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

    // Graceful shutdown
    app.enableShutdownHooks();

    await app.listen(port);
    logger.log(`Reporting service is running on port ${port}`);
    logger.log(`API documentation available at http://localhost:${port}/${apiPrefix}/docs`);
    logger.log(`Health check available at http://localhost:${port}/health`);
  } catch (error) {
    logger.error('Failed to start Reporting Service', error.stack);
    process.exit(1);
  }
}

bootstrap();
