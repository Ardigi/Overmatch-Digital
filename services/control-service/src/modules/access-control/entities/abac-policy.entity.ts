import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('abac_policies')
export class AbacPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  resource: string;

  @Column()
  action: string;

  @Column({ type: 'jsonb' })
  conditions: any;

  @Column({ type: 'jsonb', nullable: true })
  obligations?: any;

  @Column({ default: 100 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  tenantId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}