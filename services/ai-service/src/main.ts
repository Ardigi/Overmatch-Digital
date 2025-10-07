import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AIService');

  try {
    // Set service identification for service discovery
    if (!process.env.SERVICE_NAME) {
      process.env.SERVICE_NAME = 'ai-service';
    }
    if (!process.env.SERVICE_PORT && !process.env.PORT) {
      process.env.PORT = '3011';
      process.env.SERVICE_PORT = '3011';
    }

    const appModule = await AppModule.forRoot();
    const app = await NestFactory.create(appModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') || 3011;

    // Enable CORS
    app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    // Set global prefix
    app.setGlobalPrefix('api');

    // Enable versioning
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
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

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('AI Service API')
      .setDescription('AI-powered analysis and recommendations for SOC compliance')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('AI Analysis', 'Compliance analysis and risk assessment')
      .addTag('Framework Mappings', 'Framework control mappings')
      .addTag('Predictions', 'Predictive analytics')
      .addTag('Remediation', 'Remediation recommendations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Graceful shutdown
    app.enableShutdownHooks();

    await app.listen(port);
    logger.log(`AI Service is running on: http://localhost:${port}`);
    logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  } catch (error) {
    logger.error('Failed to start AI Service', error.stack);
    process.exit(1);
  }
}

bootstrap();
