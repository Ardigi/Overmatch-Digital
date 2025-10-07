import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type OperationType =
  | 'SYNC'
  | 'TEST_CONNECTION'
  | 'HEALTH_CHECK'
  | 'AUTH'
  | 'API_CALL'
  | 'WEBHOOK'
  | 'CONFIGURATION'
  | 'ERROR';

export interface RequestData {
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
}

export interface ResponseData {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: any;
  recordsCount?: number;
  error?: string;
}

@Entity('integration_logs')
@Index(['integrationId', 'timestamp'])
@Index(['integrationId', 'operationType'])
@Index(['integrationId', 'success'])
@Index(['timestamp'])
export class IntegrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  integrationId: string;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integrationId' })
  integration: Integration;

  @CreateDateColumn()
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    default: 'INFO',
  })
  logLevel: LogLevel;

  @Column()
  operationType: OperationType;

  @Column()
  success: boolean;

  @Column()
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  requestData?: RequestData;

  @Column({ type: 'jsonb', nullable: true })
  responseData?: ResponseData;

  @Column({ type: 'int', nullable: true })
  duration?: number; // in milliseconds

  @Column({ type: 'text', nullable: true })
  errorDetails?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
