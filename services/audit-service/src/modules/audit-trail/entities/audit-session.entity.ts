import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { AuditEntry } from './audit-entry.entity';

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  SUSPICIOUS = 'SUSPICIOUS',
}

export interface SessionMetadata {
  loginMethod?: 'password' | 'sso' | 'mfa' | 'api_key';
  mfaUsed?: boolean;
  deviceFingerprint?: string;
  geoLocation?: {
    country?: string;
    city?: string;
    region?: string;
    timezone?: string;
  };
  riskFactors?: string[];
}

@Entity('audit_sessions')
@Index(['organizationId', 'userId'])
@Index(['sessionToken'])
@Index(['status'])
@Index(['startTime', 'endTime'])
export class AuditSession extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  userEmail: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  sessionToken: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityTime?: Date;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: SessionMetadata;

  @Column({ type: 'integer', default: 0 })
  activityCount: number;

  @Column({ type: 'integer', default: 0 })
  errorCount: number;

  @Column({ type: 'integer', default: 0 })
  warningCount: number;

  @Column({ type: 'jsonb', nullable: true })
  ipAddressHistory?: string[];

  @Column({ type: 'jsonb', nullable: true })
  accessedResources?: Record<string, number>; // Resource type -> access count

  @Column({ type: 'boolean', default: false })
  isAnomaly: boolean;

  @Column({ type: 'text', nullable: true })
  anomalyReason?: string;

  @Column({ type: 'integer', default: 0 })
  riskScore: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRiskAssessment?: Date;

  // Computed properties
  get duration(): number {
    if (!this.endTime) {
      return Date.now() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }

  get isExpired(): boolean {
    if (this.status !== SessionStatus.ACTIVE) return true;

    // Session expires after 24 hours of inactivity
    const inactivityLimit = 24 * 60 * 60 * 1000;
    const lastActivity = this.lastActivityTime || this.startTime;
    return Date.now() - lastActivity.getTime() > inactivityLimit;
  }

  get averageActivityRate(): number {
    if (this.activityCount === 0) return 0;
    return this.activityCount / (this.duration / 1000 / 60); // Activities per minute
  }

  // Relations
  @OneToMany(
    () => AuditEntry,
    (entry) => entry.context
  )
  auditEntries: AuditEntry[];

  // Methods
  recordActivity(): void {
    this.activityCount++;
    this.lastActivityTime = new Date();
  }

  recordError(): void {
    this.errorCount++;
    this.recordActivity();
  }

  recordWarning(): void {
    this.warningCount++;
    this.recordActivity();
  }

  addIpAddress(ip: string): void {
    if (!this.ipAddressHistory) {
      this.ipAddressHistory = [];
    }

    if (!this.ipAddressHistory.includes(ip)) {
      this.ipAddressHistory.push(ip);

      // Multiple IP addresses might indicate suspicious activity
      if (this.ipAddressHistory.length > 3) {
        this.isAnomaly = true;
        this.anomalyReason = 'Multiple IP addresses detected';
      }
    }
  }

  recordResourceAccess(resource: string): void {
    if (!this.accessedResources) {
      this.accessedResources = {};
    }

    this.accessedResources[resource] = (this.accessedResources[resource] || 0) + 1;
  }

  calculateRiskScore(): number {
    let score = 0;

    // IP address changes
    if (this.ipAddressHistory && this.ipAddressHistory.length > 1) {
      score += this.ipAddressHistory.length * 5;
    }

    // High error rate
    const errorRate = this.activityCount > 0 ? this.errorCount / this.activityCount : 0;
    if (errorRate > 0.1) score += 20;
    else if (errorRate > 0.05) score += 10;

    // Suspicious patterns
    if (this.isAnomaly) score += 30;

    // Long session duration (>8 hours)
    if (this.duration > 8 * 60 * 60 * 1000) score += 10;

    // High activity rate (>100 per minute)
    if (this.averageActivityRate > 100) score += 15;

    // Metadata factors
    if (!this.metadata?.mfaUsed) score += 10;
    if (this.metadata?.riskFactors && this.metadata.riskFactors.length > 0) {
      score += this.metadata.riskFactors.length * 5;
    }

    // Status
    if (this.status === SessionStatus.SUSPICIOUS) score += 25;

    return Math.min(100, score);
  }

  terminate(reason?: string): void {
    this.status = SessionStatus.TERMINATED;
    this.endTime = new Date();

    if (reason) {
      this.anomalyReason = reason;
    }
  }

  expire(): void {
    this.status = SessionStatus.EXPIRED;
    this.endTime = new Date();
  }

  markSuspicious(reason: string): void {
    this.status = SessionStatus.SUSPICIOUS;
    this.isAnomaly = true;
    this.anomalyReason = reason;
    this.riskScore = this.calculateRiskScore();
  }
}
