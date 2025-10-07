import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_logs')
@Index(['url', 'timestamp'])
@Index(['success'])
@Index(['timestamp'])
export class WebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column()
  method: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ nullable: true })
  statusCode?: number;

  @Column({ type: 'jsonb', nullable: true })
  responseBody?: any;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column()
  responseTime: number;

  @Column()
  success: boolean;

  @Column({ default: 0 })
  retryCount: number;

  @CreateDateColumn()
  timestamp: Date;
}