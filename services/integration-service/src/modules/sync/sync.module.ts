import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SyncJob } from './entities/sync-job.entity';
import { SyncSchedule } from './entities/sync-schedule.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncJob, SyncSchedule]),
    BullModule.registerQueue({
      name: 'sync-jobs',
    }),
    ScheduleModule.forRoot(),
    IntegrationsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
