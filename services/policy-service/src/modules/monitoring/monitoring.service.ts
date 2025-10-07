import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MonitoringMetadata } from '../shared/types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuditAction, AuditLog } from '../audit/entities/audit-log.entity';

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metadata: MonitoringMetadata;
  timestamp: Date;
  organizationId: string;
  resolved: boolean;
}

export enum SecurityAlertType {
  MULTIPLE_FAILED_AUTH = 'MULTIPLE_FAILED_AUTH',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  RATE_LIMIT_ABUSE = 'RATE_LIMIT_ABUSE',
  SUSPICIOUS_API_KEY_USAGE = 'SUSPICIOUS_API_KEY_USAGE',
  PERMISSION_ESCALATION = 'PERMISSION_ESCALATION',
  ANOMALOUS_ACCESS_PATTERN = 'ANOMALOUS_ACCESS_PATTERN',
  DATA_EXFILTRATION_ATTEMPT = 'DATA_EXFILTRATION_ATTEMPT',
  POLICY_TAMPERING = 'POLICY_TAMPERING',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

interface AlertThresholds {
  failedAuthAttempts: number;
  failedAuthWindow: number; // minutes
  rateLimitViolations: number;
  rateLimitWindow: number; // minutes
  suspiciousDownloads: number;
  suspiciousDownloadWindow: number; // minutes
  apiKeyAnomalyThreshold: number; // percentage deviation
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly alerts: Map<string, SecurityAlert> = new Map();
  private readonly thresholds: AlertThresholds;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.thresholds = {
      failedAuthAttempts: this.configService.get('policyService.monitoring.failedAuthThreshold', 5),
      failedAuthWindow: this.configService.get('policyService.monitoring.failedAuthWindow', 10),
      rateLimitViolations: this.configService.get('policyService.monitoring.rateLimitThreshold', 20),
      rateLimitWindow: this.configService.get('policyService.monitoring.rateLimitWindow', 5),
      suspiciousDownloads: this.configService.get('policyService.monitoring.downloadThreshold', 50),
      suspiciousDownloadWindow: this.configService.get('policyService.monitoring.downloadWindow', 60),
      apiKeyAnomalyThreshold: this.configService.get('policyService.monitoring.apiKeyAnomalyThreshold', 200),
    };
  }

  /**
   * Monitor security events from audit logs
   */
  @OnEvent('audit.security-event')
  async handleSecurityEvent(auditLog: AuditLog): Promise<void> {
    this.logger.log(`Security event detected: ${auditLog.action} for org ${auditLog.organizationId}`);

    // Check for patterns based on event type
    switch (auditLog.action) {
      case AuditAction.FAILED_AUTH:
        await this.checkFailedAuthPattern(auditLog.organizationId);
        break;
      case AuditAction.RATE_LIMIT_EXCEEDED:
        await this.checkRateLimitAbuse(auditLog.organizationId);
        break;
      case AuditAction.PERMISSION_DENIED:
        await this.checkPermissionEscalation(auditLog);
        break;
    }
  }

  /**
   * Check for brute force authentication attempts
   */
  private async checkFailedAuthPattern(organizationId: string): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.thresholds.failedAuthWindow);

    const failedAttempts = await this.auditLogRepository.count({
      where: {
        organizationId,
        action: AuditAction.FAILED_AUTH,
        createdAt: MoreThan(windowStart),
      },
    });

    if (failedAttempts >= this.thresholds.failedAuthAttempts) {
      // Group by IP to identify source
      const attemptsByIp = await this.auditLogRepository
        .createQueryBuilder('audit')
        .select('audit.metadata->>\'ip\'', 'ip')
        .addSelect('COUNT(*)', 'count')
        .where('audit.organizationId = :organizationId', { organizationId })
        .andWhere('audit.action = :action', { action: AuditAction.FAILED_AUTH })
        .andWhere('audit.createdAt > :windowStart', { windowStart })
        .groupBy('audit.metadata->>\'ip\'')
        .getRawMany();

      const severity = failedAttempts > this.thresholds.failedAuthAttempts * 2
        ? AlertSeverity.CRITICAL
        : AlertSeverity.HIGH;

      await this.createAlert({
        type: SecurityAlertType.BRUTE_FORCE_ATTEMPT,
        severity,
        title: 'Potential Brute Force Attack Detected',
        description: `${failedAttempts} failed authentication attempts in ${this.thresholds.failedAuthWindow} minutes`,
        metadata: {
          failedAttempts,
          attemptsByIp,
          window: `${this.thresholds.failedAuthWindow} minutes`,
          timestamp: new Date(),
          service: 'policy-service',
          environment: process.env.NODE_ENV || 'development',
        },
        organizationId,
      });
    }
  }

  /**
   * Check for rate limit abuse
   */
  private async checkRateLimitAbuse(organizationId: string): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.thresholds.rateLimitWindow);

    const violations = await this.auditLogRepository.count({
      where: {
        organizationId,
        action: AuditAction.RATE_LIMIT_EXCEEDED,
        createdAt: MoreThan(windowStart),
      },
    });

    if (violations >= this.thresholds.rateLimitViolations) {
      await this.createAlert({
        type: SecurityAlertType.RATE_LIMIT_ABUSE,
        severity: AlertSeverity.MEDIUM,
        title: 'Excessive Rate Limit Violations',
        description: `${violations} rate limit violations in ${this.thresholds.rateLimitWindow} minutes`,
        metadata: {
          violations,
          window: `${this.thresholds.rateLimitWindow} minutes`,
          timestamp: new Date(),
          service: 'policy-service',
          environment: process.env.NODE_ENV || 'development',
        },
        organizationId,
      });
    }
  }

  /**
   * Check for permission escalation attempts
   */
  private async checkPermissionEscalation(auditLog: AuditLog): Promise<void> {
    const recentAttempts = await this.auditLogRepository.count({
      where: {
        userId: auditLog.userId,
        action: AuditAction.PERMISSION_DENIED,
        createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)), // 5 minutes
      },
    });

    if (recentAttempts >= 5) {
      await this.createAlert({
        type: SecurityAlertType.PERMISSION_ESCALATION,
        severity: AlertSeverity.HIGH,
        title: 'Possible Permission Escalation Attempt',
        description: `User ${auditLog.userEmail} has multiple permission denied events`,
        metadata: {
          userId: auditLog.userId,
          userEmail: auditLog.userEmail,
          attempts: recentAttempts,
          lastResource: auditLog.resourceType,
          timestamp: new Date(),
          service: 'policy-service',
          environment: process.env.NODE_ENV || 'development',
        },
        organizationId: auditLog.organizationId,
      });
    }
  }

  /**
   * Monitor for data exfiltration attempts
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkDataExfiltration(): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.thresholds.suspiciousDownloadWindow);

    // Find users with excessive downloads
    const suspiciousUsers = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.userId', 'userId')
      .addSelect('audit.userEmail', 'userEmail')
      .addSelect('audit.organizationId', 'organizationId')
      .addSelect('COUNT(*)', 'downloadCount')
      .where('audit.action = :action', { action: AuditAction.DOWNLOAD })
      .andWhere('audit.createdAt > :windowStart', { windowStart })
      .groupBy('audit.userId, audit.userEmail, audit.organizationId')
      .having('COUNT(*) > :threshold', { threshold: this.thresholds.suspiciousDownloads })
      .getRawMany();

    for (const user of suspiciousUsers) {
      await this.createAlert({
        type: SecurityAlertType.DATA_EXFILTRATION_ATTEMPT,
        severity: AlertSeverity.HIGH,
        title: 'Potential Data Exfiltration',
        description: `User ${user.userEmail} downloaded ${user.downloadCount} files in ${this.thresholds.suspiciousDownloadWindow} minutes`,
        metadata: {
          userId: user.userId,
          userEmail: user.userEmail,
          downloadCount: user.downloadCount,
          window: `${this.thresholds.suspiciousDownloadWindow} minutes`,
          timestamp: new Date(),
          service: 'policy-service',
          environment: process.env.NODE_ENV || 'development',
        },
        organizationId: user.organizationId,
      });
    }
  }

  /**
   * Monitor API key usage patterns
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkApiKeyAnomalies(): Promise<void> {
    // This would typically compare against historical baselines
    // For now, we'll check for sudden spikes in usage
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const recentUsage = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.metadata->>\'apiKeyId\'', 'apiKeyId')
      .addSelect('COUNT(*)', 'recentCount')
      .where('audit.metadata->>\'apiKeyId\' IS NOT NULL')
      .andWhere('audit.createdAt > :oneHourAgo', { oneHourAgo })
      .groupBy('audit.metadata->>\'apiKeyId\'')
      .getRawMany();

    const previousUsage = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.metadata->>\'apiKeyId\'', 'apiKeyId')
      .addSelect('COUNT(*)', 'previousCount')
      .where('audit.metadata->>\'apiKeyId\' IS NOT NULL')
      .andWhere('audit.createdAt BETWEEN :twoHoursAgo AND :oneHourAgo', { twoHoursAgo, oneHourAgo })
      .groupBy('audit.metadata->>\'apiKeyId\'')
      .getRawMany();

    // Compare usage patterns
    for (const recent of recentUsage) {
      const previous = previousUsage.find(p => p.apiKeyId === recent.apiKeyId);
      if (previous) {
        const percentageChange = ((recent.recentCount - previous.previousCount) / previous.previousCount) * 100;
        
        if (percentageChange > this.thresholds.apiKeyAnomalyThreshold) {
          await this.createAlert({
            type: SecurityAlertType.SUSPICIOUS_API_KEY_USAGE,
            severity: AlertSeverity.MEDIUM,
            title: 'Anomalous API Key Usage Detected',
            description: `API key ${recent.apiKeyId} shows ${Math.round(percentageChange)}% increase in usage`,
            metadata: {
              apiKeyId: recent.apiKeyId,
              previousCount: previous.previousCount,
              recentCount: recent.recentCount,
              percentageChange: Math.round(percentageChange),
              timestamp: new Date(),
              service: 'policy-service',
              environment: process.env.NODE_ENV || 'development',
            },
            organizationId: 'system', // Would need to fetch from API key
          });
        }
      }
    }
  }

  /**
   * Create and emit a security alert
   */
  private async createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: SecurityAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
    };

    // Store alert
    this.alerts.set(alert.id, alert);

    // Emit for real-time notifications
    this.eventEmitter.emit('security.alert', alert);

    // Log
    this.logger.warn(`Security Alert: ${alert.title}`, alert);

    // Clean up old alerts (keep last 1000)
    if (this.alerts.size > 1000) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());
      
      this.alerts.clear();
      sortedAlerts.slice(0, 1000).forEach(([id, alert]) => {
        this.alerts.set(id, alert);
      });
    }
  }

  /**
   * Get active alerts for an organization
   */
  async getActiveAlerts(organizationId: string): Promise<SecurityAlert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => 
        alert.organizationId === organizationId && 
        !alert.resolved &&
        alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.metadata.resolvedBy = resolvedBy;
      alert.metadata.resolvedAt = new Date();
      
      this.logger.log(`Alert ${alertId} resolved by ${resolvedBy}`);
    }
  }

  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(organizationId: string): Promise<{
    activeAlerts: number;
    criticalAlerts: number;
    last24HourEvents: number;
    topSecurityEvents: Array<{ event: string; count: number }>;
  }> {
    const activeAlerts = await this.getActiveAlerts(organizationId);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const securityEvents = await this.auditLogRepository.count({
      where: {
        organizationId,
        createdAt: MoreThan(oneDayAgo),
        action: AuditAction.FAILED_AUTH || AuditAction.RATE_LIMIT_EXCEEDED || AuditAction.PERMISSION_DENIED,
      },
    });

    const topEvents = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.action', 'event')
      .addSelect('COUNT(*)', 'count')
      .where('audit.organizationId = :organizationId', { organizationId })
      .andWhere('audit.createdAt > :oneDayAgo', { oneDayAgo })
      .andWhere('audit.action IN (:...actions)', {
        actions: [
          AuditAction.FAILED_AUTH,
          AuditAction.RATE_LIMIT_EXCEEDED,
          AuditAction.PERMISSION_DENIED,
        ],
      })
      .groupBy('audit.action')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
      last24HourEvents: securityEvents,
      topSecurityEvents: topEvents,
    };
  }
}