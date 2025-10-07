import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from './control.entity';

@Entity('control_mappings')
export class ControlMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @Column({ type: 'varchar', length: 100 })
  framework: string; // e.g., SOC2, ISO27001, NIST

  @Column({ type: 'varchar', length: 100 })
  frameworkVersion: string; // e.g., 2017, 2022

  @Column({ type: 'varchar', length: 100 })
  section: string; // e.g., CC6.1, A.9.1

  @Column({ type: 'varchar', length: 255 })
  requirement: string;

  @Column({ type: 'text', nullable: true })
  requirementDescription: string;

  @Column({ type: 'jsonb', default: {} })
  mappingDetails: {
    coverage: 'full' | 'partial' | 'none';
    coveragePercentage?: number;
    gaps?: string[];
    notes?: string;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  mappedBy: string;

  @Column({ type: 'date', nullable: true })
  mappingDate: Date;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string;

  @Column({ type: 'date', nullable: true })
  validationDate: Date;

  @Column({ type: 'text', nullable: true })
  validationNotes: string;

  @ManyToOne(
    () => Control,
    (control) => control.mappings
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
