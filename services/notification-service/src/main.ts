import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('NotificationService');

  try {
    // Set service identification for service discovery
    if (!process.env.SERVICE_NAME) {
      process.env.SERVICE_NAME = 'notification-service';
    }
    if (!process.env.SERVICE_PORT && !process.env.PORT) {
      process.env.PORT = '3010';
      process.env.SERVICE_PORT = '3010';
    }

    const appModule = await AppModule.forRoot();
    const app = await NestFactory.create(appModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get('PORT') || 3010;

    // Enable CORS
    app.enableCors({
      origin: configService.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    // API Documentation
    if (configService.get('NODE_ENV') !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Notification Service API')
        .setDescription('SOC Compliance Platform - Notification Service')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api', app, document);
    }

    await app.listen(port);
    logger.log(`🚀 Notification Service is running on: http://localhost:${port}`);
    logger.log(`📚 API Documentation available at: http://localhost:${port}/api`);
  } catch (error) {
    logger.error('Failed to start Notification Service', error.stack);
    process.exit(1);
  }
}

bootstrap();
