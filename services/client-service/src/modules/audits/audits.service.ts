import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { Between, ILike, In, Repository } from 'typeorm';
import type { CreateAuditTrailDto, QueryAuditTrailDto } from './dto';
import {
  AuditAction,
  type AuditResourceType,
  AuditTrail,
} from './entities/audit-trail.entity';

@Injectable()
export class AuditsService {
  private readonly logger = new Logger(AuditsService.name);

  constructor(
    @InjectRepository(AuditTrail)
    private readonly auditTrailRepository: Repository<AuditTrail>,
    private readonly serviceDiscovery: ServiceDiscoveryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createAuditTrailDto: CreateAuditTrailDto): Promise<AuditTrail> {
    const auditTrail = this.auditTrailRepository.create(createAuditTrailDto);
    const savedAuditTrail = await this.auditTrailRepository.save(auditTrail);

    // Handle high-risk actions
    if (savedAuditTrail.isHighRisk) {
      // Emit local event
      this.eventEmitter.emit('audit.high-risk', {
        auditTrail: savedAuditTrail,
        timestamp: new Date(),
      });
      
      // Notify security team through notification service
      await this.notifySecurityTeam(savedAuditTrail);
    }

    return savedAuditTrail;
  }

  async findAll(query: QueryAuditTrailDto): Promise<{
    data: AuditTrail[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      page = 1,
      limit = 20,
      action,
      actions,
      resourceType,
      resourceId,
      userId,
      clientId,
      organizationId,
      startDate,
      endDate,
      isSystemAction,
      isSensitive,
      highRiskOnly,
      search,
      ipAddress,
      sessionId,
      complianceFramework,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.auditTrailRepository.createQueryBuilder('audit');

    // Filters
    if (action) {
      queryBuilder.andWhere('audit.action = :action', { action });
    }

    if (actions && actions.length > 0) {
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions });
    }

    if (resourceType) {
      queryBuilder.andWhere('audit.resourceType = :resourceType', { resourceType });
    }

    if (resourceId) {
      queryBuilder.andWhere('audit.resourceId = :resourceId', { resourceId });
    }

    if (userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId });
    }

    if (clientId) {
      queryBuilder.andWhere('audit.clientId = :clientId', { clientId });
    }

    if (organizationId) {
      queryBuilder.andWhere('audit.organizationId = :organizationId', { organizationId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    if (isSystemAction !== undefined) {
      queryBuilder.andWhere('audit.isSystemAction = :isSystemAction', { isSystemAction });
    }

    if (isSensitive !== undefined) {
      queryBuilder.andWhere('audit.isSensitive = :isSensitive', { isSensitive });
    }

    if (highRiskOnly) {
      const highRiskActions = [
        AuditAction.DELETE,
        AuditAction.PERMISSION_CHANGE,
        AuditAction.CONTRACT_TERMINATED,
        AuditAction.DOCUMENT_DELETED,
      ];
      queryBuilder.andWhere(
        '(audit.action IN (:...highRiskActions) OR audit.riskLevel = :highRisk)',
        {
          highRiskActions,
          highRisk: 'high',
        },
      );
    }

    if (search) {
      queryBuilder.andWhere(
        '(audit.description ILIKE :search OR audit.resourceName ILIKE :search OR audit.userName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (ipAddress) {
      queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress });
    }

    if (sessionId) {
      queryBuilder.andWhere('audit.sessionId = :sessionId', { sessionId });
    }

    if (complianceFramework) {
      queryBuilder.andWhere('audit.complianceFramework = :complianceFramework', {
        complianceFramework,
      });
    }

    // Relations
    queryBuilder.leftJoinAndSelect('audit.client', 'client');

    // Sorting
    const validSortFields = [
      'timestamp',
      'action',
      'resourceType',
      'userName',
      'riskLevel',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
    queryBuilder.orderBy(`audit.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<AuditTrail> {
    return this.auditTrailRepository.findOne({
      where: { id },
      relations: ['client'],
    });
  }

  async findByResource(
    resourceType: AuditResourceType,
    resourceId: string,
  ): Promise<AuditTrail[]> {
    return this.auditTrailRepository.find({
      where: { resourceType, resourceId },
      order: { timestamp: 'DESC' },
    });
  }

  async findByUser(userId: string, limit: number = 50): Promise<AuditTrail[]> {
    return this.auditTrailRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async findByClient(clientId: string, limit: number = 100): Promise<AuditTrail[]> {
    return this.auditTrailRepository.find({
      where: { clientId },
      order: { timestamp: 'DESC' },
      take: limit,
      relations: ['client'],
    });
  }

  async getComplianceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    complianceFramework?: string,
  ): Promise<{
    summary: {
      totalActions: number;
      uniqueUsers: number;
      actionBreakdown: Record<string, number>;
      resourceBreakdown: Record<string, number>;
      highRiskActions: number;
      sensitiveActions: number;
    };
    timeline: Array<{
      date: string;
      count: number;
    }>;
    userActivity: Array<{
      userId: string;
      userName: string;
      actionCount: number;
      lastActivity: Date;
    }>;
    highRiskEvents: AuditTrail[];
  }> {
    const baseQuery: any = {
      organizationId,
      timestamp: Between(startDate, endDate),
    };

    if (complianceFramework) {
      baseQuery.complianceFramework = complianceFramework;
    }

    const audits = await this.auditTrailRepository.find({
      where: baseQuery,
      order: { timestamp: 'DESC' },
    });

    // Calculate summary
    const actionBreakdown: Record<string, number> = {};
    const resourceBreakdown: Record<string, number> = {};
    const userMap = new Map<string, { name: string; count: number; lastActivity: Date }>();
    const timeline = new Map<string, number>();

    let highRiskCount = 0;
    let sensitiveCount = 0;
    const highRiskEvents: AuditTrail[] = [];

    audits.forEach(audit => {
      // Action breakdown
      actionBreakdown[audit.action] = (actionBreakdown[audit.action] || 0) + 1;

      // Resource breakdown
      resourceBreakdown[audit.resourceType] =
        (resourceBreakdown[audit.resourceType] || 0) + 1;

      // User activity
      const userInfo = userMap.get(audit.userId) || {
        name: audit.userName,
        count: 0,
        lastActivity: audit.timestamp,
      };
      userInfo.count++;
      if (audit.timestamp > userInfo.lastActivity) {
        userInfo.lastActivity = audit.timestamp;
      }
      userMap.set(audit.userId, userInfo);

      // Timeline
      const dateKey = audit.timestamp.toISOString().split('T')[0];
      timeline.set(dateKey, (timeline.get(dateKey) || 0) + 1);

      // High risk and sensitive
      if (audit.isHighRisk) {
        highRiskCount++;
        if (highRiskEvents.length < 10) {
          highRiskEvents.push(audit);
        }
      }
      if (audit.isSensitive) {
        sensitiveCount++;
      }
    });

    // Format results
    const userActivity = Array.from(userMap.entries())
      .map(([userId, info]) => ({
        userId,
        userName: info.name,
        actionCount: info.count,
        lastActivity: info.lastActivity,
      }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    const timelineArray = Array.from(timeline.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const report = {
      summary: {
        totalActions: audits.length,
        uniqueUsers: userMap.size,
        actionBreakdown,
        resourceBreakdown,
        highRiskActions: highRiskCount,
        sensitiveActions: sensitiveCount,
      },
      timeline: timelineArray,
      userActivity,
      highRiskEvents,
    };

    // Send report to reporting service for long-term storage and analysis
    await this.sendAuditReportToReportingService(organizationId, report);

    return report;
  }

  async export(
    query: QueryAuditTrailDto,
    format: 'csv' | 'json' = 'json',
  ): Promise<string | any[]> {
    const { data } = await this.findAll({ ...query, limit: 10000 });

    if (format === 'json') {
      return data.map(audit => audit.toCompliance());
    }

    // CSV format
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource Type',
      'Resource ID',
      'Description',
      'IP Address',
      'Risk Level',
    ];

    const rows = data.map(audit => [
      audit.timestamp.toISOString(),
      `${audit.userName} (${audit.userEmail || audit.userId})`,
      audit.action,
      audit.resourceType,
      audit.resourceId,
      audit.description || audit.summary,
      audit.ipAddress || 'N/A',
      audit.riskLevel || 'normal',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredAudits(): Promise<void> {
    this.logger.log('Starting cleanup of expired audit trails');

    const result = await this.auditTrailRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} expired audit trails`);
  }

  // Helper method to track actions from controllers/services
  async trackAction(params: {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
    resourceName?: string;
    user: {
      id: string;
      name: string;
      email?: string;
      role?: string;
    };
    clientId?: string;
    organizationId?: string;
    organizationName?: string;
    description?: string;
    changes?: any;
    metadata?: any;
    request?: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      method?: string;
      path?: string;
    };
  }): Promise<AuditTrail> {
    const auditData: CreateAuditTrailDto = {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      userId: params.user.id,
      userName: params.user.name,
      userEmail: params.user.email,
      userRole: params.user.role,
      clientId: params.clientId,
      organizationId: params.organizationId,
      organizationName: params.organizationName,
      description: params.description,
      changes: params.changes,
      metadata: {
        ...params.metadata,
        ipAddress: params.request?.ip,
        userAgent: params.request?.userAgent,
        sessionId: params.request?.sessionId,
        method: params.request?.method,
        endpoint: params.request?.path,
      },
      ipAddress: params.request?.ip,
      userAgent: params.request?.userAgent,
      sessionId: params.request?.sessionId,
    };

    return this.create(auditData);
  }

  /**
   * Send audit report to reporting service for processing
   */
  async sendAuditReportToReportingService(
    organizationId: string,
    report: any,
  ): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'reporting-service',
        'POST',
        '/reports/audit-trails',
        {
          organizationId,
          report,
          generatedAt: new Date(),
        },
      );
      this.logger.log(`Sent audit report to reporting service for org ${organizationId}`);
    } catch (error) {
      this.logger.error('Failed to send audit report to reporting service:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Notify security team of high-risk events
   */
  async notifySecurityTeam(auditTrail: AuditTrail): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/notifications',
        {
          type: 'security_alert',
          urgency: 'high',
          to: 'security-team',
          template: 'high_risk_audit_event',
          data: {
            action: auditTrail.action,
            resourceType: auditTrail.resourceType,
            resourceId: auditTrail.resourceId,
            userName: auditTrail.userName,
            timestamp: auditTrail.timestamp,
            ipAddress: auditTrail.ipAddress,
            description: auditTrail.description,
          },
        },
      );
    } catch (error) {
      this.logger.error('Failed to notify security team:', error);
    }
  }
}