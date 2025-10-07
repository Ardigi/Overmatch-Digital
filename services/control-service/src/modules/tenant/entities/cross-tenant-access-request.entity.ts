import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('cross_tenant_access_requests')
@Index(['sourceTenantId', 'targetTenantId'])
@Index(['status'])
@Index(['requestedAt'])
export class CrossTenantAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourceTenantId: string;

  @Column()
  targetTenantId: string;

  @Column()
  requestedBy: string;

  @Column()
  reason: string;

  @Column()
  resourceType: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column('simple-array', { nullable: true })
  resources?: string[];

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'denied' | 'expired';

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ nullable: true })
  deniedBy?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  requestedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}