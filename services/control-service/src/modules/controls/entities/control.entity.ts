import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ControlTest } from '../../control-tests/entities/control-test.entity';
import { ControlImplementation } from '../../implementation/entities/control-implementation.entity';
import { ControlTestProcedures } from '../../../shared/types/control-query.types';
import { ControlAssessment } from './control-assessment.entity';
import { ControlException } from './control-exception.entity';
import { ControlMapping } from './control-mapping.entity';
import { ControlTestResult } from './control-test-result.entity';
import { EncryptedField } from '../decorators/encrypted-field.decorator';
import { DataClassificationLevel } from '../../../shared/types/tenant.types';

export enum ControlType {
  PREVENTIVE = 'PREVENTIVE',
  DETECTIVE = 'DETECTIVE',
  CORRECTIVE = 'CORRECTIVE',
  COMPENSATING = 'COMPENSATING',
}

export enum ControlCategory {
  ACCESS_CONTROL = 'ACCESS_CONTROL',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_PROTECTION = 'DATA_PROTECTION',
  ENCRYPTION = 'ENCRYPTION',
  MONITORING = 'MONITORING',
  INCIDENT_RESPONSE = 'INCIDENT_RESPONSE',
  BUSINESS_CONTINUITY = 'BUSINESS_CONTINUITY',
  PHYSICAL_SECURITY = 'PHYSICAL_SECURITY',
  NETWORK_SECURITY = 'NETWORK_SECURITY',
  APPLICATION_SECURITY = 'APPLICATION_SECURITY',
  VENDOR_MANAGEMENT = 'VENDOR_MANAGEMENT',
  AUDIT_ACCOUNTABILITY = 'AUDIT_ACCOUNTABILITY',
  TECHNICAL = 'TECHNICAL',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  PHYSICAL = 'PHYSICAL',
}

export enum ControlFrequency {
  CONTINUOUS = 'CONTINUOUS',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
  ON_DEMAND = 'ON_DEMAND',
}

export enum ControlStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum AutomationLevel {
  MANUAL = 'MANUAL',
  SEMI_AUTOMATED = 'SEMI_AUTOMATED',
  AUTOMATED = 'AUTOMATED',
  FULLY_AUTOMATED = 'FULLY_AUTOMATED',
}

@Entity('controls')
export class Control {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organizationId', nullable: true })
  tenantId: string; // Maps to organizationId in database for multi-tenancy

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string; // e.g., AC-1, CC-1.1

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  objective: string;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({
    type: 'enum',
    enum: ControlType,
  })
  type: ControlType;

  @Column({
    type: 'enum',
    enum: ControlCategory,
  })
  category: ControlCategory;

  @Column({
    type: 'enum',
    enum: ControlFrequency,
    default: ControlFrequency.QUARTERLY,
    name: 'frequency',
  })
  frequency: ControlFrequency;

  @Column({
    type: 'enum',
    enum: AutomationLevel,
    default: AutomationLevel.MANUAL,
  })
  automationLevel: AutomationLevel;

  @Column({
    type: 'enum',
    enum: ControlStatus,
    default: ControlStatus.ACTIVE,
  })
  status: ControlStatus;

  @Column({ type: 'jsonb', default: [] })
  frameworks: Array<{
    name: string; // SOC1, SOC2, ISO27001, etc.
    section?: string; // e.g., CC6.1, A.9.1
    reference?: string; // Framework-specific reference
    requirements?: string; // Framework-specific requirement text
    priority?: string; // Framework-specific priority (critical, high, medium, low)
  }>;

  @Column({ type: 'text', nullable: true })
  implementationGuidance: string;

  @Column({ type: 'jsonb', default: {} })
  testProcedures: ControlTestProcedures;

  @Column({ type: 'jsonb', default: [] })
  evidenceRequirements: string[];

  @Column({ type: 'jsonb', default: {} })
  metrics: {
    successRate?: number;
    avgTestDuration?: number;
    lastTestDate?: Date;
    totalTests?: number;
    failureCount?: number;
  };

  @Column({ type: 'boolean', default: false })
  automationCapable: boolean;

  @Column({ type: 'boolean', default: false })
  automationImplemented: boolean;

  @EncryptedField(DataClassificationLevel.CONFIDENTIAL)
  @Column({ type: 'jsonb', nullable: true })
  automationDetails: {
    tool?: string;
    schedule?: string;
    lastRun?: Date;
    scriptId?: string;
    apiEndpoint?: string;
    integrationId?: string;
    parameters?: any;
  };

  @EncryptedField(DataClassificationLevel.CONFIDENTIAL)
  @Column({ type: 'jsonb', nullable: true })
  automationConfig: {
    isAutomated?: boolean;
    automationType?: string;
    scriptId?: string;
    apiEndpoint?: string;
    integrationId?: string;
    parameters?: any;
  };

  @Column({ type: 'jsonb', default: [] })
  relatedControls: string[]; // Array of control codes

  @Column({ type: 'jsonb', default: [] })
  compensatingControls: string[]; // Array of control codes

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'uuid', nullable: true })
  ownerId: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string;

  @Column({ type: 'varchar', nullable: true })
  riskRating: string;

  @EncryptedField(DataClassificationLevel.INTERNAL)
  @Column({ type: 'decimal', nullable: true })
  costOfImplementation: number;

  @EncryptedField(DataClassificationLevel.INTERNAL)
  @Column({ type: 'decimal', nullable: true })
  costOfTesting: number;

  @Column({ type: 'boolean', default: false })
  regulatoryRequirement: boolean;

  @Column({ type: 'varchar', nullable: true })
  dataClassification: string;

  @Column({ type: 'jsonb', default: [] })
  businessProcesses: string[];

  @Column({ type: 'jsonb', default: [] })
  systemComponents: string[];

  @Column({ type: 'jsonb', default: [] })
  riskFactors: Array<{
    riskId: string;
    riskName: string;
    mitigationLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;

  @EncryptedField(DataClassificationLevel.CONFIDENTIAL)
  @Column({ type: 'jsonb', default: [] })
  stakeholders: Array<{
    userId: string;
    role: string;
    notifyOnFailure: boolean;
  }>;

  @Column({ type: 'jsonb', default: {} })
  customFields: Record<string, any>;

  @VersionColumn()
  version: number;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'varchar', nullable: true, default: 'medium' })
  priority: string;

  @Column({ type: 'varchar', nullable: true, default: 'MEDIUM' })
  complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

  @Column({ type: 'jsonb', default: {} })
  effectiveness: {
    score?: number; // 0-100
    lastAssessmentDate?: Date;
    assessmentMethod?: string;
    strengths?: string[];
    weaknesses?: string[];
    improvements?: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(
    () => ControlImplementation,
    (impl) => impl.control
  )
  implementations: ControlImplementation[];

  @OneToMany(
    () => ControlTestResult,
    (test) => test.control
  )
  testResults: ControlTestResult[];

  @OneToMany(
    () => ControlException,
    (exception) => exception.control
  )
  exceptions: ControlException[];

  @OneToMany(
    () => ControlAssessment,
    (assessment) => assessment.control
  )
  assessments: ControlAssessment[];

  @OneToMany(
    () => ControlMapping,
    (mapping) => mapping.control
  )
  mappings: ControlMapping[];

  @OneToMany(
    () => ControlTest,
    (test) => test.control
  )
  tests: ControlTest[];
}
