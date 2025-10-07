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
import { User } from '../../users/entities/user.entity';
import { SsoProvider } from './sso-provider.entity';

@Entity('sso_sessions')
@Index(['userId'])
@Index(['ssoProviderId'])
@Index(['sessionIndex'])
@Index(['expiresAt'])
export class SsoSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  ssoProviderId: string;

  @ManyToOne(() => SsoProvider)
  @JoinColumn({ name: 'ssoProviderId' })
  ssoProvider: SsoProvider;

  @Column({ unique: true })
  sessionIndex: string;

  @Column({ nullable: true })
  nameId: string;

  @Column({ nullable: true })
  nameIdFormat: string;

  @Column({ type: 'simple-json', nullable: true })
  attributes: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  samlResponse: string;

  @Column({ type: 'text', nullable: true })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string;

  @Column({ type: 'text', nullable: true })
  idToken: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }
}
