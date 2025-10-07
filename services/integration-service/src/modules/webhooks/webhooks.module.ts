import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookService } from './services/webhook.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEndpoint, WebhookEvent]),
    BullModule.registerQueue({
      name: 'webhook-delivery',
    }),
    HttpModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhookService, WebhookDeliveryService],
  exports: [WebhookService, WebhookDeliveryService],
})
export class WebhooksModule {}
