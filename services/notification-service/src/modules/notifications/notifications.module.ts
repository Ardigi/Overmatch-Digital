import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from '../kafka/kafka.module';
import { ProvidersModule } from '../providers/providers.module';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationQueueProcessor } from './processors/notification-queue.processor';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { NotificationTemplatesService } from './services/notification-templates.service';
import { UserDataService } from './services/user-data.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationTemplate, NotificationPreference]),
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    KafkaModule,
    ProvidersModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationTemplatesService,
    NotificationPreferencesService,
    NotificationQueueProcessor,
    UserDataService,
  ],
  exports: [
    NotificationsService,
    NotificationTemplatesService,
    NotificationPreferencesService,
    UserDataService,
  ],
})
export class NotificationsModule {}
