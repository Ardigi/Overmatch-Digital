import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationRule } from './entities/notification-rule.entity';
import { NotificationRuleHistory } from './entities/notification-rule-history.entity';
import { RuleEvaluationMetrics } from './entities/rule-evaluation-metrics.entity';
import { EventNotificationMapping } from './entities/event-notification-mapping.entity';
import { NotificationRulesService } from './notification-rules.service';
import { RuleEvaluationService } from './rule-evaluation.service';
import { RuleManagementController } from './rule-management.controller';
import { CacheModule } from '@soc-compliance/cache-common';
import { CacheModule as AppCacheModule } from '../cache/cache.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationRule,
      NotificationRuleHistory,
      RuleEvaluationMetrics,
      EventNotificationMapping,
    ]),
    CacheModule,
    AppCacheModule,
    MonitoringModule,
  ],
  controllers: [RuleManagementController],
  providers: [
    NotificationRulesService,
    RuleEvaluationService,
  ],
  exports: [
    NotificationRulesService,
    RuleEvaluationService,
  ],
})
export class RulesModule {}