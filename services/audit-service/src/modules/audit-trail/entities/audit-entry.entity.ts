import * as crypto from 'crypto';
import { BeforeInsert, Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/entities/base.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  SUBMIT = 'SUBMIT',
  ASSIGN = 'ASSIGN',
  EXECUTE = 'EXECUTE',
  CUSTOM = 'CUSTOM',
}

export enum AuditResource {
  CLIENT = 'CLIENT',
  CONTROL = 'CONTROL',
  POLICY = 'POLICY',
  EVIDENCE = 'EVIDENCE',
  FINDING = 'FINDING',
  RISK = 'RISK',
  WORKFLOW = 'WORKFLOW',
  REPORT = 'REPORT',
  USER = 'USER',
  ROLE = 'ROLE',
  INTEGRATION = 'INTEGRATION',
  WEBHOOK = 'WEBHOOK',
  ASSESSMENT = 'ASSESSMENT',
  FRAMEWORK = 'FRAMEWORK',
  DOCUMENT = 'DOCUMENT',
  SYSTEM = 'SYSTEM',
}

export enum AuditSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface AuditContext {
  service?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
  sessionId?: string;
  correlationId?: string;
  tags?: string[];
}

export interface AuditMetadata {
  browser?: string;
  os?: string;
  device?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  network?: {
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
  };
}

@Entity('audit_entries')
@Index(['organizationId', 'timestamp'])
@Index(['userId', 'timestamp'])
@Index(['action', 'resource'])
@Index(['resourceId'])
@Index(['timestamp'])
@Index(['severity'])
@Index(['checksum'])
export class AuditEntry extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 255 })
  userEmail: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userRole?: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditResource,
  })
  resource: AuditResource;

  @Column({ type: 'uuid', nullable: true })
  resourceId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceName?: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: AuditSeverity,
    default: AuditSeverity.INFO,
  })
  severity: AuditSeverity;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent?: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValue?: any;

  @Column({ type: 'jsonb', nullable: true })
  newValue?: any;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, { old: any; new: any }>;

  @Column({ type: 'jsonb', nullable: true })
  context?: AuditContext;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: AuditMetadata;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  affectedUsers?: string[]; // Array of user IDs affected by this action

  @Column({ type: 'varchar', length: 255, nullable: true })
  relatedEntries?: string[]; // Array of related audit entry IDs

  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  @Column({ type: 'uuid', nullable: true })
  previousEntryId?: string;

  @Column({ type: 'boolean', default: false })
  isAnomaly: boolean;

  @Column({ type: 'text', nullable: true })
  anomalyReason?: string;

  @Column({ type: 'integer', default: 0 })
  riskScore: number;

  @Column({ type: 'boolean', default: false })
  requiresReview: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string;

  // Computed properties
  get isHighRisk(): boolean {
    return (
      this.severity === AuditSeverity.HIGH ||
      this.severity === AuditSeverity.CRITICAL ||
      this.riskScore >= 70
    );
  }

  get changeCount(): number {
    return this.changes ? Object.keys(this.changes).length : 0;
  }

  get hasChanges(): boolean {
    return this.changeCount > 0;
  }

  // Methods
  @BeforeInsert()
  generateChecksum() {
    const data = JSON.stringify({
      organizationId: this.organizationId,
      userId: this.userId,
      action: this.action,
      resource: this.resource,
      resourceId: this.resourceId,
      timestamp: this.timestamp,
      oldValue: this.oldValue,
      newValue: this.newValue,
      ipAddress: this.ipAddress,
    });

    this.checksum = crypto.createHash('sha256').update(data).digest('hex');
  }

  calculateRiskScore(): number {
    let score = 0;

    // Base score by severity
    switch (this.severity) {
      case AuditSeverity.CRITICAL:
        score += 50;
        break;
      case AuditSeverity.HIGH:
        score += 30;
        break;
      case AuditSeverity.MEDIUM:
        score += 15;
        break;
      case AuditSeverity.LOW:
        score += 5;
        break;
    }

    // Action-based scoring
    switch (this.action) {
      case AuditAction.DELETE:
        score += 20;
        break;
      case AuditAction.APPROVE:
      case AuditAction.REJECT:
        score += 15;
        break;
      case AuditAction.EXPORT:
        score += 10;
        break;
      case AuditAction.UPDATE:
        score += 5;
        break;
    }

    // Resource-based scoring
    switch (this.resource) {
      case AuditResource.USER:
      case AuditResource.ROLE:
        score += 15;
        break;
      case AuditResource.POLICY:
      case AuditResource.CONTROL:
        score += 10;
        break;
      case AuditResource.FINDING:
      case AuditResource.RISK:
        score += 10;
        break;
    }

    // Additional factors
    if (!this.success) score += 10;
    if (this.isAnomaly) score += 20;
    if (this.metadata?.network?.vpn) score += 5;
    if (this.metadata?.network?.tor) score += 15;
    if (this.affectedUsers && this.affectedUsers.length > 5) score += 10;

    return Math.min(100, score);
  }

  detectChanges(oldValue: any, newValue: any): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    if (!oldValue || !newValue) return changes;

    // Compare objects
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

    for (const key of allKeys) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changes[key] = {
          old: oldValue[key],
          new: newValue[key],
        };
      }
    }

    return changes;
  }

  static createEntry(data: Partial<AuditEntry>): AuditEntry {
    const entry = new AuditEntry();
    Object.assign(entry, data);

    // Set defaults
    entry.timestamp = entry.timestamp || new Date();
    entry.success = entry.success !== undefined ? entry.success : true;
    entry.severity = entry.severity || AuditSeverity.INFO;

    // Calculate risk score
    entry.riskScore = entry.calculateRiskScore();

    // Detect changes if old and new values provided
    if (entry.oldValue && entry.newValue) {
      entry.changes = entry.detectChanges(entry.oldValue, entry.newValue);
    }

    return entry;
  }
}
