import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../modules/users/entities/user.entity';

@Entity('user_sessions')
@Index(['userId', 'isActive'])
@Index(['sessionToken'])
@Index(['expiresAt'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'session_token', unique: true })
  sessionToken: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'device_fingerprint', nullable: true })
  deviceFingerprint?: string;

  @Column({ name: 'device_name', nullable: true })
  deviceName?: string;

  @Column({ name: 'device_type', nullable: true })
  deviceType?: string;

  @Column({ name: 'device_os', nullable: true })
  deviceOS?: string;

  @Column({ name: 'device_browser', nullable: true })
  deviceBrowser?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_activity_at', type: 'timestamp' })
  lastActivityAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
