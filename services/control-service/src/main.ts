import { Logger } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'control-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3004';
    process.env.SERVICE_PORT = '3004';
  }

  const appModule = await AppModule.forRoot();
  const app = await NestFactory.create(appModule);
  const logger = new Logger('ControlService');
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Security headers with helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"], scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"], objectSrc: ["'none'"]
      }
    },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true, xssFilter: true
  }));
  // Rate limiting
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: configService.get('RATE_LIMIT_MAX', 1000),
    message: { error: 'Too many requests', retryAfter: '15 minutes' },
    standardHeaders: true
  }));
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
    .setTitle('SOC Compliance Control Service')
    .setDescription('Control Management and Testing Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('controls', 'Control Management')
    .addTag('control-tests', 'Control Testing')
    .addTag('control-implementation', 'Control Implementation')
    .addTag('control-mapping', 'Control Mapping')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // DISABLED Kafka microservice - following Auth Service pattern
  // TODO: Enable when Kafka infrastructure is properly configured
  // Connect to Kafka microservice
  console.log('Connecting to Kafka microservice...');
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'control-service',
        brokers: process.env.KAFKA_BROKERS?.split(',') || configService.get('kafka.brokers') || ['kafka:29092'],
      },
      consumer: {
        groupId: 'control-service-consumer',
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('PORT') || 3004;
  await app.listen(port);

  logger.log(`Control Service (SECURED) running on port: ${port}`);
  logger.log(`Documentation available at: ${await app.getUrl()}/api/docs`);
}

bootstrap();
