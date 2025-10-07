import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('tenant_access_logs')
@Index(['tenantId', 'userId'])
@Index(['timestamp'])
export class TenantAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  userId: string;

  @Column()
  operation: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ default: 'SUCCESS' })
  result: string;

  @Column({ nullable: true })
  reason?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ type: 'int', nullable: true })
  performanceMs?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}