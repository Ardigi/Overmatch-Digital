import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RulesModule } from '../rules/rules.module';
import { UsersModule } from '../users/users.module';
import { KafkaModule } from '../kafka/kafka.module';

// Event Handlers
import { UserEventHandler } from './handlers/user-event.handler';
import { PolicyEventHandler } from './handlers/policy-event.handler';
import { ControlEventHandler } from './handlers/control-event.handler';
import { EvidenceEventHandler } from './handlers/evidence-event.handler';
import { AuditEventHandler } from './handlers/audit-event.handler';
import { WorkflowEventHandler } from './handlers/workflow-event.handler';
import { ReportEventHandler } from './handlers/report-event.handler';
import { EventHandlerService } from './event-handler.service';
import { KafkaEventsController } from './kafka-events.controller';

@Module({
  imports: [
    NotificationsModule,
    RulesModule,
    UsersModule,
    KafkaModule,
  ],
  controllers: [KafkaEventsController],
  providers: [
    EventHandlerService,
    UserEventHandler,
    PolicyEventHandler,
    ControlEventHandler,
    EvidenceEventHandler,
    AuditEventHandler,
    WorkflowEventHandler,
    ReportEventHandler,
  ],
  exports: [EventHandlerService],
})
export class EventsModule {}