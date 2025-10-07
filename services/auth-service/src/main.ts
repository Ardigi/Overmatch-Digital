import 'reflect-metadata';
import { BadRequestException, ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'auth-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3001';
    process.env.SERVICE_PORT = '3001';
  }

  const appModule = await AppModule.forRoot();
  const app = await NestFactory.create(appModule);
  const configService = app.get(ConfigService);

  // Configure body parser limits (NestJS v11 + Express v5 compatibility)
  // Remove manual Express middleware - let NestJS handle body parsing
  // app.use(express.json({ limit: '10mb' }));
  // app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Enable CORS
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

  // Global validation pipe with enhanced configuration for NestJS v11
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
      forbidNonWhitelisted: false,
      disableErrorMessages: false,
      validateCustomDecorators: true,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      exceptionFactory: (errors) => {
        logger.error('ValidationPipe errors:', JSON.stringify(errors, null, 2));
        const formattedErrors = errors.map(error => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints || {},
          children: error.children || [],
        }));
        
        const exception = new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: formattedErrors,
        });
        
        logger.error('Throwing ValidationPipe exception:', exception.getResponse());
        return exception;
      },
    })
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SOC Compliance Auth Service')
    .setDescription('Authentication and Authorization Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Connect to Kafka microservice
  console.log('Connecting to Kafka microservice...');
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'auth-service',
        brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['kafka:29092'],
      },
      consumer: {
        groupId: 'auth-service-consumer',
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`Auth Service is running on: ${await app.getUrl()}`);
  console.log(`Documentation available at: ${await app.getUrl()}/api/docs`);
}

bootstrap();
