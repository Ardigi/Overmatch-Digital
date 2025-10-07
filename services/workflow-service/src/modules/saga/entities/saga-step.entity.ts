import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SagaState } from './saga-state.entity';

@Entity('saga_steps')
@Index(['sagaId', 'sequence'])
@Index(['sagaId', 'status'])
export class SagaStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sagaId: string;

  @Column()
  name: string;

  @Column()
  service: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  compensateAction?: string;

  @Column({
    type: 'enum',
    enum: [
      'pending',
      'executing',
      'completed',
      'failed',
      'compensating',
      'compensated',
      'compensation_failed',
    ],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'int' })
  sequence: number;

  @Column('jsonb', { nullable: true })
  input?: Record<string, any>;

  @Column('jsonb', { nullable: true })
  output?: Record<string, any>;

  @Column({ nullable: true })
  error?: string;

  @Column({ nullable: true })
  compensationError?: string;

  @Column({ type: 'int', default: 30000 })
  timeout: number;

  @Column({ default: true })
  retryable: boolean;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column('simple-array', { nullable: true })
  dependsOn?: string[];

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  compensatedAt?: Date;

  @ManyToOne(() => SagaState, saga => saga.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sagaId' })
  saga: SagaState;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}