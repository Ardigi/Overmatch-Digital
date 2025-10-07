import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SagaStep } from './saga-step.entity';

@Entity('saga_states')
@Index(['correlationId'])
@Index(['status', 'startedAt'])
export class SagaState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'compensating', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Column()
  correlationId: string;

  @Column('jsonb')
  context: Record<string, any>;

  @Column('jsonb', { nullable: true })
  result?: Record<string, any>;

  @Column({ nullable: true })
  error?: string;

  @Column({ nullable: true })
  cancellationReason?: string;

  @Column({ type: 'int', default: 3600000 })
  timeout: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @OneToMany(() => SagaStep, step => step.saga)
  steps: SagaStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}