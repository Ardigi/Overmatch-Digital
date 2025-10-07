import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Set service identification for service discovery
  if (!process.env.SERVICE_NAME) {
    process.env.SERVICE_NAME = 'evidence-service';
  }
  if (!process.env.SERVICE_PORT && !process.env.PORT) {
    process.env.PORT = '3005';
    process.env.SERVICE_PORT = '3005';
  }

  const appModule = await AppModule.forRoot();
  const app = await NestFactory.create(appModule);
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
    .setTitle('SOC Compliance Evidence Service')
    .setDescription('Evidence Collection and Management Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('evidence', 'Evidence Management')
    .addTag('collection', 'Automated Evidence Collection')
    .addTag('screenshots', 'Screenshot Evidence')
    .addTag('cloud-providers', 'Cloud Provider Integration')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Connect to Kafka microservice
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'evidence-service',
        brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['localhost:9092'],
      },
      consumer: {
        groupId: 'evidence-service-consumer',
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('PORT') || 3005;
  await app.listen(port);
}

bootstrap();
