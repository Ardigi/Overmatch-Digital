import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'client-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3002';
    process.env.SERVICE_PORT = '3002';
  }

  const appModule = await AppModule.forRoot();
  const app = await NestFactory.create(appModule);
  const configService = app.get(ConfigService);

  // CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = configService.get('CORS_ORIGINS')?.split(',') || [
        'http://localhost:3000',
        'http://localhost:8000', // Kong Gateway
      ];

      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-CSRF-Token', 'X-Total-Count'],
    maxAge: 86400, // 24 hours
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Removed API prefix for cleaner Kong routing
  // app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SOC Compliance Client Service')
    .setDescription('Client and Organization Management Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  console.log('Connecting to Kafka microservice...');
  // Connect to Kafka microservice
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'client-service',
        brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['kafka:29092'],
      },
      consumer: {
        groupId: 'client-service-consumer',
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('SERVICE_PORT') || 3002;
  await app.listen(port);

  console.log(`Client Service is running on: ${await app.getUrl()}`);
  console.log(`Documentation available at: ${await app.getUrl()}/api/docs`);
}

bootstrap();
