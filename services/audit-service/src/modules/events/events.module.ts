import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { EventsController } from './events.controller';

@Module({
  imports: [AuditTrailModule],
  controllers: [EventsController],
})
export class EventsModule {}
