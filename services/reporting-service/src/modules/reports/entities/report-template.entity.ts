import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('report_templates')
@Index(['organizationId', 'isActive'])
@Index(['organizationId', 'reportType'])
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'report_type' })
  reportType: string;

  @Column({ default: 'PDF' })
  format: string;

  @Column({ name: 'template_content', type: 'text', nullable: true })
  templateContent?: string;

  @Column({ type: 'jsonb', nullable: true })
  configuration?: {
    pageSize?: string;
    orientation?: string;
    margins?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    fonts?: string[];
    watermark?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<
    string,
    {
      type: string;
      required?: boolean;
      default?: any;
      description?: string;
    }
  >;

  @Column({ name: 'default_sections', type: 'jsonb', nullable: true })
  defaultSections?: Array<{
    id: string;
    name: string;
    order: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  sections?: Array<{
    id: string;
    name: string;
    order: number;
    dataSource?: string;
  }>;

  @Column({ name: 'data_schema', type: 'jsonb', nullable: true })
  dataSchema?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string;

  // Security configuration
  @Column({ name: 'security_configuration', type: 'jsonb', nullable: true })
  securityConfiguration?: {
    encryptionRequired: boolean;
    digitalSignatureRequired: boolean;
    watermarkRequired: boolean;
    defaultClassificationLevel?: string;
    accessRestrictions?: string[]; // Role names or permission keys
    retentionPeriodDays?: number;
    allowedFormats?: string[];
    requireMfaForAccess?: boolean;
    ipWhitelist?: string[];
    autoExpireAfterDays?: number;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
