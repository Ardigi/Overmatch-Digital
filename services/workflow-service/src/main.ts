import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'workflow-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3006';
    process.env.SERVICE_PORT = '3006';
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3006);
  const env = configService.get<string>('environment', 'development');

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: configService.get<string[]>('cors.origins', ['http://localhost:3000']),
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // Global prefix
  app.setGlobalPrefix('api');

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
  if (env !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Workflow Service API')
      .setDescription('SOC Compliance Platform - Workflow Service')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Workflows', 'Workflow management endpoints')
      .addTag('Health', 'Health check endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Start server
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Workflow Service is running on port ${port} in ${env} mode`);
  logger.log(`Health check available at: http://localhost:${port}/health`);

  if (env !== 'production') {
    logger.log(`API documentation available at: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start Workflow Service:', error);
  process.exit(1);
});
