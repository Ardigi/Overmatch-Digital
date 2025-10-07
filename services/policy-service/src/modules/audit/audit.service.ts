import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, Repository } from 'typeorm';
import { AuditAction, AuditLog, type AuditMetadata, AuditResourceType } from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  userId?: string;
  userEmail?: string;
  organizationId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  resourceName?: string;
  description?: string;
  metadata?: AuditMetadata;
  success?: boolean;
  statusCode?: number;
  durationMs?: number;
}

export interface AuditQueryDto {
  userId?: string;
  organizationId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  securityEvents: number;
  eventsByAction: Record<AuditAction, number>;
  eventsByResource: Record<AuditResourceType, number>;
  topUsers: Array<{ userId: string; userEmail: string; eventCount: number }>;
  averageResponseTime: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly retentionDays: number;
  private readonly batchSize = 100;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get('policyService.audit.retentionDays', 90);
  }

  /**
   * Create an audit log entry
   */
  async create(createAuditLogDto: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create(createAuditLogDto);
      const saved = await this.auditLogRepository.save(auditLog);

      // Emit event for security monitoring
      if (saved.isSecurityEvent) {
        this.eventEmitter.emit('audit.security-event', saved);
      }

      // Emit event for failed operations
      if (!saved.success) {
        this.eventEmitter.emit('audit.failed-operation', saved);
      }

      return saved;
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      // Don't throw - audit logging should not break the application
      return null;
    }
  }

  /**
   * Query audit logs with filters
   */
  async findAll(query: AuditQueryDto): Promise<{ data: AuditLog[]; total: number }> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

    if (query.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: query.userId });
    }

    if (query.organizationId) {
      queryBuilder.andWhere('audit.organizationId = :organizationId', { 
        organizationId: query.organizationId 
      });
    }

    if (query.action) {
      if (Array.isArray(query.action)) {
        queryBuilder.andWhere('audit.action IN (:...actions)', { actions: query.action });
      } else {
        queryBuilder.andWhere('audit.action = :action', { action: query.action });
      }
    }

    if (query.resourceType) {
      queryBuilder.andWhere('audit.resourceType = :resourceType', { 
        resourceType: query.resourceType 
      });
    }

    if (query.resourceId) {
      queryBuilder.andWhere('audit.resourceId = :resourceId', { 
        resourceId: query.resourceId 
      });
    }

    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    if (query.success !== undefined) {
      queryBuilder.andWhere('audit.success = :success', { success: query.success });
    }

    queryBuilder.orderBy('audit.createdAt', 'DESC');

    const [data, total] = await queryBuilder
      .take(query.limit || 100)
      .skip(query.offset || 0)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * Get audit log summary for dashboard
   */
  async getSummary(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AuditSummary> {
    const logs = await this.auditLogRepository.find({
      where: {
        organizationId,
        createdAt: Between(startDate, endDate),
      },
    });

    const summary: AuditSummary = {
      totalEvents: logs.length,
      successfulEvents: logs.filter(log => log.success).length,
      failedEvents: logs.filter(log => !log.success).length,
      securityEvents: logs.filter(log => log.isSecurityEvent).length,
      eventsByAction: {} as Record<AuditAction, number>,
      eventsByResource: {} as Record<AuditResourceType, number>,
      topUsers: [],
      averageResponseTime: 0,
    };

    // Count events by action
    for (const action of Object.values(AuditAction)) {
      summary.eventsByAction[action] = logs.filter(log => log.action === action).length;
    }

    // Count events by resource
    for (const resource of Object.values(AuditResourceType)) {
      summary.eventsByResource[resource] = logs.filter(
        log => log.resourceType === resource
      ).length;
    }

    // Calculate top users
    const userCounts = new Map<string, { email: string; count: number }>();
    logs.forEach(log => {
      if (log.userId) {
        const existing = userCounts.get(log.userId) || { email: log.userEmail, count: 0 };
        existing.count++;
        userCounts.set(log.userId, existing);
      }
    });

    summary.topUsers = Array.from(userCounts.entries())
      .map(([userId, data]) => ({
        userId,
        userEmail: data.email,
        eventCount: data.count,
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);

    // Calculate average response time
    const responseTimes = logs
      .filter(log => log.durationMs !== null)
      .map(log => log.durationMs);
    
    if (responseTimes.length > 0) {
      summary.averageResponseTime = 
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    return summary;
  }

  /**
   * Get security events for monitoring
   */
  async getSecurityEvents(
    organizationId: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: {
        organizationId,
        action: In([
          AuditAction.FAILED_AUTH,
          AuditAction.RATE_LIMIT_EXCEEDED,
          AuditAction.PERMISSION_DENIED,
        ]),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get user activity timeline
   */
  async getUserActivity(
    userId: string,
    organizationId: string,
    days = 30,
  ): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditLogRepository.find({
      where: {
        userId,
        organizationId,
        createdAt: Between(startDate, new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const result = await this.auditLogRepository.delete({
        createdAt: LessThan(cutoffDate),
      });

      this.logger.log(`Cleaned up ${result.affected} audit logs older than ${cutoffDate}`);
    } catch (error) {
      this.logger.error('Failed to cleanup old audit logs', error);
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(organizationId: string): Promise<any[]> {
    const alerts = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check for multiple failed auth attempts
    const failedAuthAttempts = await this.auditLogRepository.count({
      where: {
        organizationId,
        action: AuditAction.FAILED_AUTH,
        createdAt: Between(oneHourAgo, new Date()),
      },
    });

    if (failedAuthAttempts > 10) {
      alerts.push({
        type: 'MULTIPLE_FAILED_AUTH',
        severity: 'HIGH',
        count: failedAuthAttempts,
        message: `${failedAuthAttempts} failed authentication attempts in the last hour`,
      });
    }

    // Check for rate limit violations
    const rateLimitViolations = await this.auditLogRepository.count({
      where: {
        organizationId,
        action: AuditAction.RATE_LIMIT_EXCEEDED,
        createdAt: Between(oneHourAgo, new Date()),
      },
    });

    if (rateLimitViolations > 50) {
      alerts.push({
        type: 'EXCESSIVE_RATE_LIMITING',
        severity: 'MEDIUM',
        count: rateLimitViolations,
        message: `${rateLimitViolations} rate limit violations in the last hour`,
      });
    }

    return alerts;
  }
}