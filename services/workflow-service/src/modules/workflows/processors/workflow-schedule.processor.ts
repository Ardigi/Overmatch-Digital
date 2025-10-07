import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { WorkflowEngineService } from '../services/workflow-engine.service';
import type { WorkflowSchedulerService } from '../services/workflow-scheduler.service';

@Processor('workflow-schedule')
export class WorkflowScheduleProcessor {
  private readonly logger = new Logger(WorkflowScheduleProcessor.name);

  constructor(
    private workflowScheduler: WorkflowSchedulerService,
    private workflowEngine: WorkflowEngineService
  ) {}

  @Process('execute-scheduled-workflow')
  async handleScheduledExecution(
    job: Job<{
      scheduleId: string;
      workflowId: string;
      organizationId: string;
    }>
  ) {
    const { scheduleId, workflowId, organizationId } = job.data;
    this.logger.log(`Executing scheduled workflow: ${workflowId} (schedule: ${scheduleId})`);

    try {
      // Get schedule details
      const schedules = await this.workflowScheduler.getSchedules(organizationId);
      const schedule = schedules.find((s) => s.id === scheduleId);

      if (!schedule || !schedule.enabled) {
        this.logger.warn(`Schedule ${scheduleId} not found or disabled`);
        return;
      }

      // Start workflow instance
      const instanceId = await this.workflowEngine.startWorkflow(workflowId, schedule.inputs, {
        organizationId,
        userId: schedule.createdBy,
        metadata: {
          scheduledExecution: true,
          scheduleId,
          ...schedule.metadata,
        },
      });

      this.logger.log(`Scheduled workflow started with instance: ${instanceId}`);

      // Update schedule with last run time
      await this.workflowScheduler.updateSchedule(organizationId, scheduleId, {
        metadata: { ...schedule.metadata, lastRun: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Error executing scheduled workflow ${workflowId}: ${error.message}`,
        error.stack
      );
      // Don't throw - scheduled jobs should continue even if one execution fails
    }
  }

  @Process('update-schedule')
  async handleScheduleUpdate(
    job: Job<{
      scheduleId: string;
      organizationId: string;
      updates: any;
    }>
  ) {
    const { scheduleId, organizationId, updates } = job.data;
    this.logger.log(`Updating schedule: ${scheduleId}`);

    try {
      await this.workflowScheduler.updateSchedule(organizationId, scheduleId, updates);
      this.logger.log(`Schedule ${scheduleId} updated successfully`);
    } catch (error) {
      this.logger.error(`Error updating schedule: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('check-schedules')
  async handleScheduleCheck(job: Job) {
    this.logger.log('Checking all schedules for execution');

    try {
      // This job runs periodically to ensure schedules are executed
      // It's a backup mechanism in case the cron-based scheduling fails
      await this.workflowScheduler.processSchedules();
    } catch (error) {
      this.logger.error(`Error checking schedules: ${error.message}`, error.stack);
    }
  }
}
