import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';

export interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  details?: any;
  timestamp: Date;
}

export interface SecurityMetrics {
  authentication: {
    successRate: number;
    averageTime: number;
    failureReasons: {
      [key: string]: number;
    };
  };
  security: {
    threatsBlocked: number;
    suspiciousActivities: number;
    incidentsResolved: number;
    mttr: number; // Mean Time To Resolve
  };
}

export interface SecurityIncident {
  incidentId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  assignedTo: string;
  affectedSystems: string[];
  timeline: {
    detected: Date;
    acknowledged: Date | null;
    contained: Date | null;
    resolved: Date | null;
  };
  actions: string[];
}

@Injectable()
export class MonitoringService {
  private readonly alertThresholds = {
    failed_logins: 5,
    api_rate_limit: 1000,
    data_download_size: 100 * 1024 * 1024, // 100MB
  };

  constructor(
    private eventEmitter: EventEmitter2,
    private auditService: AuditService,
    private redisService: RedisService,
    private configService: ConfigService
  ) {
    this.setupEventListeners();
  }

  /**
   * Detect anomalies in authentication patterns
   */
  async detectAnomalies(userId?: string): Promise<{
    detected: Anomaly[];
    timestamp: Date;
    actionsTriggered: string[];
  }> {
    const anomalies: Anomaly[] = [];
    const timestamp = new Date();
    const actionsTriggered: string[] = [];

    // Check for impossible travel
    if (userId) {
      const impossibleTravel = await this.checkImpossibleTravel(userId);
      if (impossibleTravel) {
        anomalies.push({
          type: 'impossible_travel',
          severity: 'high',
          userId,
          details: impossibleTravel,
          timestamp,
        });
      }
    }

    // Check for unusual time access
    const unusualTime = this.checkUnusualTime();
    if (unusualTime) {
      anomalies.push({
        type: 'unusual_time',
        severity: 'medium',
        userId,
        timestamp,
      });
    }

    // Check for multiple failed logins
    const failedLogins = await this.checkFailedLogins(userId);
    if (failedLogins > this.alertThresholds.failed_logins) {
      anomalies.push({
        type: 'multiple_failed_logins',
        severity: 'high',
        userId,
        details: { count: failedLogins },
        timestamp,
      });
      actionsTriggered.push('lock_account');
    }

    // Check for privilege escalation attempts
    const privEscalation = await this.checkPrivilegeEscalation(userId);
    if (privEscalation) {
      anomalies.push({
        type: 'privilege_escalation_attempt',
        severity: 'critical',
        userId,
        details: privEscalation,
        timestamp,
      });
      actionsTriggered.push('alert_security_team');
    }

    if (anomalies.length > 0) {
      actionsTriggered.push('alert_security_team');
    }

    return {
      detected: anomalies,
      timestamp,
      actionsTriggered: [...new Set(actionsTriggered)], // Remove duplicates
    };
  }

  /**
   * Alert on suspicious activity
   */
  async alertOnSuspiciousActivity(activity: {
    type: string;
    count?: number;
    userId?: string;
    details?: any;
  }): Promise<{
    alert: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    notification?: string[];
  }> {
    let alert = false;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const notification: string[] = [];

    switch (activity.type) {
      case 'failed_logins':
        if (activity.count && activity.count > this.alertThresholds.failed_logins) {
          alert = true;
          severity = 'high';
          notification.push('security_team', 'account_owner');
        }
        break;

      case 'api_rate_limit':
        if (activity.count && activity.count > this.alertThresholds.api_rate_limit) {
          alert = true;
          severity = 'medium';
          notification.push('security_team');
        }
        break;

      case 'data_download':
        if (activity.details?.size > this.alertThresholds.data_download_size) {
          alert = true;
          severity = 'high';
          notification.push('security_team', 'data_owner');
        }
        break;

      case 'unauthorized_access':
        alert = true;
        severity = 'critical';
        notification.push('security_team', 'ciso');
        break;
    }

    if (alert) {
      // Log the alert
      await this.auditService.logSuspiciousActivity({
        ...activity,
        severity,
        timestamp: new Date(),
      });

      // Send notifications (in production, integrate with notification service)
      this.eventEmitter.emit('security.alert', {
        activity,
        severity,
        notification,
      });
    }

    return { alert, severity, notification };
  }

  /**
   * Track security performance metrics
   */
  async trackPerformanceMetrics(): Promise<SecurityMetrics> {
    // In production, these would be calculated from actual data
    return {
      authentication: {
        successRate: 0.98,
        averageTime: 250, // ms
        failureReasons: {
          invalid_credentials: 0.7,
          account_locked: 0.2,
          mfa_failure: 0.1,
        },
      },
      security: {
        threatsBlocked: 1523,
        suspiciousActivities: 47,
        incidentsResolved: 45,
        mttr: 4.2, // hours
      },
    };
  }

  /**
   * Report security incident
   */
  async reportSecurityIncidents(incident: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedSystems: string[];
    details?: any;
  }): Promise<SecurityIncident> {
    const incidentId = `INC-${Date.now()}`;
    const now = new Date();

    const response: SecurityIncident = {
      incidentId,
      severity: incident.severity,
      type: incident.type,
      status: 'investigating',
      assignedTo: 'security_team',
      affectedSystems: incident.affectedSystems,
      timeline: {
        detected: now,
        acknowledged: new Date(now.getTime() + 5 * 60 * 1000), // 5 min
        contained: null,
        resolved: null,
      },
      actions: [
        'isolate_affected_systems',
        'preserve_evidence',
        'notify_stakeholders',
        'begin_investigation',
      ],
    };

    // Critical incidents require immediate escalation
    if (incident.severity === 'critical') {
      response.actions.push('escalate_to_ciso');
      response.actions.push('engage_incident_response_team');
    }

    // Store incident in Redis for tracking
    await this.redisService.set(
      `incident:${incidentId}`,
      JSON.stringify(response),
      86400 // 24 hours
    );

    // Emit event for real-time tracking
    this.eventEmitter.emit('security.incident', response);

    return response;
  }

  /**
   * Detect suspicious patterns
   */
  async detectSuspiciousPatterns(): Promise<void> {
    const patterns = [
      { pattern: 'multiple_accounts_same_ip', count: 5 },
      { pattern: 'rapid_reset_requests', count: 10 },
      { pattern: 'automated_behavior', count: 20 },
    ];

    for (const pattern of patterns) {
      if (pattern.count > 10) {
        await this.auditService.logSuspiciousActivity({
          pattern: pattern.pattern,
          severity: 'high',
          action: 'password_reset_abuse',
        });
      }
    }
  }

  /**
   * Private helper methods
   */
  private setupEventListeners(): void {
    // Listen for authentication events
    this.eventEmitter.on('auth.failed', async (event) => {
      await this.handleFailedAuth(event);
    });

    // Listen for suspicious activities
    this.eventEmitter.on('audit.suspicious', async (event) => {
      await this.handleSuspiciousActivity(event);
    });
  }

  private async checkImpossibleTravel(userId: string): Promise<any> {
    // Check user's recent login locations
    const recentLogins = await this.redisService.get<any>(`logins:${userId}`);
    if (!recentLogins) return null;

    // recentLogins is already parsed by Redis service
    const logins = recentLogins;
    // Implement logic to detect impossible travel based on location and time
    // This is a simplified version
    return null;
  }

  private checkUnusualTime(): boolean {
    const hour = new Date().getHours();
    // Consider 2 AM - 5 AM as unusual
    return hour >= 2 && hour <= 5;
  }

  private async checkFailedLogins(userId?: string): Promise<number> {
    const key = userId ? `failed_logins:${userId}` : 'failed_logins:global';
    const count = await this.redisService.get<string>(key);
    return count ? parseInt(count) : 0;
  }

  private async checkPrivilegeEscalation(userId?: string): Promise<any> {
    // Check for attempts to access admin functions without proper roles
    // This would analyze recent requests and permissions
    return null;
  }

  private async handleFailedAuth(event: any): Promise<void> {
    const key = `failed_logins:${event.userId || event.email}`;
    await this.redisService.incr(key);
    await this.redisService.expire(key, 3600); // 1 hour window
  }

  private async handleSuspiciousActivity(event: any): Promise<void> {
    await this.alertOnSuspiciousActivity({
      type: 'suspicious_activity',
      userId: event.userId,
      details: event,
    });
  }
}
