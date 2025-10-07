import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bull';
import type { ScheduleWorkflowDto } from '../dto';
import type { WorkflowEngineService } from './workflow-engine.service';

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  organizationId: string;
  cron: string;
  timezone: string;
  inputs: Record<string, any>;
  enabled: boolean;
  metadata?: Record<string, any>;
  description?: string;
  createdBy: string;
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

@Injectable()
export class WorkflowSchedulerService {
  private readonly logger = new Logger(WorkflowSchedulerService.name);
  private schedules: Map<string, WorkflowSchedule> = new Map();

  constructor(
    @InjectQueue('workflow-schedule')
    private scheduleQueue: Queue,
    private workflowEngine: WorkflowEngineService,
    private eventEmitter: EventEmitter2,
  ) {
    this.loadSchedules();
  }

  async scheduleWorkflow(
    organizationId: string,
    workflowId: string,
    dto: ScheduleWorkflowDto,
    userId: string
  ): Promise<WorkflowSchedule> {
    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const schedule: WorkflowSchedule = {
      id: scheduleId,
      workflowId,
      organizationId,
      cron: dto.cron,
      timezone: dto.timezone || 'UTC',
      inputs: dto.inputs,
      enabled: dto.enabled !== false,
      metadata: dto.metadata,
      description: dto.description,
      createdBy: userId,
      createdAt: new Date(),
      nextRun: this.calculateNextRun(dto.cron),
    };

    // Save schedule
    this.schedules.set(scheduleId, schedule);
    await this.persistSchedule(schedule);

    // Queue the schedule if enabled
    if (schedule.enabled) {
      await this.queueSchedule(schedule);
    }

    this.eventEmitter.emit('workflow.schedule.created', {
      scheduleId,
      workflowId,
      cron: dto.cron,
      createdBy: userId,
    });

    return schedule;
  }

  async getSchedules(
    organizationId: string,
    workflowId?: string
  ): Promise<WorkflowSchedule[]> {
    const schedules = Array.from(this.schedules.values())
      .filter(schedule => 
        schedule.organizationId === organizationId &&
        (!workflowId || schedule.workflowId === workflowId)
      );

    return schedules;
  }

  async cancelSchedule(
    organizationId: string,
    scheduleId: string
  ): Promise<{ success: boolean }> {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (schedule.organizationId !== organizationId) {
      throw new NotFoundException('Schedule not found');
    }

    // Remove from Bull queue
    await this.removeScheduleFromQueue(scheduleId);

    // Remove from memory
    this.schedules.delete(scheduleId);

    // Persist deletion
    await this.deletePersistedSchedule(scheduleId);

    this.eventEmitter.emit('workflow.schedule.cancelled', {
      scheduleId,
      workflowId: schedule.workflowId,
    });

    return { success: true };
  }

  async updateSchedule(
    organizationId: string,
    scheduleId: string,
    updates: Partial<ScheduleWorkflowDto>
  ): Promise<WorkflowSchedule> {
    const schedule = this.schedules.get(scheduleId);
    
    if (!schedule || schedule.organizationId !== organizationId) {
      throw new NotFoundException('Schedule not found');
    }

    // Update schedule
    Object.assign(schedule, updates);
    
    if (updates.cron) {
      schedule.nextRun = this.calculateNextRun(updates.cron);
    }

    // Re-queue if cron changed or enabled status changed
    if (updates.cron !== undefined || updates.enabled !== undefined) {
      await this.removeScheduleFromQueue(scheduleId);
      
      if (schedule.enabled) {
        await this.queueSchedule(schedule);
      }
    }

    // Persist updates
    await this.persistSchedule(schedule);

    this.eventEmitter.emit('workflow.schedule.updated', {
      scheduleId,
      updates,
    });

    return schedule;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processSchedules(): Promise<void> {
    // This method checks for schedules that need to run
    // In production, this would be handled by the Bull queue with cron jobs
    const now = new Date();
    
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled && this.shouldRunSchedule(schedule, now)) {
        await this.executeScheduledWorkflow(schedule);
      }
    }
  }

  private async executeScheduledWorkflow(schedule: WorkflowSchedule): Promise<void> {
    try {
      this.logger.log(`Executing scheduled workflow ${schedule.workflowId}`);

      const instanceId = await this.workflowEngine.startWorkflow(
        schedule.workflowId,
        schedule.inputs,
        {
          organizationId: schedule.organizationId,
          userId: schedule.createdBy,
          metadata: {
            ...schedule.metadata,
            scheduledExecution: true,
            scheduleId: schedule.id,
          },
        }
      );

      // Update schedule
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(schedule.cron);
      await this.persistSchedule(schedule);

      this.eventEmitter.emit('workflow.schedule.executed', {
        scheduleId: schedule.id,
        workflowId: schedule.workflowId,
        instanceId,
      });
    } catch (error) {
      this.logger.error(`Failed to execute scheduled workflow: ${error.message}`, error.stack);
      
      this.eventEmitter.emit('workflow.schedule.failed', {
        scheduleId: schedule.id,
        workflowId: schedule.workflowId,
        error: error.message,
      });
    }
  }

  private async queueSchedule(schedule: WorkflowSchedule): Promise<void> {
    // Add to Bull queue with cron repeat
    await this.scheduleQueue.add(
      'execute-scheduled-workflow',
      {
        scheduleId: schedule.id,
        workflowId: schedule.workflowId,
        organizationId: schedule.organizationId,
      },
      {
        repeat: {
          cron: schedule.cron,
          tz: schedule.timezone,
        },
        jobId: schedule.id, // Use schedule ID as job ID for easy management
      }
    );
  }

  private async removeScheduleFromQueue(scheduleId: string): Promise<void> {
    try {
      const jobs = await this.scheduleQueue.getRepeatableJobs();
      const job = jobs.find(j => j.id === scheduleId);
      
      if (job) {
        await this.scheduleQueue.removeRepeatableByKey(job.key);
      }
    } catch (error) {
      this.logger.error(`Error removing schedule from queue: ${error.message}`);
    }
  }

  private calculateNextRun(cron: string): Date {
    // Simple implementation - in production use a proper cron parser
    // This is a placeholder that returns next hour
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  private shouldRunSchedule(schedule: WorkflowSchedule, now: Date): boolean {
    if (!schedule.nextRun) {
      return false;
    }
    
    return now >= schedule.nextRun;
  }

  private async loadSchedules(): Promise<void> {
    // Load schedules from persistent storage
    // This is a placeholder - implement actual loading from database
    this.logger.log('Loading workflow schedules');
  }

  private async persistSchedule(schedule: WorkflowSchedule): Promise<void> {
    // Persist schedule to database
    // This is a placeholder - implement actual persistence
    this.logger.debug(`Persisting schedule ${schedule.id}`);
  }

  private async deletePersistedSchedule(scheduleId: string): Promise<void> {
    // Delete schedule from database
    // This is a placeholder - implement actual deletion
    this.logger.debug(`Deleting persisted schedule ${scheduleId}`);
  }

  async getScheduleStats(organizationId: string): Promise<any> {
    const schedules = await this.getSchedules(organizationId);
    
    return {
      total: schedules.length,
      enabled: schedules.filter(s => s.enabled).length,
      disabled: schedules.filter(s => !s.enabled).length,
      byWorkflow: schedules.reduce((acc, schedule) => {
        acc[schedule.workflowId] = (acc[schedule.workflowId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getUpcomingExecutions(
    organizationId: string,
    limit: number = 10
  ): Promise<Array<{ schedule: WorkflowSchedule; nextRun: Date }>> {
    const schedules = await this.getSchedules(organizationId);
    
    return schedules
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => a.nextRun!.getTime() - b.nextRun!.getTime())
      .slice(0, limit)
      .map(schedule => ({
        schedule,
        nextRun: schedule.nextRun!,
      }));
  }
}