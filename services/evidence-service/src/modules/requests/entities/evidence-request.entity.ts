import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Evidence } from '../../evidence/entities/evidence.entity';

export enum RequestStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  PARTIALLY_COMPLETE = 'partially_complete',
  COMPLETE = 'complete',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum RequestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RequestType {
  INITIAL = 'initial',
  FOLLOW_UP = 'follow_up',
  CLARIFICATION = 'clarification',
  ADDITIONAL = 'additional',
  REMEDIATION = 'remediation',
  PERIODIC = 'periodic',
  AD_HOC = 'ad_hoc',
}

@Entity('evidence_requests')
@Index(['clientId', 'status'])
@Index(['auditId', 'status'])
@Index(['dueDate'])
@Index(['requestedFrom'])
export class EvidenceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RequestType,
    enumName: 'request_type',
    default: RequestType.INITIAL,
  })
  type: RequestType;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status',
    default: RequestStatus.DRAFT,
  })
  status: RequestStatus;

  @Column({
    type: 'enum',
    enum: RequestPriority,
    enumName: 'request_priority',
    default: RequestPriority.MEDIUM,
  })
  priority: RequestPriority;

  // Relationships
  @Column('uuid')
  clientId: string;

  @Column('uuid')
  auditId: string;

  @Column('uuid', { nullable: true })
  parentRequestId?: string;

  @OneToMany(
    () => Evidence,
    evidence => evidence.requestId
  )
  evidence: Evidence[];

  // Request Details
  @Column({ type: 'jsonb' })
  requestedItems: Array<{
    id: string;
    name: string;
    description?: string;
    type: string;
    controlId?: string;
    framework?: string;
    required: boolean;
    evidenceType?: string;
    acceptedFormats?: string[];
    sampleProvided?: boolean;
    sampleUrl?: string;
    instructions?: string;
    completionStatus?: 'pending' | 'submitted' | 'approved' | 'rejected';
    submittedEvidenceId?: string;
    submittedDate?: Date;
    reviewNotes?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  templates?: Array<{
    id: string;
    name: string;
    url: string;
    description?: string;
  }>;

  // People
  @Column('uuid')
  requestedBy: string;

  @Column()
  requestedByName: string;

  @Column({ nullable: true })
  requestedByEmail?: string;

  @Column('uuid')
  requestedFrom: string;

  @Column()
  requestedFromName: string;

  @Column({ nullable: true })
  requestedFromEmail?: string;

  @Column({ type: 'simple-array', nullable: true })
  ccRecipients?: string[];

  @Column('uuid', { nullable: true })
  assignedTo?: string;

  // Dates
  @Column({ type: 'timestamptz' })
  dueDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledDate?: Date;

  // Communication
  @Column({ type: 'jsonb', nullable: true })
  communications?: Array<{
    id: string;
    type: 'email' | 'comment' | 'notification' | 'reminder';
    from: string;
    to: string[];
    subject?: string;
    message: string;
    timestamp: Date;
    read?: boolean;
    attachments?: Array<{
      name: string;
      url: string;
      size: number;
    }>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  reminders?: Array<{
    id: string;
    scheduledDate: Date;
    sentDate?: Date;
    type: 'email' | 'in_app' | 'sms';
    recipients: string[];
    message?: string;
    status: 'scheduled' | 'sent' | 'failed';
  }>;

  // Progress Tracking
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  progressHistory?: Array<{
    timestamp: Date;
    percentage: number;
    itemsCompleted: number;
    totalItems: number;
    updatedBy: string;
  }>;

  // Compliance
  @Column({ type: 'jsonb', nullable: true })
  complianceContext?: {
    framework: string;
    controls: string[];
    auditPeriod?: {
      start: Date;
      end: Date;
    };
    requirements?: string[];
    notes?: string;
  };

  // Settings
  @Column({ type: 'jsonb', nullable: true })
  settings?: {
    allowPartialSubmission?: boolean;
    requireApprovalBeforeComplete?: boolean;
    autoReminders?: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'custom';
      beforeDueDateDays?: number[];
    };
    notifications?: {
      onSubmission: boolean;
      onApproval: boolean;
      onRejection: boolean;
      onComment: boolean;
    };
    escalation?: {
      enabled: boolean;
      afterDays: number;
      escalateTo: string[];
    };
  };

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Computed properties
  get isOverdue(): boolean {
    return (
      this.status !== RequestStatus.COMPLETE &&
      this.status !== RequestStatus.CANCELLED &&
      new Date() > this.dueDate
    );
  }

  get daysUntilDue(): number {
    const now = new Date();
    const due = new Date(this.dueDate);
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  get itemsCompleted(): number {
    if (!this.requestedItems) return 0;
    return this.requestedItems.filter(item => item.completionStatus === 'approved').length;
  }

  get totalItems(): number {
    return this.requestedItems?.length || 0;
  }

  // Methods
  updateProgress(): void {
    const completed = this.itemsCompleted;
    const total = this.totalItems;

    this.completionPercentage = total > 0 ? (completed / total) * 100 : 0;

    if (!this.progressHistory) this.progressHistory = [];
    this.progressHistory.push({
      timestamp: new Date(),
      percentage: this.completionPercentage,
      itemsCompleted: completed,
      totalItems: total,
      updatedBy: this.updatedBy,
    });
  }

  addCommunication(communication: any): void {
    if (!this.communications) this.communications = [];
    this.communications.push({
      id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...communication,
      timestamp: new Date(),
    });
  }

  scheduleReminder(reminder: any): void {
    if (!this.reminders) this.reminders = [];
    this.reminders.push({
      id: `rem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...reminder,
      status: 'scheduled',
    });
  }

  markItemComplete(itemId: string, evidenceId: string): void {
    const item = this.requestedItems?.find(i => i.id === itemId);
    if (item) {
      item.completionStatus = 'submitted';
      item.submittedEvidenceId = evidenceId;
      item.submittedDate = new Date();
      this.updateProgress();
    }
  }

  getCompletionStats(): {
    total: number;
    pending: number;
    submitted: number;
    approved: number;
    rejected: number;
  } {
    const stats = {
      total: this.totalItems,
      pending: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    };

    this.requestedItems?.forEach(item => {
      switch (item.completionStatus) {
        case 'pending':
          stats.pending++;
          break;
        case 'submitted':
          stats.submitted++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        default:
          stats.pending++;
      }
    });

    return stats;
  }
}
