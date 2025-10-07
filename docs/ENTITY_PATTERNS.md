# Entity Design Patterns - SOC Compliance Platform

**Last Updated**: July 31, 2025

This guide documents the entity design patterns and TypeORM best practices used throughout the SOC Compliance Platform.

## Overview

All entities in the SOC Compliance Platform follow consistent patterns for:
- Base entity inheritance
- Audit fields (created/updated/deleted)
- Relationships and cascading
- Soft deletes
- Multi-tenancy isolation
- JSON data handling

## Base Entity Pattern

All entities extend from a common base entity:

```typescript
import { 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn,
  BaseEntity 
} from 'typeorm';

export abstract class BaseEntityClass extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
```

## Entity Examples by Service

### Auth Service Entities

#### User Entity
```typescript
@Entity('users')
@Index('idx_users_email', ['email'])
@Index('idx_users_organization', ['organizationId'])
export class User extends BaseEntityClass {
  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'jsonb' })
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatar?: string;
  };

  @Column({ type: 'simple-array' })
  roles: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt?: Date;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true })
  mfaSecret?: string;

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @ManyToOne(() => Organization, { eager: false })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => Session, session => session.user, { cascade: true })
  sessions: Session[];

  @OneToMany(() => RefreshToken, token => token.user)
  refreshTokens: RefreshToken[];
}
```

#### Session Entity
```typescript
@Entity('sessions')
@Index('idx_sessions_user', ['userId'])
@Index('idx_sessions_expires', ['expiresAt'])
export class Session extends BaseEntityClass {
  @Column()
  userId: string;

  @Column({ unique: true })
  token: string;

  @Column({ type: 'jsonb' })
  metadata: {
    ipAddress: string;
    userAgent: string;
    location?: {
      country: string;
      city: string;
    };
  };

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => User, user => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
```

### Client Service Entities

#### Organization Entity
```typescript
@Entity('organizations')
export class Organization extends BaseEntityClass {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: ['enterprise', 'standard', 'startup'] })
  type: 'enterprise' | 'standard' | 'startup';

  @Column({ type: 'jsonb' })
  settings: {
    timezone: string;
    dateFormat: string;
    currency: string;
    features: {
      aiInsights: boolean;
      advancedReporting: boolean;
      unlimitedUsers: boolean;
    };
  };

  @Column({ type: 'jsonb' })
  billing: {
    plan: string;
    status: 'active' | 'suspended' | 'cancelled';
    nextBillingDate?: Date;
  };

  @Column()
  ownerId: string;

  // Relations
  @OneToMany(() => Client, client => client.organization)
  clients: Client[];

  @OneToMany(() => User, user => user.organization)
  users: User[];
}
```

#### Client Entity
```typescript
@Entity('clients')
@Index('idx_clients_organization', ['organizationId'])
export class Client extends BaseEntityClass {
  @Column()
  name: string;

  @Column({ unique: true })
  code: string; // Auto-generated client code

  @Column({ type: 'jsonb' })
  contact: {
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };

  @Column()
  industry: string;

  @Column({ type: 'enum', enum: ['small', 'medium', 'large', 'enterprise'] })
  size: 'small' | 'medium' | 'large' | 'enterprise';

  @Column({ type: 'enum', enum: ['active', 'inactive', 'prospect'] })
  status: 'active' | 'inactive' | 'prospect';

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @ManyToOne(() => Organization, org => org.clients)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => Contract, contract => contract.client)
  contracts: Contract[];

  @OneToMany(() => Audit, audit => audit.client)
  audits: Audit[];
}
```

### Policy Service Entities

#### Policy Entity
```typescript
@Entity('policies')
@Index('idx_policies_organization_status', ['organizationId', 'status'])
export class Policy extends BaseEntityClass {
  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string; // Markdown content

  @Column({ type: 'jsonb' })
  metadata: {
    category: 'security' | 'privacy' | 'compliance' | 'operational';
    tags: string[];
    keywords: string[];
    reviewPeriod: 'monthly' | 'quarterly' | 'annually';
  };

  @Column({ default: '1.0' })
  version: string;

  @Column({ type: 'enum', enum: ['draft', 'published', 'archived'] })
  status: 'draft' | 'published' | 'archived';

  @Column({ type: 'timestamptz', nullable: true })
  effectiveDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextReviewDate?: Date;

  @Column({ nullable: true })
  approvedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @ManyToMany(() => Control, control => control.policies)
  @JoinTable({
    name: 'policy_controls',
    joinColumn: { name: 'policyId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'controlId', referencedColumnName: 'id' }
  })
  controls: Control[];

  @OneToMany(() => PolicyVersion, version => version.policy)
  versions: PolicyVersion[];
}
```

### Control Service Entities

#### Control Entity
```typescript
@Entity('controls')
@Index('idx_controls_framework_code', ['frameworkId', 'code'])
export class Control extends BaseEntityClass {
  @Column()
  code: string; // e.g., "CC6.1"

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  category: string; // e.g., "Access Control"

  @Column({ type: 'jsonb' })
  requirements: {
    description: string;
    testingGuidance: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  };

  @Column()
  frameworkId: string;

  // Organization-specific implementation
  @Column({ type: 'jsonb', nullable: true })
  implementation?: {
    status: 'not_started' | 'in_progress' | 'implemented' | 'not_applicable';
    description: string;
    owner: string;
    lastReviewDate?: Date;
  };

  // Relations
  @ManyToOne(() => Framework, framework => framework.controls)
  @JoinColumn({ name: 'frameworkId' })
  framework: Framework;

  @ManyToMany(() => Policy, policy => policy.controls)
  policies: Policy[];

  @OneToMany(() => ControlTest, test => test.control)
  tests: ControlTest[];

  @OneToMany(() => Evidence, evidence => evidence.control)
  evidence: Evidence[];
}
```

#### ControlTest Entity
```typescript
@Entity('control_tests')
@Index('idx_control_tests_scheduled', ['scheduledDate', 'status'])
export class ControlTest extends BaseEntityClass {
  @Column()
  controlId: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['manual', 'automated'] })
  type: 'manual' | 'automated';

  @Column({ type: 'timestamptz' })
  scheduledDate: Date;

  @Column({ nullable: true })
  assignedTo?: string;

  @Column({ 
    type: 'enum', 
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  })
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';

  @Column({ type: 'jsonb', nullable: true })
  result?: {
    status: 'passed' | 'failed' | 'partial';
    findings: {
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      recommendation: string;
    }[];
    completedBy: string;
    completedAt: Date;
    evidence: string[]; // Evidence IDs
  };

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @ManyToOne(() => Control, control => control.tests)
  @JoinColumn({ name: 'controlId' })
  control: Control;
}
```

### Evidence Service Entities

#### Evidence Entity
```typescript
@Entity('evidence')
@Index('idx_evidence_client_control', ['clientId', 'controlId'])
export class Evidence extends BaseEntityClass {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ['document', 'screenshot', 'log', 'report', 'other'] })
  type: 'document' | 'screenshot' | 'log' | 'report' | 'other';

  @Column({ type: 'jsonb' })
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    hash: string; // SHA-256 hash for integrity
    source: 'manual' | 'automated' | 'integration';
  };

  @Column()
  storageUrl: string; // S3 or local storage URL

  @Column({ type: 'timestamptz' })
  collectionDate: Date;

  @Column('uuid')
  clientId: string; // Note: This field references the organization, not a specific client

  // Computed property for evidence completeness
  get completionPercentage(): number {
    const requiredFields = ['title', 'type', 'source', 'storageUrl'];
    const optionalFields = ['description', 'metadata', 'complianceMapping', 'validationResults'];
    
    let completed = 0;
    let total = requiredFields.length + optionalFields.length;
    
    requiredFields.forEach(field => {
      if (this[field]) completed++;
    });
    
    optionalFields.forEach(field => {
      if (this[field]) completed++;
    });
    
    return Math.round((completed / total) * 100);
  }

  @Column({ nullable: true })
  collectedBy?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ 
    type: 'enum', 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  })
  status: 'pending' | 'approved' | 'rejected';

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @Column()
  controlId: string;

  @ManyToOne(() => Control, control => control.evidence)
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @ManyToMany(() => Audit, audit => audit.evidence)
  audits: Audit[];
}
```

### Workflow Service Entities

#### Workflow Entity
```typescript
@Entity('workflows')
export class Workflow extends BaseEntityClass {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb' })
  definition: {
    steps: WorkflowStep[];
    triggers: WorkflowTrigger[];
    variables: Record<string, any>;
  };

  @Column({ type: 'enum', enum: ['active', 'draft', 'archived'] })
  status: 'active' | 'draft' | 'archived';

  @Column()
  category: string; // e.g., 'approval', 'review', 'collection'

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @OneToMany(() => WorkflowInstance, instance => instance.workflow)
  instances: WorkflowInstance[];
}

interface WorkflowStep {
  id: string;
  name: string;
  type: 'manual' | 'automated' | 'approval' | 'notification';
  assignee?: string;
  actions: any[];
  conditions?: any[];
  nextSteps: string[];
}

interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'event';
  config: any;
}
```

#### WorkflowInstance Entity
```typescript
@Entity('workflow_instances')
@Index('idx_workflow_instances_status', ['status'])
export class WorkflowInstance extends BaseEntityClass {
  @Column()
  workflowId: string;

  @Column({ type: 'jsonb' })
  context: Record<string, any>; // Runtime data

  @Column({ type: 'jsonb' })
  state: {
    currentStepId: string;
    completedSteps: string[];
    variables: Record<string, any>;
  };

  @Column({ 
    type: 'enum', 
    enum: ['running', 'paused', 'completed', 'failed', 'cancelled'] 
  })
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

  @Column()
  initiatedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  // Multi-tenancy
  @Column()
  organizationId: string;

  // Relations
  @ManyToOne(() => Workflow, workflow => workflow.instances)
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  @OneToMany(() => WorkflowStepExecution, execution => execution.instance)
  stepExecutions: WorkflowStepExecution[];
}
```

### Complex Entity Patterns

#### Audit Entity with Composite Relations
```typescript
@Entity('audits')
export class Audit extends BaseEntityClass {
  @Column()
  title: string;

  @Column({ 
    type: 'enum', 
    enum: ['soc1', 'soc2_type1', 'soc2_type2'] 
  })
  type: 'soc1' | 'soc2_type1' | 'soc2_type2';

  @Column({ type: 'jsonb' })
  period: {
    start: Date;
    end: Date;
  };

  @Column({ type: 'jsonb' })
  scope: {
    frameworks: string[];
    controls: string[];
    excludedControls?: string[];
  };

  @Column({ 
    type: 'enum', 
    enum: ['planning', 'fieldwork', 'reporting', 'completed'] 
  })
  status: 'planning' | 'fieldwork' | 'reporting' | 'completed';

  // Multi-tenancy
  @Column()
  organizationId: string;

  @Column()
  clientId: string;

  @Column()
  auditorId: string;

  // Relations
  @ManyToOne(() => Client, client => client.audits)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'auditorId' })
  auditor: User;

  @OneToMany(() => AuditFinding, finding => finding.audit, { cascade: true })
  findings: AuditFinding[];

  @ManyToMany(() => Evidence, evidence => evidence.audits)
  @JoinTable({
    name: 'audit_evidence',
    joinColumn: { name: 'auditId' },
    inverseJoinColumn: { name: 'evidenceId' }
  })
  evidence: Evidence[];
}
```

## Advanced Patterns

### 1. Soft Delete with Cascade

```typescript
@Entity()
export class ParentEntity extends BaseEntityClass {
  @OneToMany(() => ChildEntity, child => child.parent, {
    cascade: ['soft-remove', 'recover']
  })
  children: ChildEntity[];

  // Custom soft delete that cascades
  async softDeleteWithChildren() {
    await this.softRemove();
    await Promise.all(
      this.children.map(child => child.softRemove())
    );
  }
}
```

### 2. JSON Schema Validation

```typescript
@Entity()
export class ConfigEntity extends BaseEntityClass {
  @Column({ type: 'jsonb' })
  @IsJSON()
  @ValidateNested()
  @Type(() => ConfigSchema)
  config: ConfigSchema;

  @BeforeInsert()
  @BeforeUpdate()
  validateConfig() {
    const schema = Joi.object({
      feature1: Joi.boolean().required(),
      limits: Joi.object({
        maxUsers: Joi.number().min(1).required(),
        maxStorage: Joi.number().min(1).required()
      })
    });

    const { error } = schema.validate(this.config);
    if (error) {
      throw new BadRequestException(`Invalid config: ${error.message}`);
    }
  }
}
```

### 3. Audit Trail Pattern

```typescript
@Entity()
export class AuditableEntity extends BaseEntityClass {
  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;

  @Column({ type: 'jsonb', default: [] })
  changeHistory: ChangeRecord[];

  @BeforeUpdate()
  recordChange() {
    if (this.hasChanges()) {
      this.changeHistory.push({
        timestamp: new Date(),
        userId: this.updatedBy,
        changes: this.getChanges()
      });
    }
  }
}

interface ChangeRecord {
  timestamp: Date;
  userId: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}
```

### 4. Multi-Tenancy with Row-Level Security

```typescript
@Entity()
export class TenantEntity extends BaseEntityClass {
  @Column()
  @Index()
  organizationId: string;

  // Ensure all queries include organizationId
  static createQueryBuilder(alias?: string) {
    return super.createQueryBuilder(alias)
      .where(`${alias}.organizationId = :organizationId`, {
        organizationId: getCurrentOrganizationId()
      });
  }
}
```

### 5. Versioning Pattern

```typescript
@Entity()
export class VersionedEntity extends BaseEntityClass {
  @Column()
  version: number;

  @Column()
  isCurrent: boolean;

  @Column({ nullable: true })
  previousVersionId?: string;

  @ManyToOne(() => VersionedEntity, { nullable: true })
  @JoinColumn({ name: 'previousVersionId' })
  previousVersion?: VersionedEntity;

  @BeforeInsert()
  async createNewVersion() {
    if (this.id) {
      // Mark current version as not current
      await VersionedEntity.update(
        { id: this.id, isCurrent: true },
        { isCurrent: false }
      );
      
      // Set up new version
      this.previousVersionId = this.id;
      this.id = undefined; // Generate new ID
      this.version++;
      this.isCurrent = true;
    }
  }
}
```

## Best Practices

### 1. Always Use Proper Types

```typescript
// ❌ AVOID
@Column({ type: 'jsonb' })
data: any;

// ✅ PREFER
@Column({ type: 'jsonb' })
data: {
  field1: string;
  field2: number;
  nested: {
    subfield: boolean;
  };
};
```

### 2. Index Strategy

```typescript
@Entity()
@Index('idx_composite', ['organizationId', 'status', 'createdAt'])
@Index('idx_search', ['name', 'email'])
export class OptimizedEntity extends BaseEntityClass {
  // Columns used in WHERE clauses
  @Column()
  @Index() // Single column index
  organizationId: string;

  @Column()
  status: string;

  // Columns used in searches
  @Column()
  name: string;

  @Column()
  email: string;
}
```

### 3. Relationship Loading

```typescript
// Lazy loading (default)
@ManyToOne(() => User)
user: User;

// Eager loading (use sparingly)
@ManyToOne(() => Organization, { eager: true })
organization: Organization;

// Conditional loading
const user = await User.findOne({
  where: { id },
  relations: shouldLoadOrg ? ['organization'] : []
});
```

### 4. Transaction Patterns

```typescript
async transferOwnership(entityId: string, newOwnerId: string) {
  return this.dataSource.transaction(async manager => {
    const entity = await manager.findOne(Entity, { 
      where: { id: entityId },
      lock: { mode: 'pessimistic_write' }
    });

    if (!entity) {
      throw new NotFoundException();
    }

    entity.ownerId = newOwnerId;
    await manager.save(entity);

    // Audit the change
    await manager.save(AuditLog, {
      action: 'ownership_transfer',
      entityId,
      oldOwnerId: entity.ownerId,
      newOwnerId,
      timestamp: new Date()
    });
  });
}
```

## Migration Considerations

When creating migrations for entities:

```typescript
// migrations/1234567890-CreateUserTable.ts
export class CreateUserTable1234567890 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'users',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          isPrimary: true,
          generationStrategy: 'uuid',
          default: 'uuid_generate_v4()'
        },
        {
          name: 'email',
          type: 'varchar',
          isUnique: true
        },
        {
          name: 'profile',
          type: 'jsonb'
        },
        {
          name: 'createdAt',
          type: 'timestamptz',
          default: 'CURRENT_TIMESTAMP'
        },
        {
          name: 'updatedAt',
          type: 'timestamptz',
          default: 'CURRENT_TIMESTAMP'
        },
        {
          name: 'deletedAt',
          type: 'timestamptz',
          isNullable: true
        }
      ]
    }), true);

    // Create indexes
    await queryRunner.createIndex('users', new Index({
      name: 'idx_users_email',
      columnNames: ['email']
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

## Summary

These entity patterns ensure:
- **Consistency**: All entities follow the same structure
- **Maintainability**: Easy to understand and modify
- **Type Safety**: Full TypeScript support
- **Performance**: Proper indexing and relationships
- **Multi-tenancy**: Organization isolation built-in
- **Audit Trail**: Track all changes
- **Soft Deletes**: Never lose data

By following these patterns, the SOC Compliance Platform maintains a robust and scalable data model.

---

**Document Status**: Complete guide for entity design patterns