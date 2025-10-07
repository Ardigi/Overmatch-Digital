import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LoginEventType {
  SUCCESS = 'success',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  MFA_REQUIRED = 'mfa_required',
  MFA_FAILED = 'mfa_failed',
}

export enum LoginRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('login_events')
@Index(['userId', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
@Index(['deviceFingerprint', 'createdAt'])
export class LoginEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column()
  email: string;

  @Column({
    type: 'enum',
    enum: LoginEventType,
  })
  eventType: LoginEventType;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  deviceFingerprint?: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo?: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    deviceType?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  location?: {
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    isp?: string;
    isVpn?: boolean;
    isTor?: boolean;
    isProxy?: boolean;
  };

  @Column({
    type: 'enum',
    enum: LoginRiskLevel,
    default: LoginRiskLevel.LOW,
  })
  riskLevel: LoginRiskLevel;

  @Column({ type: 'float', default: 0 })
  riskScore: number;

  @Column({ type: 'jsonb', nullable: true })
  anomalies?: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  behaviorMetrics?: {
    loginTime?: {
      hour: number;
      dayOfWeek: number;
      isUsualTime: boolean;
      deviation: number;
    };
    typing?: {
      speed?: number;
      rhythm?: number;
      pressure?: number;
    };
    mouse?: {
      speed?: number;
      acceleration?: number;
      clickPatterns?: number[];
    };
  };

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
