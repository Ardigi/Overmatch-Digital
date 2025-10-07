import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiKey } from './api-key.entity';

@Entity('api_key_usage')
@Index(['apiKeyId', 'createdAt'])
@Index(['endpoint'])
@Index(['statusCode'])
@Index(['createdAt'])
export class ApiKeyUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  apiKeyId: string;

  @ManyToOne(() => ApiKey)
  @JoinColumn({ name: 'apiKeyId' })
  apiKey: ApiKey;

  @Column()
  endpoint: string;

  @Column()
  method: string;

  @Column()
  statusCode: number;

  @Column({ type: 'bigint' })
  responseTime: number; // in milliseconds

  @Column({ type: 'bigint', nullable: true })
  requestSize: number; // in bytes

  @Column({ type: 'bigint', nullable: true })
  responseSize: number; // in bytes

  @Column()
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ type: 'simple-json', nullable: true })
  headers: Record<string, string>;

  @Column({ type: 'simple-json', nullable: true })
  queryParams: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  errorCode: string;

  @CreateDateColumn()
  createdAt: Date;
}
