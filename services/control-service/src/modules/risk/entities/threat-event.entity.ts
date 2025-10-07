import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('threat_events')
export class ThreatEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  category: string;

  @Column()
  threatActor: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  likelihood: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  impact: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  riskScore: number;

  @Column({ type: 'text', nullable: true })
  controlIds?: string;

  @Column()
  organizationId: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  lastAssessment?: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextAssessment?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}