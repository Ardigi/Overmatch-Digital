import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuditsModule } from '../audits/audits.module';
import { SharedClientModule } from '../shared-client/shared-client.module';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaProducerService } from './kafka-producer.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'client-service',
              brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['kafka:9092'],
            },
            consumer: {
              groupId: 'client-service-consumer',
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    SharedClientModule, // Provides core services without circular dependencies
    AuditsModule,
  ],
  providers: [KafkaConsumerService, KafkaProducerService],
  exports: [ClientsModule, KafkaProducerService],
})
export class EventsModule {}
