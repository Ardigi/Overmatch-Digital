import { BadRequestException, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const compression = require('compression');
const helmet = require('helmet');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { ValidationExceptionFilter } from './shared/filters/validation-exception.filter';
import { ErrorHandlingInterceptor } from './shared/interceptors/error-handling.interceptor';

async function bootstrap() {
  const logger = new Logger('PolicyService');

  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'policy-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3003';
    process.env.SERVICE_PORT = '3003';
  }

  const appModule = await AppModule.forRoot();
  const app = await NestFactory.create(appModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);
  const config = configService.get('policyService');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Custom validation error formatting
        return new BadRequestException(errors);
      },
    })
  );

  // Global exception filters (order matters - most specific first)
  app.useGlobalFilters(new ValidationExceptionFilter(), new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new ErrorHandlingInterceptor());

  // Enable versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Enable CORS
  app.enableCors(config.cors);

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Policy Service')
    .setDescription('Policy-as-Code Service with OPA integration for SOC compliance')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('policies', 'Policy management endpoints')
    .addTag('compliance', 'Compliance framework and control management')
    .addTag('opa', 'Open Policy Agent integration')
    .addTag('assessment', 'Compliance assessment and reporting')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Connect to Kafka microservice
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
      },
      consumer: {
        groupId: config.kafka.consumerGroup,
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();
  logger.log('Microservices started successfully');

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = config.port;
  await app.listen(port);
  logger.log(`Policy Service is running on port ${port}`);
  logger.log(`API Documentation available at http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  const logger = new Logger('PolicyService');
  logger.error('Failed to start Policy Service:', err);
  process.exit(1);
});
