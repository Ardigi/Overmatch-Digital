import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('IntegrationService');

  try {
    // Set service identification for service discovery
    if (!process.env.SERVICE_NAME) {
      process.env.SERVICE_NAME = 'integration-service';
    }
    if (!process.env.SERVICE_PORT && !process.env.PORT) {
      process.env.PORT = '3009';
      process.env.SERVICE_PORT = '3009';
    }

    const appModule = await AppModule.forRoot();
    const app = await NestFactory.create(appModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);

    // Enable CORS
    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = configService.get('CORS_ORIGINS')?.split(',') || [
          'http://localhost:3000',
          'http://localhost:8000', // Kong Gateway
        ];

        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Requested-With',
        'X-Webhook-Signature',
      ],
      exposedHeaders: ['X-CSRF-Token', 'X-Total-Count', 'X-Webhook-Id'],
      maxAge: 86400, // 24 hours
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

    // API prefix
    app.setGlobalPrefix('api/v1');

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('SOC Compliance Integration Service')
      .setDescription('External System Integration and Synchronization Service API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('integrations', 'Integration management endpoints')
      .addTag('webhooks', 'Webhook configuration and delivery')
      .addTag('sync', 'Data synchronization operations')
      .addTag('health', 'Service health checks')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Connect to Kafka microservice
    const kafkaBrokers = configService.get('KAFKA_BROKERS')?.split(',') || ['localhost:9092'];

    app.connectMicroservice({
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'integration-service',
          brokers: kafkaBrokers,
        },
        consumer: {
          groupId: 'integration-service-consumer',
          sessionTimeout: 30000,
          heartbeatInterval: 3000,
        },
        subscribe: {
          fromBeginning: false,
        },
      },
    });

    // Start all microservices
    await app.startAllMicroservices();
    logger.log('Kafka microservice started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM signal received: closing HTTP server');
      await app.close();
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT signal received: closing HTTP server');
      await app.close();
    });

    // Start HTTP server
    const port = configService.get('PORT') || 3009;
    await app.listen(port);

    logger.log(`Integration Service is running on: ${await app.getUrl()}`);
    logger.log(`Documentation available at: ${await app.getUrl()}/api/docs`);
    logger.log(`Health check available at: ${await app.getUrl()}/api/v1/health`);
  } catch (error) {
    logger.error('Failed to start Integration Service', error.stack);
    process.exit(1);
  }
}

bootstrap();
