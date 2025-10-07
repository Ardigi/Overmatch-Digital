import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService, ServiceResponse } from '@soc-compliance/http-common';
import { CronJob } from 'cron';
import * as cronParser from 'cron-parser';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Report, type ReportFormat } from '../entities/report.entity';
import { ReportSchedule } from '../entities/report-schedule.entity';
import type { ReportGeneratorService } from './report-generator.service';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepository: Repository<ReportSchedule>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly generatorService: ReportGeneratorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceDiscovery: ServiceDiscoveryService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    // Load and register all active schedules
    const activeSchedules = await this.scheduleRepository.find({
      where: { isActive: true },
      relations: ['reportTemplate'],
    });

    for (const schedule of activeSchedules) {
      try {
        await this.registerSchedule(schedule);
      } catch (error) {
        this.logger.error(`Failed to register schedule ${schedule.id}`, error);
      }
    }
  }

  async createSchedule(data: any): Promise<ReportSchedule> {
    // Validate cron expression
    try {
      cronParser.parseExpression(data.cronExpression);
    } catch (error) {
      throw new BadRequestException('Invalid cron expression');
    }

    // Create schedule
    const schedule = this.scheduleRepository.create(data) as unknown as ReportSchedule;
    
    // Calculate next run time
    schedule.nextRunAt = this.calculateNextRunTime(data.cronExpression, data.timezone);
    
    const savedSchedule = await this.scheduleRepository.save(schedule);

    // Register schedule if active
    if (savedSchedule.isActive) {
      await this.registerSchedule(savedSchedule);
    }

    return savedSchedule;
  }

  async updateSchedule(
    scheduleId: string,
    organizationId: string,
    data: any,
  ): Promise<ReportSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, organizationId },
      relations: ['reportTemplate'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Validate cron expression if changed
    if (data.cronExpression && data.cronExpression !== schedule.cronExpression) {
      try {
        cronParser.parseExpression(data.cronExpression);
      } catch (error) {
        throw new BadRequestException('Invalid cron expression');
      }
    }

    // Unregister existing cron job
    this.unregisterSchedule(scheduleId);

    // Update schedule
    Object.assign(schedule, data);
    
    // Recalculate next run time if cron changed
    if (data.cronExpression || data.timezone) {
      schedule.nextRunAt = this.calculateNextRunTime(
        schedule.cronExpression,
        schedule.timezone,
      );
    }

    await this.scheduleRepository.save(schedule);

    // Re-register if active
    if (schedule.isActive) {
      await this.registerSchedule(schedule);
    }

    return schedule;
  }

  async deleteSchedule(scheduleId: string, organizationId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Unregister cron job
    this.unregisterSchedule(scheduleId);

    // Delete schedule
    await this.scheduleRepository.remove(schedule);
  }

  async runScheduleNow(scheduleId: string, organizationId: string): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, organizationId },
      relations: ['reportTemplate'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Execute schedule
    await this.executeSchedule(schedule);
  }

  private async registerSchedule(schedule: ReportSchedule): Promise<void> {
    try {
      const job = new CronJob(
        schedule.cronExpression,
        async () => {
          await this.executeSchedule(schedule);
        },
        null,
        true,
        schedule.timezone,
      );

      this.schedulerRegistry.addCronJob(`schedule-${schedule.id}`, job as any);
      this.logger.log(`Registered schedule ${schedule.id} with cron ${schedule.cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to register schedule ${schedule.id}`, error);
      throw error;
    }
  }

  private unregisterSchedule(scheduleId: string): void {
    try {
      const jobName = `schedule-${scheduleId}`;
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
        this.logger.log(`Unregistered schedule ${scheduleId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to unregister schedule ${scheduleId}`, error);
    }
  }

  private async executeSchedule(schedule: ReportSchedule): Promise<void> {
    this.logger.log(`Executing schedule ${schedule.id}`);
    
    try {
      // Update execution count
      schedule.executionCount++;
      schedule.lastRunAt = new Date();
      
      // Calculate period based on schedule
      const { periodStart, periodEnd } = this.calculateReportPeriod(schedule);

      // Create report
      const report = this.reportRepository.create({
        organizationId: schedule.organizationId,
        templateId: schedule.reportTemplateId,
        reportType: schedule.reportTemplate?.reportType || 'SCHEDULED',
        title: this.generateReportTitle(schedule, periodStart, periodEnd),
        description: `Scheduled report generated by ${schedule.name}`,
        format: schedule.format as ReportFormat,
        parameters: {
          ...schedule.parameters,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
        filters: schedule.filters,
        periodStart,
        periodEnd,
        generatedBy: 'system',
      });

      await this.reportRepository.save(report);

      // Generate report
      const result = await this.generatorService.generate({
        reportId: report.id,
        organizationId: schedule.organizationId,
        userId: 'system',
        templateId: schedule.reportTemplateId,
        format: schedule.format,
        filters: schedule.filters,
      });

      if (result.success) {
        schedule.successCount++;
        
        // Deliver report
        await this.deliverReport(schedule, report, result);
      } else {
        schedule.failureCount++;
        schedule.lastError = result.error || 'Report generation failed';
        schedule.lastErrorAt = new Date();
      }

      // Calculate next run time
      schedule.nextRunAt = this.calculateNextRunTime(
        schedule.cronExpression,
        schedule.timezone,
      );

      await this.scheduleRepository.save(schedule);

      // Emit event
      await this.eventEmitter.emit('schedule.executed', {
        scheduleId: schedule.id,
        reportId: report.id,
        success: result.success,
      });
    } catch (error) {
      this.logger.error(`Failed to execute schedule ${schedule.id}`, error);
      
      schedule.failureCount++;
      schedule.lastError = error.message;
      schedule.lastErrorAt = new Date();
      
      await this.scheduleRepository.save(schedule);
    }
  }

  private async deliverReport(
    schedule: ReportSchedule,
    report: Report,
    result: any,
  ): Promise<void> {
    switch (schedule.deliveryMethod) {
      case 'email':
        await this.deliverViaEmail(schedule, report, result);
        break;
      case 'webhook':
        await this.deliverViaWebhook(schedule, report, result);
        break;
      case 'storage':
        // Report is already stored, just log
        this.logger.log(`Report ${report.id} stored for schedule ${schedule.id}`);
        break;
    }
  }

  private async deliverViaEmail(
    schedule: ReportSchedule,
    report: Report,
    result: any,
  ): Promise<void> {
    try {
      const notificationPayload = {
        type: 'report-delivery',
        recipients: schedule.recipients,
        subject: this.interpolateTemplate(
          schedule.deliveryConfig?.emailSubject || 'Scheduled Report: {{report.name}}',
          { report, schedule },
        ),
        body: this.interpolateTemplate(
          schedule.deliveryConfig?.emailBody || 'Please find attached the scheduled report: {{report.name}}',
          { report, schedule },
        ),
        attachments: result.fileUrl ? [{
          filename: `${report.title}-${new Date().toISOString().split('T')[0]}.${result.format || 'pdf'}`,
          url: result.fileUrl,
          contentType: this.getContentType(result.format || 'pdf'),
        }] : [],
        metadata: {
          reportId: report.id,
          reportName: report.title,
          scheduleId: schedule.id,
          generatedAt: new Date().toISOString(),
          organizationId: report.organizationId,
        },
        priority: schedule.deliveryConfig?.priority || 'normal',
      };
      
      // Send to notification service
      const response = await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/api/notifications/send',
        notificationPayload
      ) as ServiceResponse<{ id: string; status: string }>;
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send notification');
      }
      
      this.logger.log(`Report ${report.id} delivered via email to ${schedule.recipients.join(', ')}`);
      
      // Emit success event
      await this.eventEmitter.emit('report.email.sent', {
        reportId: report.id,
        recipients: schedule.recipients,
        notificationId: response.data?.id,
      });
    } catch (error) {
      this.logger.error(`Failed to deliver report ${report.id} via email`, error);
      
      // Emit failure event
      await this.eventEmitter.emit('report.email.failed', {
        reportId: report.id,
        recipients: schedule.recipients,
        error: error.message,
      });
      
      throw error;
    }
  }
  
  private getContentType(format: string): string {
    const contentTypes = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      html: 'text/html',
    };
    return contentTypes[format] || 'application/octet-stream';
  }

  private async deliverViaWebhook(
    schedule: ReportSchedule,
    report: Report,
    result: any,
  ): Promise<void> {
    const webhookUrl = schedule.deliveryConfig?.webhookUrl;
    if (!webhookUrl) {
      throw new BadRequestException('Webhook URL not configured for this schedule');
    }
    
    try {
      const webhookPayload = {
        event: 'report.generated',
        timestamp: new Date().toISOString(),
        report: {
          id: report.id,
          name: report.title,
          type: report.reportType,
          format: result.format || 'pdf',
          generatedAt: new Date().toISOString(),
          fileUrl: result.fileUrl,
          metadata: report.metadata,
        },
        schedule: {
          id: schedule.id,
          name: schedule.name,
          cronExpression: schedule.cronExpression,
        },
        organizationId: report.organizationId,
        ...(schedule.deliveryConfig?.webhookPayload || {}),
      };
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Report-Event': 'report.generated',
        'X-Report-Id': report.id,
        'X-Schedule-Id': schedule.id,
        ...(schedule.deliveryConfig?.webhookHeaders || {}),
      };
      
      // Add webhook authentication if configured
      if (schedule.deliveryConfig?.webhookAuth) {
        const auth = schedule.deliveryConfig.webhookAuth;
        if (auth.type === 'bearer') {
          headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.type === 'api-key') {
          headers[auth.headerName || 'X-API-Key'] = auth.key;
        } else if (auth.type === 'basic') {
          const basicAuth = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${basicAuth}`;
        }
      }
      
      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, webhookPayload, {
          headers,
          timeout: schedule.deliveryConfig?.webhookTimeout || 30000,
        }),
      );
      
      this.logger.log(`Report ${report.id} delivered via webhook to ${webhookUrl} - Status: ${response.status}`);
      
      // Emit success event
      await this.eventEmitter.emit('report.webhook.sent', {
        reportId: report.id,
        webhookUrl,
        responseStatus: response.status,
        responseData: response.data,
      });
    } catch (error) {
      this.logger.error(`Failed to deliver report ${report.id} via webhook to ${webhookUrl}`, error);
      
      // Emit failure event
      await this.eventEmitter.emit('report.webhook.failed', {
        reportId: report.id,
        webhookUrl,
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data,
      });
      
      throw error;
    }
  }

  private calculateReportPeriod(schedule: ReportSchedule): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    // Determine period based on cron pattern
    if (schedule.cronExpression.includes('0 0 1 * *')) {
      // Monthly - previous month
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (schedule.cronExpression.includes('0 0 * * 1')) {
      // Weekly - previous week
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - daysToMonday - 7);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
    } else {
      // Default - last 30 days
      periodEnd = new Date(now);
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);
    }

    return { periodStart, periodEnd };
  }

  private generateReportTitle(
    schedule: ReportSchedule,
    periodStart: Date,
    periodEnd: Date,
  ): string {
    const title = schedule.reportTemplate?.name || 'Scheduled Report';
    const period = `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`;
    return `${title} (${period})`;
  }

  private calculateNextRunTime(cronExpression: string, timezone: string): Date {
    try {
      const interval = cronParser.parseExpression(cronExpression, {
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (error) {
      this.logger.error('Failed to calculate next run time', error);
      return new Date();
    }
  }

  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedProperty(context, key);
      return value !== undefined ? value : match;
    });
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }
}