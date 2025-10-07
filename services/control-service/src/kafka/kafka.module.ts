import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Module({})
export class KafkaModule {
  static forRoot(): DynamicModule {
    const disableKafka = process.env.DISABLE_KAFKA === 'true';
    
    if (disableKafka) {
      console.log('Kafka module disabled via DISABLE_KAFKA environment variable');
      return {
        module: KafkaModule,
        providers: [
          {
            provide: 'KAFKA_CLIENT',
            useValue: null, // Provide null client when Kafka is disabled
          },
          KafkaService,
        ],
        exports: [KafkaService],
      };
    }
    
    return {
      module: KafkaModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'KAFKA_CLIENT',
            useFactory: (configService: ConfigService) => ({
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId: 'control-service',
                  brokers: process.env.KAFKA_BROKERS?.split(',') || configService.get('kafka.brokers') || ['localhost:9092'],
                },
                producer: {
                  allowAutoTopicCreation: true,
                },
              },
            }),
            inject: [ConfigService],
          },
        ]),
      ],
      providers: [KafkaService],
      exports: [KafkaService],
    };
  }
}
