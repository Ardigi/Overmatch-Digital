import { InjectQueue } from '@nestjs/bull';
import { 
  BadRequestException, 
  Injectable, 
  Logger, 
  NotFoundException
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import type { 
  BaseServiceData,
  EvidenceType 
} from '@soc-compliance/contracts';
import {
  EventType,
  type SyncCompletedEvent,
  type SyncFailedEvent,
  type SyncStartedEvent,
} from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { Queue } from 'bull';
import * as cron from 'cron-parser';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Integration } from '../integrations/entities/integration.entity';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateEntityMappingsDto } from './dto/entity-mappings.dto';
import type { RetrySyncDto } from './dto/retry-sync.dto';
import type { StartSyncDto } from './dto/start-sync.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';
import { 
  type EntitySyncStatus, 
  SyncJob, 
  SyncJobStatus, 
  type SyncJobType
} from './entities/sync-job.entity';
import { SyncSchedule } from './entities/sync-schedule.entity';

export interface SyncProgress {
  jobId: string;
  status: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  currentEntity?: string;
  currentBatch?: number;
  totalBatches?: number;
  estimatedTimeRemaining?: number;
  entities: EntitySyncStatus[];
}

export interface SyncStatistics {
  integrationId: string;
  period: string;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  averageDuration: number;
  totalEntitiesSynced: number;
  entitiesByType: Record<string, number>;
  errorsByType?: Record<string, number>;
  peakSyncTimes?: Array<{ hour: number; count: number }>;
  dataVolume?: {
    totalBytes: number;
    averageBytesPerSync: number;
  };
}

export interface SyncHistory {
  timeline: Array<{
    date: string;
    syncs: number;
    successful: number;
    failed: number;
    entities: number;
    duration: number;
  }>;
  recentJobs: SyncJob[];
  trends: {
    syncFrequency: string;
    successRate: string;
    dataVolume: string;
    performance: string;
  };
  insights?: any;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private entityMappings: Map<string, any> = new Map();

  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobRepository: Repository<SyncJob>,
    @InjectRepository(SyncSchedule)
    private readonly scheduleRepository: Repository<SyncSchedule>,
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectQueue('sync') private readonly syncQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async startSync(
    integrationId: string,
    organizationId: string,
    dto: StartSyncDto
  ): Promise<SyncJob> {
    // Verify integration exists and is active
    const integration = await this.integrationRepository.findOne({
      where: { id: integrationId, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (integration.status !== 'ACTIVE') {
      throw new BadRequestException('Integration must be active to start sync');
    }

    // Check for running sync
    const runningSync = await this.syncJobRepository.findOne({
      where: {
        integrationId,
        status: 'running',
      },
    });

    if (runningSync) {
      throw new BadRequestException('Another sync is already running');
    }

    // Validate sync mode
    const validModes = ['full', 'incremental', 'delta'];
    if (dto.mode && !validModes.includes(dto.mode)) {
      throw new BadRequestException('Invalid sync mode');
    }

    // Create sync job
    const syncJob = this.syncJobRepository.create({
      integrationId,
      organizationId,
      jobType: this.mapModeToJobType(dto.mode || 'full'),
      status: 'running',
      syncType: dto.mode || 'full',
      entitiesSynced: 0,
      startedAt: new Date(),
      progress: {
        current: 0,
        total: 1000, // Will be updated once we know the actual count
        percentage: 0,
      },
      entities: dto.entities?.map(entity => ({
        entityType: entity,
        status: 'pending' as const,
        processed: 0,
      })) || [],
      config: {
        batchSize: dto.options?.batchSize || 100,
        parallel: dto.options?.parallel || false,
        retryFailures: dto.options?.retryFailures || true,
        continueOnError: dto.options?.continueOnError || false,
        filters: dto.filters,
      },
      metadata: {
        triggeredBy: dto.triggeredBy || 'manual',
        reason: 'Manual sync',
        version: '1.0.0',
      },
    });

    const savedJob = await this.syncJobRepository.save(syncJob);

    // Queue sync for processing
    await this.syncQueue.add('process-sync', {
      jobId: savedJob.id,
      integrationId,
      organizationId,
    });

    // Emit standardized sync started event
    const syncStartedEvent: SyncStartedEvent = {
      id: uuidv4(),
      type: EventType.SYNC_STARTED,
      timestamp: new Date(),
      version: '1.0',
      source: 'integration-service',
      userId: dto.triggeredBy || 'system',
      organizationId,
      payload: {
        syncId: savedJob.id,
        integrationId,
        organizationId,
        syncType: savedJob.syncType || 'full',
        triggeredBy: dto.triggeredBy || 'system',
      },
    };
    
    await this.eventEmitter.emit('sync.started', syncStartedEvent);
    this.logger.log(`Emitted sync.started event for job ${savedJob.id}`);

    return savedJob;
  }

  async getSyncJob(jobId: string, organizationId: string): Promise<SyncJob> {
    const job = await this.syncJobRepository.findOne({
      where: { id: jobId, organizationId },
    });

    if (!job) {
      throw new NotFoundException('Sync job not found');
    }

    return job;
  }

  async getSyncJobs(
    integrationId: string,
    organizationId: string,
    filters: { status?: string; page?: number; limit?: number }
  ): Promise<{ data: SyncJob[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.syncJobRepository.createQueryBuilder('job');
    
    queryBuilder.where('job.integrationId = :integrationId', { integrationId });
    queryBuilder.andWhere('job.organizationId = :organizationId', { organizationId });

    if (filters.status) {
      queryBuilder.andWhere('job.status = :status', { status: filters.status });
    }

    queryBuilder.orderBy('job.createdAt', 'DESC');

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async cancelSync(jobId: string, organizationId: string): Promise<SyncJob> {
    const job = await this.getSyncJob(jobId, organizationId);

    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new BadRequestException('Cannot cancel completed job');
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    job.error = 'Cancelled by user';

    const cancelled = await this.syncJobRepository.save(job);

    await this.eventEmitter.emit('sync.cancelled', {
      jobId,
      integrationId: job.integrationId,
      organizationId,
    });
    this.logger.log(`Emitted sync.cancelled event for job ${jobId}`);

    return cancelled;
  }

  async retrySync(
    jobId: string,
    organizationId: string,
    dto: RetrySyncDto
  ): Promise<SyncJob> {
    const originalJob = await this.getSyncJob(jobId, organizationId);

    if (originalJob.status === 'running') {
      throw new BadRequestException('Cannot retry running job');
    }

    // Create new job based on original
    const retryJob = this.syncJobRepository.create({
      ...originalJob,
      id: undefined,
      status: 'running',
      startedAt: new Date(),
      completedAt: undefined,
      duration: undefined,
      progress: {
        current: 0,
        total: 1000,
        percentage: 0,
      },
      entities: dto.entities 
        ? originalJob.entities.filter(e => dto.entities!.includes(e.entityType))
        : originalJob.entities,
      error: undefined,
      metadata: {
        ...originalJob.metadata,
        retriedFrom: jobId,
      },
    });

    // Reset entity status
    retryJob.entities = retryJob.entities.map(entity => ({
      ...entity,
      status: dto.retryFailedOnly && entity.status === 'completed' ? 'skipped' : 'pending',
      processed: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
    }));

    const savedJob = await this.syncJobRepository.save(retryJob);

    // Queue for processing
    await this.syncQueue.add('process-sync', {
      jobId: savedJob.id,
      integrationId: savedJob.integrationId,
      organizationId,
    });

    return savedJob;
  }

  async getSyncProgress(
    integrationId: string,
    jobId: string,
    organizationId: string
  ): Promise<SyncProgress> {
    const job = await this.getSyncJob(jobId, organizationId);

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    if (job.status === 'running' && job.progress.percentage > 0) {
      const elapsed = Date.now() - job.startedAt!.getTime();
      const totalEstimated = elapsed / (job.progress.percentage / 100);
      estimatedTimeRemaining = Math.round(totalEstimated - elapsed);
    }

    // Find current entity being processed
    const currentEntity = job.entities.find(e => e.status === 'in_progress');

    return {
      jobId,
      status: job.status,
      progress: job.progress,
      currentEntity: currentEntity?.entityType,
      currentBatch: 5, // In real implementation, track actual batch
      totalBatches: 10, // In real implementation, calculate based on data
      estimatedTimeRemaining,
      entities: job.entities,
    };
  }

  async completeSyncJob(
    jobId: string,
    organizationId: string,
    result: {
      success: boolean;
      entitiesSynced?: number;
      error?: string;
      statistics?: any;
    }
  ): Promise<SyncJob> {
    const job = await this.getSyncJob(jobId, organizationId);
    
    job.status = result.success ? 'completed' : 'failed';
    job.completedAt = new Date();
    job.entitiesSynced = result.entitiesSynced || 0;
    job.error = result.error;
    
    if (job.startedAt) {
      job.duration = Math.floor((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    
    const completedJob = await this.syncJobRepository.save(job);
    
    if (result.success) {
      // Emit standardized sync completed event
      const syncCompletedEvent: SyncCompletedEvent = {
        id: uuidv4(),
        type: EventType.SYNC_COMPLETED,
        timestamp: new Date(),
        version: '1.0',
        source: 'integration-service',
        organizationId,
        payload: {
          syncId: completedJob.id,
          integrationId: completedJob.integrationId,
          organizationId,
          duration: completedJob.duration || 0,
          entitiesSynced: completedJob.entitiesSynced,
          syncType: completedJob.syncType,
        },
      };
      
      await this.eventEmitter.emit('sync.completed', syncCompletedEvent);
      this.logger.log(`Emitted sync.completed event for job ${completedJob.id}`);
    } else {
      // Emit standardized sync failed event
      const syncFailedEvent: SyncFailedEvent = {
        id: uuidv4(),
        type: EventType.SYNC_FAILED,
        timestamp: new Date(),
        version: '1.0',
        source: 'integration-service',
        organizationId,
        payload: {
          syncId: completedJob.id,
          integrationId: completedJob.integrationId,
          organizationId,
          error: result.error || 'Unknown error',
          duration: completedJob.duration || 0,
          syncType: completedJob.syncType,
        },
      };
      
      await this.eventEmitter.emit('sync.failed', syncFailedEvent);
      this.logger.log(`Emitted sync.failed event for job ${completedJob.id}`);
    }
    
    return completedJob;
  }

  async createSchedule(
    integrationId: string,
    organizationId: string,
    dto: CreateScheduleDto
  ): Promise<SyncSchedule> {
    // Validate cron expression
    try {
      cron.parseExpression(dto.cronExpression);
    } catch {
      throw new BadRequestException('Invalid cron expression');
    }

    // Check for duplicate name
    const existing = await this.scheduleRepository.findOne({
      where: {
        integrationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(`Schedule with name "${dto.name}" already exists`);
    }

    const schedule = this.scheduleRepository.create({
      ...dto,
      integrationId,
      organizationId,
      enabled: true,
      nextRunAt: this.calculateNextRun(dto.cronExpression, dto.timezone),
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDuration: 0,
      },
    });

    return this.scheduleRepository.save(schedule);
  }

  async updateSchedule(
    integrationId: string,
    scheduleId: string,
    organizationId: string,
    dto: UpdateScheduleDto
  ): Promise<SyncSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, integrationId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Validate cron expression if changed
    if (dto.cronExpression) {
      try {
        cron.parseExpression(dto.cronExpression);
      } catch {
        throw new BadRequestException('Invalid cron expression');
      }
    }

    Object.assign(schedule, dto);

    if (dto.cronExpression || dto.timezone) {
      schedule.nextRunAt = this.calculateNextRun(
        schedule.cronExpression,
        schedule.timezone
      );
    }

    return this.scheduleRepository.save(schedule);
  }

  async deleteSchedule(
    integrationId: string,
    scheduleId: string,
    organizationId: string
  ): Promise<void> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, integrationId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    await this.scheduleRepository.remove(schedule);
  }

  async getSchedules(
    integrationId: string,
    organizationId: string
  ): Promise<SyncSchedule[]> {
    return this.scheduleRepository.find({
      where: { integrationId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSchedule(
    integrationId: string,
    scheduleId: string,
    organizationId: string
  ): Promise<SyncSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, integrationId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async enableSchedule(
    integrationId: string,
    scheduleId: string,
    organizationId: string
  ): Promise<SyncSchedule> {
    const schedule = await this.getSchedule(integrationId, scheduleId, organizationId);
    
    schedule.enabled = true;
    schedule.nextRunAt = this.calculateNextRun(schedule.cronExpression, schedule.timezone);

    return this.scheduleRepository.save(schedule);
  }

  async disableSchedule(
    integrationId: string,
    scheduleId: string,
    organizationId: string
  ): Promise<SyncSchedule> {
    const schedule = await this.getSchedule(integrationId, scheduleId, organizationId);
    
    schedule.enabled = false;
    schedule.nextRunAt = undefined;

    return this.scheduleRepository.save(schedule);
  }

  async getSyncStats(
    integrationId: string,
    organizationId: string,
    filters: { period?: string }
  ): Promise<SyncStatistics> {
    const period = filters.period || '7d';
    const since = this.calculateSinceDate(period);

    const jobs = await this.syncJobRepository.find({
      where: {
        integrationId,
        organizationId,
        createdAt: since,
      },
    });

    const totalSyncs = jobs.length;
    const successfulSyncs = jobs.filter(j => j.status === 'completed').length;
    const failedSyncs = jobs.filter(j => j.status === 'failed').length;
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    // Calculate average duration
    const completedJobs = jobs.filter(j => j.duration);
    const averageDuration = completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => sum + j.duration!, 0) / completedJobs.length
      : 0;

    // Calculate entities by type
    const entitiesByType: Record<string, number> = {};
    jobs.forEach(job => {
      job.entities.forEach(entity => {
        entitiesByType[entity.entityType] = 
          (entitiesByType[entity.entityType] || 0) + (entity.processed || 0);
      });
    });

    const totalEntitiesSynced = Object.values(entitiesByType).reduce((sum, count) => sum + count, 0);

    // Get real error statistics from logs
    const errorsByType: Record<string, number> = {};
    let peakSyncTimes: Array<{ hour: number; count: number }> = [];
    let dataVolume = { totalBytes: 0, averageBytesPerSync: 0 };

    try {
      // Get error statistics from actual job failures
      const failedJobs = jobs.filter(j => j.status === 'failed');
      failedJobs.forEach(job => {
        if (job.error) {
          const errorType = this.categorizeError(job.error);
          errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
        }
      });

      // Calculate peak sync times from job timestamps
      const hourCounts: Record<number, number> = {};
      jobs.forEach(job => {
        const hour = job.startedAt?.getHours() || 0;
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      peakSyncTimes = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Estimate data volume based on entity counts and types
      const estimatedBytesPerEntity = {
        'contacts': 1024,      // 1KB per contact
        'policies': 10240,     // 10KB per policy
        'evidence': 102400,    // 100KB per evidence item
        'controls': 2048,      // 2KB per control
        'users': 512,          // 512B per user
      };

      let totalEstimatedBytes = 0;
      Object.entries(entitiesByType).forEach(([entityType, count]) => {
        const bytesPerEntity = (estimatedBytesPerEntity as any)[entityType] || 1024;
        totalEstimatedBytes += count * bytesPerEntity;
      });

      dataVolume = {
        totalBytes: totalEstimatedBytes,
        averageBytesPerSync: totalSyncs > 0 ? Math.round(totalEstimatedBytes / totalSyncs) : 0,
      };

    } catch (error) {
      this.logger.warn(`Error calculating detailed sync statistics: ${error.message}`);
    }

    return {
      integrationId,
      period,
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate: Math.round(successRate),
      averageDuration: Math.round(averageDuration),
      totalEntitiesSynced,
      entitiesByType,
      errorsByType,
      peakSyncTimes,
      dataVolume,
    };
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    if (message.includes('rate limit') || message.includes('429')) {
      return 'API_RATE_LIMIT';
    }
    if (message.includes('validation') || message.includes('400')) {
      return 'VALIDATION_ERROR';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  async getSyncHistory(
    integrationId: string,
    organizationId: string,
    days: number = 30
  ): Promise<SyncHistory> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const jobs = await this.syncJobRepository.find({
      where: {
        integrationId,
        organizationId,
        createdAt: since,
      },
      order: { createdAt: 'DESC' },
    });

    // Group by date
    const timeline: any[] = [];
    const dateMap = new Map<string, any>();

    jobs.forEach(job => {
      const date = job.createdAt.toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          syncs: 0,
          successful: 0,
          failed: 0,
          entities: 0,
          duration: 0,
        });
      }

      const day = dateMap.get(date)!;
      day.syncs++;
      if (job.status === 'completed') day.successful++;
      if (job.status === 'failed') day.failed++;
      day.entities += job.entities.reduce((sum, e) => sum + (e.processed || 0), 0);
      day.duration += job.duration || 0;
    });

    dateMap.forEach(value => timeline.push(value));
    timeline.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate trends based on actual data
    const trends = this.calculateSyncTrends(timeline, jobs);

    // Get additional insights from related services
    try {
      const serviceInsights = await this.getSyncInsightsFromServices(integrationId, organizationId);
      
      return {
        timeline: timeline.slice(0, days),
        recentJobs: jobs.slice(0, 10),
        trends,
        insights: serviceInsights,
      };
    } catch (error) {
      this.logger.warn(`Could not get service insights: ${error.message}`);
      
      return {
        timeline: timeline.slice(0, days),
        recentJobs: jobs.slice(0, 10),
        trends,
      };
    }
  }

  private calculateSyncTrends(timeline: any[], jobs: any[]): SyncHistory['trends'] {
    if (timeline.length < 2) {
      return {
        syncFrequency: 'stable',
        successRate: 'stable',
        dataVolume: 'stable',
        performance: 'stable',
      };
    }

    // Calculate frequency trend (last 7 days vs previous 7 days)
    const recent = timeline.slice(0, 7);
    const previous = timeline.slice(7, 14);
    
    const recentSyncs = recent.reduce((sum, day) => sum + day.syncs, 0);
    const previousSyncs = previous.reduce((sum, day) => sum + day.syncs, 0);
    const frequencyTrend = recentSyncs > previousSyncs ? 'increasing' : 
                          recentSyncs < previousSyncs ? 'decreasing' : 'stable';

    // Calculate success rate trend
    const recentSuccessRate = recent.length > 0 ? 
      (recent.reduce((sum, day) => sum + day.successful, 0) / 
       recent.reduce((sum, day) => sum + day.syncs, 0)) * 100 : 0;
    const previousSuccessRate = previous.length > 0 ? 
      (previous.reduce((sum, day) => sum + day.successful, 0) / 
       previous.reduce((sum, day) => sum + day.syncs, 0)) * 100 : 0;
    const successRateTrend = recentSuccessRate > previousSuccessRate ? 'improving' : 
                           recentSuccessRate < previousSuccessRate ? 'declining' : 'stable';

    // Calculate data volume trend
    const recentEntities = recent.reduce((sum, day) => sum + day.entities, 0);
    const previousEntities = previous.reduce((sum, day) => sum + day.entities, 0);
    const dataVolumeTrend = recentEntities > previousEntities ? 'increasing' : 
                           recentEntities < previousEntities ? 'decreasing' : 'stable';

    // Calculate performance trend (based on average duration)
    const recentPerformance = recent.length > 0 ? 
      recent.reduce((sum, day) => sum + day.duration, 0) / recent.reduce((sum, day) => sum + day.syncs, 0) : 0;
    const previousPerformance = previous.length > 0 ? 
      previous.reduce((sum, day) => sum + day.duration, 0) / previous.reduce((sum, day) => sum + day.syncs, 0) : 0;
    const performanceTrend = recentPerformance < previousPerformance ? 'improving' : 
                           recentPerformance > previousPerformance ? 'declining' : 'stable';

    return {
      syncFrequency: frequencyTrend,
      successRate: successRateTrend,
      dataVolume: dataVolumeTrend,
      performance: performanceTrend,
    };
  }

  private async getSyncInsightsFromServices(
    integrationId: string,
    organizationId: string
  ): Promise<any> {
    const insights: any = {};

    try {
      // Get workflow insights if this integration triggers workflows
      const workflowInsights = await this.serviceDiscovery.callService<any>(
        'workflow-service',
        'GET',
        `/api/v1/workflows/insights/${organizationId}?integrationId=${integrationId}`
      );
      
      if (workflowInsights.success) {
        insights.workflows = workflowInsights.data;
      }
    } catch (error) {
      this.logger.debug(`Could not get workflow insights: ${error.message}`);
    }

    try {
      // Get evidence collection insights
      const evidenceInsights = await this.serviceDiscovery.callService<any>(
        'evidence-service',
        'GET',
        `/api/v1/evidence/insights/${organizationId}?integrationId=${integrationId}`
      );
      
      if (evidenceInsights.success) {
        insights.evidence = evidenceInsights.data;
      }
    } catch (error) {
      this.logger.debug(`Could not get evidence insights: ${error.message}`);
    }

    return insights;
  }

  async getEntityMappings(
    integrationId: string,
    organizationId: string
  ): Promise<any> {
    try {
      // Try to get mappings from integration configuration
      const integration = await this.integrationRepository.findOne({
        where: { id: integrationId, organizationId },
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      // Check if mappings are stored in integration configuration
      if (integration.configuration?.entityMappings) {
        return integration.configuration.entityMappings;
      }

      // Get default mappings based on integration type
      const defaultMappings = this.getDefaultEntityMappings(integration.integrationType);
      
      // Try to get organization-specific mappings from client-service
      try {
        const orgMappingsResponse = await this.serviceDiscovery.callService<any>(
          'client-service',
          'GET',
          `/api/v1/organizations/${organizationId}/entity-mappings`
        );
        
        if (orgMappingsResponse.success && orgMappingsResponse.data) {
          return { ...defaultMappings, ...orgMappingsResponse.data };
        }
      } catch (error) {
        this.logger.warn(`Could not fetch organization mappings: ${error.message}`);
      }

      return defaultMappings;
    } catch (error) {
      this.logger.error(`Error getting entity mappings:`, error);
      return this.getDefaultEntityMappings('CRM');
    }
  }

  private getDefaultEntityMappings(integrationType: string): any {
    const baseMappings: Record<string, any> = {
      Contact: {
        sourceEntity: 'Contact',
        targetEntity: 'contacts',
        fields: [
          {
            source: 'FirstName',
            target: 'firstName',
            type: 'string',
            required: true,
            transform: null,
          },
          {
            source: 'LastName',
            target: 'lastName',
            type: 'string',
            required: true,
            transform: null,
          },
          {
            source: 'Email',
            target: 'email',
            type: 'email',
            required: true,
            transform: 'lowercase',
          },
          {
            source: 'Phone',
            target: 'phone',
            type: 'string',
            required: false,
            transform: null,
          },
          {
            source: 'Department',
            target: 'department',
            type: 'string',
            required: false,
            transform: null,
          },
        ],
        relationships: [
          {
            source: 'AccountId',
            target: 'organizationId',
            type: 'lookup',
            entity: 'Account',
          },
        ],
      },
    };

    // Add integration-type specific mappings
    if (integrationType === 'SECURITY' || integrationType === 'COMPLIANCE') {
      baseMappings['Control'] = {
        sourceEntity: 'Control',
        targetEntity: 'controls',
        fields: [
          {
            source: 'Code',
            target: 'code',
            type: 'string',
            required: true,
            transform: 'uppercase',
          },
          {
            source: 'Title',
            target: 'title',
            type: 'string',
            required: true,
            transform: null,
          },
          {
            source: 'Description',
            target: 'description',
            type: 'text',
            required: true,
            transform: null,
          },
          {
            source: 'Category',
            target: 'category',
            type: 'string',
            required: false,
            transform: null,
          },
        ],
      };

      baseMappings['Evidence'] = {
        sourceEntity: 'Evidence',
        targetEntity: 'evidence',
        fields: [
          {
            source: 'Name',
            target: 'title',
            type: 'string',
            required: true,
            transform: null,
          },
          {
            source: 'Description',
            target: 'description',
            type: 'text',
            required: false,
            transform: null,
          },
          {
            source: 'Type',
            target: 'type',
            type: 'string',
            required: true,
            transform: 'uppercase',
          },
          {
            source: 'FileUrl',
            target: 'fileUrl',
            type: 'url',
            required: false,
            transform: null,
          },
        ],
      };
    }

    if (integrationType === 'POLICY') {
      baseMappings['Policy'] = {
        sourceEntity: 'Policy',
        targetEntity: 'policies',
        fields: [
          {
            source: 'Title',
            target: 'title',
            type: 'string',
            required: true,
            transform: null,
          },
          {
            source: 'Content',
            target: 'content',
            type: 'text',
            required: true,
            transform: null,
          },
          {
            source: 'Category',
            target: 'category',
            type: 'string',
            required: false,
            transform: null,
          },
          {
            source: 'Version',
            target: 'version',
            type: 'string',
            required: false,
            transform: null,
          },
        ],
      };
    }

    return baseMappings;
  }

  async updateEntityMappings(
    integrationId: string,
    organizationId: string,
    dto: UpdateEntityMappingsDto
  ): Promise<any> {
    try {
      // Get the integration to update its configuration
      const integration = await this.integrationRepository.findOne({
        where: { id: integrationId, organizationId },
      });

      if (!integration) {
        throw new NotFoundException('Integration not found');
      }

      // Update integration configuration with new mappings
      const updatedConfiguration = {
        ...integration.configuration,
        entityMappings: {
          ...integration.configuration?.entityMappings,
          ...dto,
        },
        lastMappingUpdate: new Date(),
      };

      integration.configuration = updatedConfiguration;
      await this.integrationRepository.save(integration);

      // Store in memory cache for quick access
      Object.entries(dto).forEach(([entity, mapping]) => {
        this.entityMappings.set(`${integrationId}:${entity}`, mapping);
      });

      // Notify other services about mapping updates
      try {
        await this.serviceDiscovery.callService(
          'audit-service',
          'POST',
          '/api/v1/events',
          {
            eventType: 'integration.mappings.updated',
            organizationId,
            details: {
              integrationId,
              entitiesUpdated: Object.keys(dto),
              timestamp: new Date(),
            },
          }
        );
      } catch (auditError) {
        this.logger.warn(`Failed to log mapping update: ${auditError.message}`);
      }

      return {
        ...dto,
        updatedAt: new Date(),
        integrationId,
        organizationId,
      };
    } catch (error) {
      this.logger.error(`Error updating entity mappings:`, error);
      throw error;
    }
  }

  /**
   * Sync data with internal SOC compliance services
   */
  async syncWithInternalServices(
    integrationId: string,
    organizationId: string,
    entityType: string,
    data: any[]
  ): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      // Sync contacts with client-service
      if (entityType === 'contacts' && data.length > 0) {
        try {
          this.logger.log(`Syncing ${data.length} contacts with client-service`);
          
          // Transform data for client service format
          const transformedContacts = data.map(contact => ({
            organizationId,
            name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            email: contact.email,
            phone: contact.phone,
            department: contact.department,
            title: contact.title,
            metadata: {
              integrationId,
              externalId: contact.id,
              syncedAt: new Date()
            }
          }));
          
          const response = await this.serviceDiscovery.callService<{ success: boolean; data: any[] }>(
            'client-service',
            'POST',
            '/api/v1/contacts/bulk',
            { contacts: transformedContacts, organizationId }
          );
          
          if (response.success) {
            synced = Array.isArray(response.data) ? response.data.length : data.length;
            this.logger.log(`Successfully synced ${synced} contacts`);
          } else {
            errors.push(`Failed to sync contacts: ${(response as any).message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Error syncing contacts: ${error.message}`);
          this.logger.error(`Contact sync error:`, error);
        }
      }

      // Sync policies with policy-service
      if (entityType === 'policies' && data.length > 0) {
        try {
          this.logger.log(`Syncing ${data.length} policies with policy-service`);
          
          // Transform data for policy service format
          const transformedPolicies = data.map(policy => ({
            organizationId,
            title: policy.name || policy.title,
            content: policy.description || policy.content,
            category: policy.category || 'General',
            version: policy.version || '1.0',
            status: 'DRAFT',
            metadata: {
              integrationId,
              externalId: policy.id,
              syncedAt: new Date()
            }
          }));
          
          const response = await this.serviceDiscovery.callService<{ success: boolean; data: any[] }>(
            'policy-service',
            'POST',
            '/api/v1/policies/bulk',
            { policies: transformedPolicies, organizationId }
          );
          
          if (response.success) {
            synced = Array.isArray(response.data) ? response.data.length : data.length;
            this.logger.log(`Successfully synced ${synced} policies`);
          } else {
            errors.push(`Failed to sync policies: ${(response as any).message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Error syncing policies: ${error.message}`);
          this.logger.error(`Policy sync error:`, error);
        }
      }

      // Sync evidence with evidence-service
      if (entityType === 'evidence' && data.length > 0) {
        try {
          this.logger.log(`Syncing ${data.length} evidence items with evidence-service`);
          
          // Transform data for evidence service format
          const transformedEvidence = data.map(evidence => ({
            projectId: evidence.projectId || `integration-${integrationId}`,
            controlId: evidence.controlId,
            title: evidence.name || evidence.title,
            description: evidence.description,
            type: evidence.type || 'DOCUMENT',
            fileUrl: evidence.fileUrl || evidence.url,
            fileName: evidence.fileName,
            collectedDate: evidence.collectedDate || new Date(),
            isAutomated: true,
            verified: false,
            metadata: {
              integrationId,
              externalId: evidence.id,
              syncedAt: new Date()
            }
          }));
          
          const response = await this.serviceDiscovery.callService<{ success: boolean; data: any[] }>(
            'evidence-service',
            'POST',
            '/api/v1/evidence/bulk',
            { evidence: transformedEvidence, organizationId }
          );
          
          if (response.success) {
            synced = Array.isArray(response.data) ? response.data.length : data.length;
            this.logger.log(`Successfully synced ${synced} evidence items`);
          } else {
            errors.push(`Failed to sync evidence: ${(response as any).message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Error syncing evidence: ${error.message}`);
          this.logger.error(`Evidence sync error:`, error);
        }
      }

      // Sync controls with control-service
      if (entityType === 'controls' && data.length > 0) {
        try {
          this.logger.log(`Syncing ${data.length} controls with control-service`);
          
          // Transform data for control service format
          const transformedControls = data.map(control => ({
            organizationId,
            code: control.code || control.id,
            title: control.name || control.title,
            description: control.description,
            category: control.category || 'General',
            frameworks: control.frameworks || ['SOC2_SECURITY'],
            implementationStatus: control.status || 'NOT_IMPLEMENTED',
            metadata: {
              integrationId,
              externalId: control.id,
              syncedAt: new Date()
            }
          }));
          
          const response = await this.serviceDiscovery.callService<{ success: boolean; data: any[] }>(
            'control-service',
            'POST',
            '/api/v1/controls/bulk',
            { controls: transformedControls, organizationId }
          );
          
          if (response.success) {
            synced = Array.isArray(response.data) ? response.data.length : data.length;
            this.logger.log(`Successfully synced ${synced} controls`);
          } else {
            errors.push(`Failed to sync controls: ${(response as any).message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Error syncing controls: ${error.message}`);
          this.logger.error(`Control sync error:`, error);
        }
      }

      // Sync users with auth-service for user management integrations
      if (entityType === 'users' && data.length > 0) {
        try {
          this.logger.log(`Syncing ${data.length} users with auth-service`);
          
          // Transform data for auth service format
          const transformedUsers = data.map(user => ({
            email: user.email,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            organizationId,
            role: user.role || 'user',
            metadata: {
              integrationId,
              externalId: user.id,
              syncedAt: new Date(),
              department: user.department,
              title: user.title
            }
          }));
          
          const response = await this.serviceDiscovery.callService<{ success: boolean; data: any[] }>(
            'auth-service',
            'POST',
            '/api/v1/users/bulk-sync',
            { users: transformedUsers, organizationId }
          );
          
          if (response.success) {
            synced = Array.isArray(response.data) ? response.data.length : data.length;
            this.logger.log(`Successfully synced ${synced} users`);
          } else {
            errors.push(`Failed to sync users: ${(response as any).message || 'Unknown error'}`);
          }
        } catch (error) {
          errors.push(`Error syncing users: ${error.message}`);
          this.logger.error(`User sync error:`, error);
        }
      }

      // Log sync activity to audit service
      try {
        await this.serviceDiscovery.callService(
          'audit-service',
          'POST',
          '/api/v1/events',
          {
            eventType: 'integration.sync.completed',
            organizationId,
            details: {
              integrationId,
              entityType,
              recordsProcessed: data.length,
              recordsSynced: synced,
              errors: errors.length,
              timestamp: new Date()
            }
          }
        );
      } catch (auditError) {
        this.logger.warn(`Failed to log sync to audit service: ${auditError.message}`);
      }

    } catch (error) {
      this.logger.error(`Error syncing ${entityType} with internal services:`, error);
      errors.push(`Failed to sync ${entityType}: ${error.message}`);
    }

    return { synced, errors };
  }

  /**
   * Get sync status from related services
   */
  async getSyncStatusFromServices(
    integrationId: string,
    organizationId: string
  ): Promise<{ serviceStatuses: Record<string, any>; lastSyncData: Record<string, any> }> {
    const serviceStatuses: Record<string, any> = {};
    const lastSyncData: Record<string, any> = {};

    try {
      // Get organization sync status from client-service
      try {
        const orgSyncResponse = await this.serviceDiscovery.callService<any>(
          'client-service',
          'GET',
          `/api/v1/organizations/${organizationId}/sync-status`
        );
        serviceStatuses['client-service'] = orgSyncResponse.success;
        if (orgSyncResponse.success) {
          lastSyncData['client-service'] = orgSyncResponse.data;
        }
      } catch (error) {
        serviceStatuses['client-service'] = false;
      }

      // Get control sync status from control-service
      try {
        const controlSyncResponse = await this.serviceDiscovery.callService<any>(
          'control-service',
          'GET',
          `/api/v1/controls/sync-status/${organizationId}`
        );
        serviceStatuses['control-service'] = controlSyncResponse.success;
        if (controlSyncResponse.success) {
          lastSyncData['control-service'] = controlSyncResponse.data;
        }
      } catch (error) {
        serviceStatuses['control-service'] = false;
      }

      // Get evidence sync status from evidence-service
      try {
        const evidenceSyncResponse = await this.serviceDiscovery.callService<any>(
          'evidence-service',
          'GET',
          `/api/v1/evidence/sync-status/${organizationId}`
        );
        serviceStatuses['evidence-service'] = evidenceSyncResponse.success;
        if (evidenceSyncResponse.success) {
          lastSyncData['evidence-service'] = evidenceSyncResponse.data;
        }
      } catch (error) {
        serviceStatuses['evidence-service'] = false;
      }

    } catch (error) {
      this.logger.error(`Error getting sync status from services:`, error);
    }

    return { serviceStatuses, lastSyncData };
  }

  private mapModeToJobType(mode: string): SyncJobType {
    switch (mode) {
      case 'incremental':
        return 'incremental_sync';
      case 'delta':
        return 'delta_sync';
      default:
        return 'full_sync';
    }
  }

  private calculateNextRun(cronExpression: string, timezone?: string): Date {
    try {
      const options = timezone ? { tz: timezone } : {};
      const interval = cron.parseExpression(cronExpression, options);
      return interval.next().toDate();
    } catch {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow
    }
  }

  private calculateSinceDate(period: string): Date {
    const now = new Date();
    const match = period.match(/^(\d+)([dhm])$/);
    
    if (!match) {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h':
        return new Date(now.getTime() - num * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}