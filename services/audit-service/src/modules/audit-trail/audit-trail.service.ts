import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import * as crypto from 'crypto';
import { Between, type FindOptionsWhere, In, LessThan, MoreThan, Repository } from 'typeorm';
import type { AuditReportDto } from './dto/audit-report.dto';
import type { CreateAuditEntryDto } from './dto/create-audit-entry.dto';
import type { SearchAuditEntriesDto } from './dto/search-audit-entries.dto';
import {
  AuditAction,
  AuditEntry,
  AuditResource,
  AuditSeverity,
} from './entities/audit-entry.entity';
import {
  AuditSession,
  SessionStatus,
} from './entities/audit-session.entity';

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditEntryRepository: Repository<AuditEntry>,
    @InjectRepository(AuditSession)
    private readonly auditSessionRepository: Repository<AuditSession>,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  // Audit Entry Management
  async createEntry(data: CreateAuditEntryDto): Promise<AuditEntry> {
    const entry = AuditEntry.createEntry(data);
    
    // Check for anomalies
    await this.detectAnomalies(entry);
    
    // Link to session if provided
    if (data.context?.sessionId) {
      await this.updateSessionActivity(data.context.sessionId, entry);
    }
    
    const savedEntry = await this.auditEntryRepository.save(entry);
    
    // Send compliance alert if high-risk
    await this.sendComplianceAlert(savedEntry);
    
    this.logger.log({
      message: 'Audit entry created',
      action: entry.action,
      resource: entry.resource,
      user: entry.userEmail,
      severity: entry.severity,
    });
    
    return savedEntry;
  }

  async findEntries(search: SearchAuditEntriesDto): Promise<{
    data: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: FindOptionsWhere<AuditEntry> = {};
    
    if (search.organizationId) {
      where.organizationId = search.organizationId;
    }
    
    if (search.userId) {
      where.userId = search.userId;
    }
    
    if (search.action) {
      where.action = search.action;
    }
    
    if (search.resource) {
      where.resource = search.resource;
    }
    
    if (search.resourceId) {
      where.resourceId = search.resourceId;
    }
    
    if (search.severity) {
      where.severity = search.severity;
    }
    
    if (search.success !== undefined) {
      where.success = search.success;
    }
    
    if (search.startDate && search.endDate) {
      where.timestamp = Between(search.startDate, search.endDate);
    } else if (search.startDate) {
      where.timestamp = MoreThan(search.startDate);
    } else if (search.endDate) {
      where.timestamp = LessThan(search.endDate);
    }
    
    if (search.ipAddress) {
      where.ipAddress = search.ipAddress;
    }
    
    if (search.requiresReview) {
      where.requiresReview = true;
      where.reviewedAt = null;
    }
    
    const [data, total] = await this.auditEntryRepository.findAndCount({
      where,
      order: {
        timestamp: 'DESC',
      },
      skip: (search.page - 1) * search.pageSize,
      take: search.pageSize,
    });
    
    return {
      data,
      total,
      page: search.page,
      pageSize: search.pageSize,
    };
  }

  async findEntryById(id: string): Promise<AuditEntry> {
    return this.auditEntryRepository.findOneOrFail({
      where: { id },
    });
  }

  async verifyChecksum(id: string): Promise<boolean> {
    const entry = await this.findEntryById(id);
    
    const data = JSON.stringify({
      organizationId: entry.organizationId,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      timestamp: entry.timestamp,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress,
    });
    
    const calculatedChecksum = crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
    
    return calculatedChecksum === entry.checksum;
  }

  async detectTampering(organizationId: string): Promise<{
    tamperedEntries: AuditEntry[];
    totalChecked: number;
  }> {
    const entries = await this.auditEntryRepository.find({
      where: { organizationId },
      order: { timestamp: 'DESC' },
      take: 1000, // Check last 1000 entries
    });
    
    const tamperedEntries: AuditEntry[] = [];
    
    for (const entry of entries) {
      const isValid = await this.verifyChecksum(entry.id);
      if (!isValid) {
        tamperedEntries.push(entry);
      }
    }
    
    if (tamperedEntries.length > 0) {
      this.logger.error({
        message: 'Tampered audit entries detected',
        organizationId,
        count: tamperedEntries.length,
      });
    }
    
    return {
      tamperedEntries,
      totalChecked: entries.length,
    };
  }

  async reviewEntry(
    id: string,
    reviewerId: string,
    notes?: string,
  ): Promise<AuditEntry> {
    const entry = await this.findEntryById(id);
    
    entry.reviewedAt = new Date();
    entry.reviewedBy = reviewerId;
    entry.reviewNotes = notes;
    entry.requiresReview = false;
    
    return this.auditEntryRepository.save(entry);
  }

  // Session Management
  async createSession(data: {
    organizationId: string;
    userId: string;
    userEmail: string;
    ipAddress: string;
    userAgent?: string;
    sessionToken: string;
    metadata?: any;
  }): Promise<AuditSession> {
    const session = this.auditSessionRepository.create({
      ...data,
      status: SessionStatus.ACTIVE,
      startTime: new Date(),
      activityCount: 0,
      errorCount: 0,
      warningCount: 0,
      riskScore: 0,
    });
    
    return this.auditSessionRepository.save(session);
  }

  async findSessionByToken(token: string): Promise<AuditSession | null> {
    return this.auditSessionRepository.findOne({
      where: { sessionToken: token },
    });
  }

  async updateSessionActivity(
    sessionId: string,
    entry: AuditEntry,
  ): Promise<void> {
    const session = await this.auditSessionRepository.findOne({
      where: { sessionToken: sessionId },
    });
    
    if (!session) return;
    
    // Update activity metrics
    session.recordActivity();
    
    if (!entry.success) {
      session.recordError();
    }
    
    if (entry.severity === AuditSeverity.HIGH || entry.severity === AuditSeverity.CRITICAL) {
      session.recordWarning();
    }
    
    // Track IP address changes
    if (entry.ipAddress !== session.ipAddress) {
      session.addIpAddress(entry.ipAddress);
    }
    
    // Track resource access
    session.recordResourceAccess(entry.resource);
    
    // Recalculate risk score
    session.riskScore = session.calculateRiskScore();
    session.lastRiskAssessment = new Date();
    
    await this.auditSessionRepository.save(session);
  }

  async terminateSession(
    token: string,
    reason?: string,
  ): Promise<AuditSession> {
    const session = await this.findSessionByToken(token);
    if (!session) throw new Error('Session not found');
    
    session.terminate(reason);
    
    return this.auditSessionRepository.save(session);
  }

  // Anomaly Detection
  private async detectAnomalies(entry: AuditEntry): Promise<void> {
    // Check for unusual activity patterns
    const recentEntries = await this.auditEntryRepository.find({
      where: {
        userId: entry.userId,
        timestamp: MoreThan(new Date(Date.now() - 5 * 60 * 1000)), // Last 5 minutes
      },
    });
    
    // High frequency of actions
    if (recentEntries.length > 50) {
      entry.isAnomaly = true;
      entry.anomalyReason = 'High frequency of actions detected';
      entry.riskScore = Math.max(entry.riskScore, 70);
    }
    
    // Multiple failed attempts
    const failedAttempts = recentEntries.filter(e => !e.success);
    if (failedAttempts.length > 5) {
      entry.isAnomaly = true;
      entry.anomalyReason = 'Multiple failed attempts detected';
      entry.riskScore = Math.max(entry.riskScore, 80);
    }
    
    // Unusual time of activity
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      entry.riskScore = Math.max(entry.riskScore, entry.riskScore + 10);
    }
    
    // Sensitive resource access
    if (
      entry.resource === AuditResource.USER ||
      entry.resource === AuditResource.ROLE ||
      entry.action === AuditAction.DELETE ||
      entry.action === AuditAction.EXPORT
    ) {
      entry.requiresReview = true;
    }
  }

  // Reporting
  async generateAuditReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AuditReportDto> {
    const entries = await this.auditEntryRepository.find({
      where: {
        organizationId,
        timestamp: Between(startDate, endDate),
      },
      order: {
        timestamp: 'DESC',
      },
    });
    
    const sessions = await this.auditSessionRepository.find({
      where: {
        organizationId,
        startTime: Between(startDate, endDate),
      },
    });
    
    // Calculate statistics
    const totalEntries = entries.length;
    const failedEntries = entries.filter(e => !e.success).length;
    const anomalies = entries.filter(e => e.isAnomaly).length;
    const highRiskEntries = entries.filter(e => e.isHighRisk).length;
    
    const actionBreakdown: Record<string, number> = {};
    const resourceBreakdown: Record<string, number> = {};
    const userActivity: Record<string, number> = {};
    
    entries.forEach(entry => {
      actionBreakdown[entry.action] = (actionBreakdown[entry.action] || 0) + 1;
      resourceBreakdown[entry.resource] = (resourceBreakdown[entry.resource] || 0) + 1;
      if (entry.userEmail) {
        userActivity[entry.userEmail] = (userActivity[entry.userEmail] || 0) + 1;
      }
    });
    
    const topUsers = Object.entries(userActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));
    
    return {
      organizationId,
      startDate,
      endDate,
      summary: {
        totalEntries,
        successfulEntries: totalEntries - failedEntries,
        failedEntries,
        anomalies,
        highRiskEntries,
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === SessionStatus.ACTIVE).length,
        suspiciousSessions: sessions.filter(s => s.status === SessionStatus.SUSPICIOUS).length,
      },
      actionBreakdown,
      resourceBreakdown,
      topUsers,
      recentAnomalies: entries
        .filter(e => e.isAnomaly)
        .slice(0, 10)
        .map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          user: e.userEmail,
          action: e.action,
          resource: e.resource,
          reason: e.anomalyReason,
        })),
      requiresReview: entries
        .filter(e => e.requiresReview && !e.reviewedAt)
        .slice(0, 20),
    };
  }

  // Scheduled Tasks
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<void> {
    const expiredSessions = await this.auditSessionRepository.find({
      where: {
        status: SessionStatus.ACTIVE,
        lastActivityTime: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      },
    });
    
    for (const session of expiredSessions) {
      session.expire();
      await this.auditSessionRepository.save(session);
    }
    
    this.logger.log({
      message: 'Expired sessions cleaned up',
      count: expiredSessions.length,
    });
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectSuspiciousSessions(): Promise<void> {
    const activeSessions = await this.auditSessionRepository.find({
      where: {
        status: SessionStatus.ACTIVE,
      },
    });
    
    for (const session of activeSessions) {
      const riskScore = session.calculateRiskScore();
      
      if (riskScore >= 70) {
        session.markSuspicious('High risk score detected');
        await this.auditSessionRepository.save(session);
        
        this.logger.warn({
          message: 'Suspicious session detected',
          sessionId: session.id,
          userId: session.userId,
          riskScore,
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async performIntegrityCheck(): Promise<void> {
    const organizations = await this.auditEntryRepository
      .createQueryBuilder('entry')
      .select('DISTINCT entry.organizationId', 'organizationId')
      .getRawMany();
    
    for (const { organizationId } of organizations) {
      const result = await this.detectTampering(organizationId);
      
      if (result.tamperedEntries.length > 0) {
        // Create a system audit entry for the tampering detection
        await this.createEntry({
          organizationId,
          userEmail: 'system',
          action: AuditAction.CUSTOM,
          resource: AuditResource.SYSTEM,
          description: `Tampered audit entries detected: ${result.tamperedEntries.length}`,
          severity: AuditSeverity.CRITICAL,
          timestamp: new Date(),
          ipAddress: 'system',
          success: false,
          requiresReview: true,
        });
      }
    }
  }

  // Event Handlers
  @OnEvent('audit.entry.create')
  async handleAuditEntryCreate(data: CreateAuditEntryDto): Promise<void> {
    await this.createEntry(data);
  }

  @OnEvent('user.login')
  async handleUserLogin(data: {
    organizationId: string;
    userId: string;
    userEmail: string;
    ipAddress: string;
    userAgent?: string;
    sessionToken: string;
    metadata?: any;
  }): Promise<void> {
    await this.createSession(data);
    
    await this.createEntry({
      organizationId: data.organizationId,
      userId: data.userId,
      userEmail: data.userEmail,
      action: AuditAction.LOGIN,
      resource: AuditResource.USER,
      description: 'User logged in',
      severity: AuditSeverity.INFO,
      timestamp: new Date(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      success: true,
      context: {
        sessionId: data.sessionToken,
      },
    });
  }

  @OnEvent('user.logout')
  async handleUserLogout(data: {
    sessionToken: string;
    reason?: string;
  }): Promise<void> {
    const session = await this.findSessionByToken(data.sessionToken);
    if (!session) return;
    
    await this.terminateSession(data.sessionToken, data.reason);
    
    await this.createEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userEmail: session.userEmail,
      action: AuditAction.LOGOUT,
      resource: AuditResource.USER,
      description: 'User logged out',
      severity: AuditSeverity.INFO,
      timestamp: new Date(),
      ipAddress: session.ipAddress,
      success: true,
      context: {
        sessionId: data.sessionToken,
      },
    });
  }

  /**
   * Send compliance alert for high-risk audit entries
   */
  private async sendComplianceAlert(entry: AuditEntry): Promise<void> {
    try {
      if (entry.isHighRisk || entry.riskScore >= 80) {
        const alertPayload = {
          organizationId: entry.organizationId,
          type: 'compliance.high_risk_activity',
          title: 'High-Risk Activity Detected',
          message: `High-risk ${entry.action} on ${entry.resource} by ${entry.userEmail || 'unknown user'}`,
          data: {
            entryId: entry.id,
            action: entry.action,
            resource: entry.resource,
            riskScore: entry.riskScore,
            timestamp: entry.timestamp,
            ipAddress: entry.ipAddress,
            anomalyReason: entry.anomalyReason,
          },
          priority: 'high',
          channels: ['email', 'in_app', 'sms'],
          recipients: ['compliance-team'], // This would be configured per organization
        };

        await this.serviceDiscovery.callService(
          'notification-service',
          'POST',
          '/notifications',
          alertPayload,
        );

        this.logger.warn('Compliance alert sent for high-risk activity', {
          entryId: entry.id,
          riskScore: entry.riskScore,
        });
      }
    } catch (error) {
      this.logger.error('Failed to send compliance alert', {
        entryId: entry.id,
        error: error.message,
      });
    }
  }

  /**
   * Get user activity summary from client service
   */
  async getUserActivitySummary(userId: string, organizationId: string, days: number = 30): Promise<{
    userInfo: any;
    activitySummary: {
      totalActivities: number;
      failedAttempts: number;
      anomalousActivities: number;
      riskScore: number;
      topResources: Array<{ resource: string; count: number }>;
      recentHighRiskActivities: AuditEntry[];
    };
  }> {
    try {
      // Get user information from client service
      const userResponse = await this.serviceDiscovery.callService(
        'client-service',
        'GET',
        `/users/${userId}?organizationId=${organizationId}`,
      );

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get user's audit entries
      const entries = await this.auditEntryRepository.find({
        where: {
          userId,
          organizationId,
          timestamp: Between(startDate, endDate),
        },
        order: { timestamp: 'DESC' },
      });

      // Calculate activity summary
      const totalActivities = entries.length;
      const failedAttempts = entries.filter(e => !e.success).length;
      const anomalousActivities = entries.filter(e => e.isAnomaly).length;
      const avgRiskScore = entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.riskScore, 0) / entries.length 
        : 0;

      // Get top resources accessed
      const resourceCounts = entries.reduce((acc: Record<string, number>, entry) => {
        acc[entry.resource] = (acc[entry.resource] || 0) + 1;
        return acc;
      }, {});

      const topResources = Object.entries(resourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([resource, count]) => ({ resource, count }));

      // Get recent high-risk activities
      const recentHighRiskActivities = entries
        .filter(e => e.isHighRisk || e.riskScore >= 70)
        .slice(0, 10);

      return {
        userInfo: userResponse.data,
        activitySummary: {
          totalActivities,
          failedAttempts,
          anomalousActivities,
          riskScore: Math.round(avgRiskScore),
          topResources,
          recentHighRiskActivities,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user activity summary', {
        userId,
        organizationId,
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve user activity summary');
    }
  }
}