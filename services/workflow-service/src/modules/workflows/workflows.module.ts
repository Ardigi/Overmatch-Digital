import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
// Controllers
import { WorkflowsController } from './controllers/workflows.controller';
import { WorkflowInstancesController } from './workflow-instances.controller';
import { WorkflowTemplatesController } from './workflow-templates.controller';
// Entities
import { Workflow } from './entities/workflow.entity';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { WorkflowStepExecution } from './entities/workflow-step-execution.entity';
import { WorkflowTemplate } from './entities/workflow-template.entity';
// Processors
import { WorkflowProcessor } from './processors/workflow.processor';
import { WorkflowScheduleProcessor } from './processors/workflow-schedule.processor';
import { StepExecutorService } from './services/step-executor.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowSchedulerService } from './services/workflow-scheduler.service';
// Services
import { WorkflowsService } from './services/workflows.service';
import { WorkflowInstancesService } from './workflow-instances.service';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowStateMachineService } from './services/workflow-state-machine.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workflow,
      WorkflowStep,
      WorkflowInstance,
      WorkflowStepExecution,
      WorkflowTemplate,
    ]),
    BullModule.registerQueue(
      {
        name: 'workflow',
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      },
      {
        name: 'workflow-schedule',
        defaultJobOptions: {
          removeOnComplete: false,
          removeOnFail: false,
        },
      }
    ),
    ScheduleModule.forRoot(),
    HttpModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [
    WorkflowsService,
    WorkflowInstancesService,
    WorkflowTemplatesService,
    WorkflowEngineService,
    StepExecutorService,
    WorkflowSchedulerService,
    WorkflowStateMachineService,
    WorkflowProcessor,
    WorkflowScheduleProcessor,
    MetricsService,
    TracingService,
    LoggingService,
  ],
  controllers: [
    WorkflowsController,
    WorkflowInstancesController,
    WorkflowTemplatesController,
  ],
  exports: [
    WorkflowsService,
    WorkflowInstancesService,
    WorkflowTemplatesService,
    WorkflowEngineService,
    WorkflowSchedulerService,
  ],
})
export class WorkflowsModule {}
