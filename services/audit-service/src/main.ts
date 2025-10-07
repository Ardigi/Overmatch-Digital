import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AuditService');

  try {
    // Set service identification for service discovery
    if (!process.env.SERVICE_NAME) {
      process.env.SERVICE_NAME = 'audit-service';
    }
    if (!process.env.SERVICE_PORT && !process.env.PORT) {
      process.env.PORT = '3008';
      process.env.SERVICE_PORT = '3008';
    }

    const appModule = await AppModule.forRoot();
    const app = await NestFactory.create(appModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);

    // Enable CORS
    app.enableCors({
      origin: configService.get('CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    // API prefix
    app.setGlobalPrefix('api/v1');

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('SOC Compliance Audit Service')
      .setDescription('Audit Trail and Compliance Tracking Service API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('audit-trail', 'Audit Trail Management')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Connect to Kafka microservice
    app.connectMicroservice({
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'audit-service',
          brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['localhost:9092'],
        },
        consumer: {
          groupId: 'audit-service-consumer',
        },
      },
    });

    // Start all microservices
    await app.startAllMicroservices();

    // Start HTTP server
    const port = configService.get('PORT') || 3008;
    await app.listen(port);

    logger.log(`Audit Service is running on: ${await app.getUrl()}`);
    logger.log(`Documentation available at: ${await app.getUrl()}/api/docs`);
  } catch (error) {
    logger.error('Failed to start Audit Service', error.stack);
    process.exit(1);
  }
}

bootstrap();
