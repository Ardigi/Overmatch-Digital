import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../modules/users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['userId', 'expiresAt'])
@Index(['token'], { unique: true })
@Index(['family'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true })
  token: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  family: string; // Token family for rotation tracking

  @Column({ type: 'varchar', nullable: true })
  sessionId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
    location?: string;
  };

  @CreateDateColumn()
  issuedAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  revokedReason: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  replacedByToken: string;
}
