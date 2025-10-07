# SOC Compliance Platform - Implementation Roadmap
## Single Source of Truth for Production-Ready Development

**Document Version**: 1.1.0  
**Last Updated**: August 2025  
**Status**: ACTIVE DEVELOPMENT  
**Target Completion**: 10 Weeks

---

## ⚠️ CRITICAL CONTEXT

### Infrastructure Already Set Up ✅
- **Kong Konnect**: Cloud API gateway configured (not local Kong)
- **Keycloak**: Running on port 8180 with `soc-compliance` realm
- **PostgreSQL**: All 12 databases created and running
- **Redis**: Cache layer operational
- **Kafka**: Event bus configured
- **MongoDB & Elasticsearch**: Optional stores ready

### Current Reality (Not Marketing Claims)
- **Services Exist**: Code is written for all 11 services
- **Integration Broken**: Services don't actually talk to each other with Konnect
- **Tests Are Mocked**: "100% passing" means nothing - they use mocks
- **Docker Deployment**: Only 1-2 services actually run in Docker
- **Business Logic**: Partial implementation, many stub methods
- **Frontend**: Uses mock data, not real API calls through Konnect

### What This Roadmap Addresses
1. **Stop Local Testing**: All development must be in Docker
2. **Real Integration**: Services must communicate through Kafka/REST
3. **Actual Data Flow**: Frontend → Kong → Services → Database → Response
4. **True Testing**: E2E tests with real databases, not mocks
5. **Production Patterns**: Infrastructure-level secrets, proper builds

### Success Definition
A feature is NOT complete until:
- It works in Docker (not locally)
- It integrates with other services
- It persists real data
- Frontend can use it through Kong
- Events flow through Kafka

---

## Table of Contents
1. [Critical Infrastructure Fixes](#1-critical-infrastructure-fixes)
2. [Type Safety Enforcement](#2-type-safety-enforcement)
3. [Service Implementation Details](#3-service-implementation-details)
4. [API Contracts & Data Flows](#4-api-contracts--data-flows)
5. [Testing Requirements](#5-testing-requirements)
6. [Deployment Pipeline](#6-deployment-pipeline)
7. [Success Metrics](#7-success-metrics)

---

## 1. Critical Infrastructure - Already Configured

### 1.0 ✅ Infrastructure Already Set Up
**These components are ALREADY CONFIGURED and running:**

#### Kong Konnect (Cloud API Gateway)
- **Status**: ✅ Configured and connected
- **Dashboard**: Available at Kong Konnect cloud console
- **Configuration**: Managed through Konnect portal
- **Integration**: Services need to register with Konnect, not local Kong

#### Keycloak (Identity Provider)
- **Status**: ✅ Running on port 8180
- **Admin Console**: http://localhost:8180/admin
- **Realm**: `soc-compliance` realm configured
- **Integration**: Auth service needs to connect to existing Keycloak instance

#### What This Means:
```bash
# DON'T waste time setting up Kong locally
# DON'T configure Keycloak from scratch
# DO integrate services with existing infrastructure

# Keycloak is already running:
curl http://localhost:8180/auth/realms/soc-compliance

# Kong Konnect requires different configuration:
# - Services register through Konnect API
# - No local kong.yml needed
# - Use Konnect service discovery
```

## 1. Critical Infrastructure Fixes

### 1.1 Monorepo Build Dependencies
**Priority**: CRITICAL - Must build in correct order  
**Time Estimate**: 30 minutes  

#### Build Order Requirements:
```bash
# MUST BUILD IN THIS EXACT ORDER:
1. npm run build:shared     # Build shared contracts/events first
2. npm run build:packages   # Build auth-common, cache-common, etc.
3. npm run build:services   # Finally build individual services

# This is because of monorepo dependencies:
services/* → packages/* → shared/*
```

### 1.2 Kong Konnect Integration
**Priority**: HIGH - Use cloud gateway, not local Kong  
**Time Estimate**: 2 hours  
**Action Required**: Integrate services with Kong Konnect

#### Kong Konnect Setup:
```bash
# Kong Konnect is CLOUD-BASED, not local Docker
# Services need to register with Konnect Control Plane

# 1. Each service needs Konnect service registration:
curl -X POST https://[your-org].konghq.com/services \
  -H "Authorization: Bearer [KONNECT_TOKEN]" \
  -d '{
    "name": "auth-service",
    "url": "http://auth-service:3001"
  }'

# 2. Configure routes in Konnect dashboard
# 3. Apply plugins through Konnect UI
# 4. Services connect to Konnect data plane

# Local kong.yml is NOT USED with Konnect
```

#### Implementation Steps:
```bash
# Step 1: Validate Kong configuration
docker run --rm -v ${PWD}/gateway/kong.yml:/kong.yml kong:3.4 kong config parse /kong.yml

# Step 2: Test Kong startup
docker-compose up kong

# Step 3: Verify service routing
curl http://localhost:8000/auth/health
curl http://localhost:8000/clients/health
curl http://localhost:8000/policies/health
```

#### Expected Outcome:
- Kong starts without errors
- All 12 service routes accessible
- JWT validation working for protected routes

### 1.2 Docker Service Deployment
**Priority**: HIGH - Only 2/12 services deployed  
**Time Estimate**: 1 day per service  

#### Services Requiring Deployment:
| Service | Current Status | Required Actions |
|---------|---------------|------------------|
| auth-service | ❌ Not deployed | Fix Dockerfile, add to docker-compose |
| control-service | ❌ Not deployed | Build dist/main.js, create Dockerfile |
| evidence-service | ❌ Not deployed | Migrate secrets, deploy |
| workflow-service | ❌ Not deployed | Complete implementation, deploy |
| reporting-service | ❌ Not deployed | Fix dependencies, deploy |
| audit-service | ❌ Not deployed | Complete implementation, deploy |
| integration-service | ❌ Not deployed | Fix webhooks, deploy |
| notification-service | ❌ Not deployed | Add providers, deploy |
| ai-service | ❌ Not deployed | Add ML models, deploy |

---

## 2. Type Safety Enforcement

### 2.1 Remove "as any" Type Assertions
**Priority**: HIGH - 9 files in production code  
**Time Estimate**: 4 hours  

#### Files and Fixes:

##### File: `services/client-service/src/modules/clients/clients.service.ts`
```typescript
// Line 72 - CURRENT:
const validatedUser = await this.authService.validateUser(userId) as any;

// FIX - Create interface:
interface ValidatedUser {
  id: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  email: string;
}

// Line 72 - FIXED:
const validatedUser = await this.authService.validateUser(userId) as ValidatedUser;
```

##### File: `services/integration-service/src/modules/webhooks/webhook.service.ts`
```typescript
// Line 145 - CURRENT:
const payload = JSON.parse(body) as any;

// FIX - Create type:
interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: Record<string, unknown>;
  signature?: string;
}

// Line 145 - FIXED:
const payload = JSON.parse(body) as WebhookPayload;
```

##### File: `services/control-service/src/modules/tenant/tenant-isolation.service.ts`
```typescript
// Lines 89, 112 - CURRENT:
repository.find({ where: conditions as any })

// FIX - Import TypeORM types:
import { FindOptionsWhere } from 'typeorm';

// Lines 89, 112 - FIXED:
repository.find({ where: conditions as FindOptionsWhere<T> })
```

##### File: `services/integration-service/src/modules/connectors/api-connector.service.ts`
```typescript
// Line 234 - CURRENT:
const response = await axios.post(url, data) as any;

// FIX - Use axios types:
import { AxiosResponse } from 'axios';

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

// Line 234 - FIXED:
const response = await axios.post<ApiResponse>(url, data);
```

##### File: `services/integration-service/src/modules/sync/sync.service.ts`
```typescript
// Multiple lines - CURRENT:
const mappedData = data.map(item => transform(item)) as any;

// FIX - Create generic type:
type TransformFunction<T, R> = (item: T) => R;

// FIXED:
const mappedData = data.map(item => transform(item)) as MappedDataType[];
```

##### File: `services/client-service/src/modules/shared-client/contract-core.service.ts`
```typescript
// Line 156 - CURRENT:
return this.contractRepository.save(contract as any);

// FIX - Use proper entity:
return this.contractRepository.save(contract as Contract);
```

##### File: `services/policy-service/src/shared/services/authorization.service.ts`
```typescript
// Line 78 - CURRENT:
const permissions = await this.getPermissions(userId) as any;

// FIX - Define type:
type Permission = {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
};

// Line 78 - FIXED:
const permissions = await this.getPermissions(userId) as Permission[];
```

##### File: `services/notification-service/src/modules/rules/notification-rules.service.ts`
```typescript
// Line 92 - CURRENT:
const rule = JSON.parse(ruleString) as any;

// FIX - Create interface:
interface NotificationRule {
  id: string;
  event: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

// Line 92 - FIXED:
const rule = JSON.parse(ruleString) as NotificationRule;
```

---

## 3. Service Implementation Details

### 3.1 Understanding Existing Architecture

#### 3.1.1 Secrets Management Pattern
**IMPORTANT**: Services consume secrets from environment variables provided by infrastructure

```typescript
// WRONG - Don't build application-level secrets management
class SecretsService {
  async getSecret(key: string) { /* NO */ }
}

// CORRECT - Read from environment (infrastructure provides)
class ConfigService {
  get(key: string) {
    return process.env[key];  // Infrastructure injects via Docker/K8s
  }
}
```

#### 3.1.2 Event Publishing Pattern
**CRITICAL**: Services use DUAL event publishing

```typescript
// Every service publishes events TWICE:

// 1. Local event for same-service listeners
this.eventEmitter.emit('client.created', eventData);

// 2. Kafka event for other services
await this.kafkaProducer.publish({
  topic: 'client-events',
  messages: [{
    key: 'client.created',
    value: JSON.stringify(eventData)
  }]
});
```

#### 3.1.3 Shared Package Dependencies
**File Structure**: Monorepo with interdependencies

```
shared/
  ├── events/          # Event interfaces
  ├── contracts/       # API contracts
  └── types/           # Shared types

packages/
  ├── auth-common/     # Auth utilities used by ALL services
  ├── cache-common/    # Redis utilities
  ├── monitoring/      # Metrics, tracing
  └── http-common/     # Service discovery

services/
  └── [each service imports from packages & shared]
```

### 3.2 Auth Service - Keycloak Integration

#### 3.2.1 Connect to Existing Keycloak Instance
**Keycloak is ALREADY RUNNING on port 8180 - just connect to it**

```typescript
// File: services/auth-service/src/modules/keycloak/keycloak.service.ts
import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeycloakService {
  private adminClient: KeycloakAdminClient;
  private readonly logger = new Logger(KeycloakService.name);

  constructor(private configService: ConfigService) {
    // KEYCLOAK IS ALREADY RUNNING - JUST CONNECT
    this.adminClient = new KeycloakAdminClient({
      baseUrl: 'http://localhost:8180/auth',  // Already running here
      realmName: 'soc-compliance',  // Already configured
    });
  }

  async initialize(): Promise<void> {
    await this.adminClient.auth({
      username: this.configService.get('KEYCLOAK_ADMIN', 'admin'),
      password: this.configService.get('KEYCLOAK_ADMIN_PASSWORD'),
      grantType: 'password',
      clientId: 'admin-cli',
    });
  }

  async createUser(userData: CreateUserDto): Promise<string> {
    const user = await this.adminClient.users.create({
      realm: 'soc-compliance',
      username: userData.email,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      enabled: true,
      emailVerified: false,
      credentials: [{
        type: 'password',
        value: userData.password,
        temporary: false,
      }],
    });
    return user.id;
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    const role = await this.adminClient.roles.findOneByName({
      realm: 'soc-compliance',
      name: roleName,
    });
    
    await this.adminClient.users.addRealmRoleMappings({
      realm: 'soc-compliance',
      id: userId,
      roles: [role],
    });
  }

  async validateToken(token: string): Promise<TokenValidation> {
    // Implementation for token validation
  }
}
```

#### 3.1.2 Session Management with Redis
**File**: `services/auth-service/src/modules/sessions/session.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

interface SessionData {
  userId: string;
  organizationId: string;
  roles: string[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly SESSION_PREFIX = 'session:';

  constructor(private redisService: RedisService) {}

  async createSession(data: Omit<SessionData, 'createdAt' | 'lastActivity' | 'expiresAt'>): Promise<string> {
    const sessionId = uuidv4();
    const sessionData: SessionData = {
      ...data,
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000),
    };

    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      this.SESSION_TTL
    );

    // Track user sessions
    await this.redisService.sadd(`user:${data.userId}:sessions`, sessionId);

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redisService.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!data) return null;

    const session = JSON.parse(data) as SessionData;
    
    // Update last activity with sliding window
    session.lastActivity = new Date();
    await this.updateSession(sessionId, session);
    
    return session;
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<void> {
    const existing = await this.getSession(sessionId);
    if (!existing) throw new Error('Session not found');

    const updated = { ...existing, ...data };
    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(updated),
      this.SESSION_TTL
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.redisService.srem(`user:${session.userId}:sessions`, sessionId);
    }
    await this.redisService.del(`${this.SESSION_PREFIX}${sessionId}`);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.redisService.smembers(`user:${userId}:sessions`);
    for (const sessionId of sessions) {
      await this.deleteSession(sessionId);
    }
  }
}
```

#### 3.1.3 API Key Management
**File**: `services/auth-service/src/modules/api-keys/api-key.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  async generateApiKey(data: CreateApiKeyDto): Promise<ApiKey> {
    // Generate cryptographically secure API key
    const keyValue = this.generateSecureKey();
    const hashedKey = this.hashApiKey(keyValue);

    const apiKey = this.apiKeyRepository.create({
      ...data,
      key: hashedKey,
      keyPrefix: keyValue.substring(0, 8), // For identification
      lastUsed: null,
      usageCount: 0,
      status: 'active',
    });

    await this.apiKeyRepository.save(apiKey);

    // Return the key value only once (user must save it)
    return { ...apiKey, key: keyValue };
  }

  private generateSecureKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async validateApiKey(key: string): Promise<ApiKeyValidation> {
    const hashedKey = this.hashApiKey(key);
    
    const apiKey = await this.apiKeyRepository.findOne({
      where: { key: hashedKey, status: 'active' },
      relations: ['permissions'],
    });

    if (!apiKey) {
      return { valid: false, reason: 'Invalid or inactive API key' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, reason: 'API key expired' };
    }

    // Update usage statistics
    await this.apiKeyRepository.update(apiKey.id, {
      lastUsed: new Date(),
      usageCount: apiKey.usageCount + 1,
    });

    return {
      valid: true,
      apiKey,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
    };
  }

  async rotateApiKey(keyId: string): Promise<string> {
    const existing = await this.apiKeyRepository.findOne({ where: { id: keyId } });
    if (!existing) throw new Error('API key not found');

    // Generate new key
    const newKeyValue = this.generateSecureKey();
    const hashedKey = this.hashApiKey(newKeyValue);

    // Update with new key
    await this.apiKeyRepository.update(keyId, {
      key: hashedKey,
      keyPrefix: newKeyValue.substring(0, 8),
      rotatedAt: new Date(),
    });

    return newKeyValue;
  }
}
```

### 3.2 Client Service - Business Logic Implementation

#### 3.2.1 Organization Hierarchy Management
**File**: `services/client-service/src/modules/clients/organization-tree.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';

interface TreeNode {
  id: string;
  name: string;
  type: string;
  children: TreeNode[];
  metadata: {
    level: number;
    path: string;
    employeeCount?: number;
    revenue?: number;
    complianceScore?: number;
  };
}

@Injectable()
export class OrganizationTreeService {
  constructor(
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
  ) {}

  async buildOrganizationTree(rootId: string): Promise<TreeNode> {
    const root = await this.clientRepository.findOne({
      where: { id: rootId },
      relations: ['subsidiaries'],
    });

    if (!root) throw new Error('Root organization not found');

    return this.buildTreeRecursive(root, 0, rootId);
  }

  private async buildTreeRecursive(
    client: Client,
    level: number,
    path: string,
  ): Promise<TreeNode> {
    const children = await this.clientRepository.find({
      where: { parentId: client.id },
      relations: ['subsidiaries'],
    });

    const childNodes = await Promise.all(
      children.map(child =>
        this.buildTreeRecursive(child, level + 1, `${path}/${child.id}`)
      )
    );

    return {
      id: client.id,
      name: client.name,
      type: client.type,
      children: childNodes,
      metadata: {
        level,
        path,
        employeeCount: client.employeeCount,
        revenue: client.annualRevenue,
        complianceScore: await this.calculateComplianceScore(client.id),
      },
    };
  }

  async moveOrganization(orgId: string, newParentId: string): Promise<void> {
    // Validate no circular reference
    if (await this.wouldCreateCircularReference(orgId, newParentId)) {
      throw new Error('Moving would create circular reference');
    }

    await this.clientRepository.update(orgId, { parentId: newParentId });
    
    // Update paths for all descendants
    await this.updateDescendantPaths(orgId);
  }

  private async wouldCreateCircularReference(
    orgId: string,
    newParentId: string,
  ): Promise<boolean> {
    let current = newParentId;
    while (current) {
      if (current === orgId) return true;
      
      const parent = await this.clientRepository.findOne({
        where: { id: current },
        select: ['parentId'],
      });
      
      current = parent?.parentId;
    }
    return false;
  }

  async calculateRollupMetrics(orgId: string): Promise<RollupMetrics> {
    const tree = await this.buildOrganizationTree(orgId);
    
    return this.aggregateMetrics(tree);
  }

  private aggregateMetrics(node: TreeNode): RollupMetrics {
    let totalEmployees = node.metadata.employeeCount || 0;
    let totalRevenue = node.metadata.revenue || 0;
    let complianceScores = [node.metadata.complianceScore || 0];

    for (const child of node.children) {
      const childMetrics = this.aggregateMetrics(child);
      totalEmployees += childMetrics.totalEmployees;
      totalRevenue += childMetrics.totalRevenue;
      complianceScores.push(...childMetrics.complianceScores);
    }

    return {
      totalEmployees,
      totalRevenue,
      complianceScores,
      averageCompliance: complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length,
    };
  }
}
```

#### 3.2.2 Onboarding Workflow Implementation
**File**: `services/client-service/src/modules/onboarding/onboarding-workflow.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

enum OnboardingStep {
  ORGANIZATION_DETAILS = 'ORGANIZATION_DETAILS',
  COMPLIANCE_REQUIREMENTS = 'COMPLIANCE_REQUIREMENTS',
  KEY_CONTACTS = 'KEY_CONTACTS',
  DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION',
  INITIAL_ASSESSMENT = 'INITIAL_ASSESSMENT',
  CONTRACT_SETUP = 'CONTRACT_SETUP',
  KICK_OFF_MEETING = 'KICK_OFF_MEETING',
}

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  skippedSteps: { step: OnboardingStep; reason: string }[];
  data: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
}

@Injectable()
export class OnboardingWorkflowService {
  private sessions = new Map<string, OnboardingState>();

  constructor(private eventEmitter: EventEmitter2) {}

  async startOnboarding(clientId: string): Promise<OnboardingSession> {
    const sessionId = `onboarding:${clientId}:${Date.now()}`;
    
    const state: OnboardingState = {
      currentStep: OnboardingStep.ORGANIZATION_DETAILS,
      completedSteps: [],
      skippedSteps: [],
      data: { clientId },
      startedAt: new Date(),
    };

    this.sessions.set(sessionId, state);

    // Create tasks for each step
    await this.createOnboardingTasks(clientId);

    // Send welcome email
    this.eventEmitter.emit('onboarding.started', {
      clientId,
      sessionId,
      timestamp: new Date(),
    });

    return {
      sessionId,
      currentStep: state.currentStep,
      progress: this.calculateProgress(state),
    };
  }

  async completeStep(
    sessionId: string,
    step: OnboardingStep,
    data: any,
  ): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error('Session not found');

    if (state.currentStep !== step) {
      throw new Error(`Expected step ${state.currentStep}, got ${step}`);
    }

    // Validate step data
    await this.validateStepData(step, data);

    // Store step data
    state.data[step] = data;
    state.completedSteps.push(step);

    // Move to next step
    const nextStep = this.getNextStep(step);
    if (nextStep) {
      state.currentStep = nextStep;
    } else {
      state.completedAt = new Date();
      await this.completeOnboarding(sessionId);
    }

    this.sessions.set(sessionId, state);

    // Emit event
    this.eventEmitter.emit('onboarding.step.completed', {
      sessionId,
      step,
      nextStep,
      progress: this.calculateProgress(state),
    });
  }

  private async validateStepData(step: OnboardingStep, data: any): Promise<void> {
    switch (step) {
      case OnboardingStep.ORGANIZATION_DETAILS:
        if (!data.legalName || !data.taxId) {
          throw new Error('Legal name and tax ID required');
        }
        break;
      
      case OnboardingStep.COMPLIANCE_REQUIREMENTS:
        if (!data.frameworks || data.frameworks.length === 0) {
          throw new Error('At least one compliance framework required');
        }
        break;
      
      case OnboardingStep.KEY_CONTACTS:
        if (!data.primaryContact || !data.primaryContact.email) {
          throw new Error('Primary contact with email required');
        }
        break;
      
      // Add validation for other steps
    }
  }

  private getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex === -1 || currentIndex === steps.length - 1) {
      return null;
    }
    
    return steps[currentIndex + 1];
  }

  private calculateProgress(state: OnboardingState): number {
    const totalSteps = Object.values(OnboardingStep).length;
    const completedCount = state.completedSteps.length;
    return Math.round((completedCount / totalSteps) * 100);
  }

  private async createOnboardingTasks(clientId: string): Promise<void> {
    const tasks = [
      {
        title: 'Collect organization details',
        assignee: 'account-manager',
        dueInDays: 1,
      },
      {
        title: 'Identify compliance requirements',
        assignee: 'compliance-team',
        dueInDays: 2,
      },
      {
        title: 'Gather key contact information',
        assignee: 'account-manager',
        dueInDays: 2,
      },
      {
        title: 'Request initial documentation',
        assignee: 'document-team',
        dueInDays: 5,
      },
      {
        title: 'Conduct initial assessment',
        assignee: 'audit-team',
        dueInDays: 7,
      },
      {
        title: 'Prepare and send contract',
        assignee: 'legal-team',
        dueInDays: 10,
      },
      {
        title: 'Schedule kick-off meeting',
        assignee: 'account-manager',
        dueInDays: 14,
      },
    ];

    for (const task of tasks) {
      this.eventEmitter.emit('task.create', {
        ...task,
        clientId,
        type: 'onboarding',
        dueDate: new Date(Date.now() + task.dueInDays * 24 * 60 * 60 * 1000),
      });
    }
  }

  private async completeOnboarding(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    // Mark client as active
    this.eventEmitter.emit('client.activated', {
      clientId: state.data.clientId,
      onboardingData: state.data,
      completedAt: state.completedAt,
    });

    // Clean up session after delay
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 24 * 60 * 60 * 1000); // Keep for 24 hours
  }
}
```

### 3.3 Policy Service - Compliance Engine

#### 3.3.1 Policy Evaluation Engine
**File**: `services/policy-service/src/modules/policy-engine/policy-evaluator.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface PolicyRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
}

interface EvaluationContext {
  clientId: string;
  controlId?: string;
  evidenceCount?: number;
  lastTestDate?: Date;
  testResults?: any[];
  metadata?: Record<string, any>;
}

interface EvaluationResult {
  passed: boolean;
  score: number;
  violations: Violation[];
  suggestions: string[];
}

@Injectable()
export class PolicyEvaluatorService {
  async evaluatePolicy(
    policyId: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
      relations: ['rules'],
    });

    if (!policy) throw new Error('Policy not found');

    const results = await Promise.all(
      policy.rules.map(rule => this.evaluateRule(rule, context))
    );

    return this.aggregateResults(results);
  }

  private async evaluateRule(
    rule: PolicyRule,
    context: EvaluationContext,
  ): Promise<RuleResult> {
    // Parse and evaluate condition
    const conditionResult = await this.evaluateCondition(
      rule.condition,
      context
    );

    if (!conditionResult.passed) {
      return {
        ruleId: rule.id,
        passed: false,
        violation: {
          ruleId: rule.id,
          message: conditionResult.message,
          severity: this.calculateSeverity(rule.priority),
          remediation: rule.action,
        },
      };
    }

    return {
      ruleId: rule.id,
      passed: true,
    };
  }

  private async evaluateCondition(
    condition: string,
    context: EvaluationContext,
  ): Promise<{ passed: boolean; message?: string }> {
    // Parse DSL condition
    const ast = this.parseCondition(condition);
    
    // Evaluate AST against context
    return this.evaluateAST(ast, context);
  }

  private parseCondition(condition: string): ConditionAST {
    // Implementation of DSL parser
    // Supports: AND, OR, NOT, GT, LT, EQ, IN, CONTAINS
    // Variables: ${control.status}, ${evidence.count}, etc.
    // Functions: COUNT(), SUM(), AVG(), MIN(), MAX()
    
    // Example condition: "${evidence.count} >= 3 AND ${control.status} == 'implemented'"
    // Would parse to AST structure
  }

  private async evaluateAST(
    ast: ConditionAST,
    context: EvaluationContext,
  ): Promise<{ passed: boolean; message?: string }> {
    switch (ast.type) {
      case 'AND':
        const andResults = await Promise.all(
          ast.operands.map(op => this.evaluateAST(op, context))
        );
        return {
          passed: andResults.every(r => r.passed),
          message: andResults.find(r => !r.passed)?.message,
        };
      
      case 'OR':
        const orResults = await Promise.all(
          ast.operands.map(op => this.evaluateAST(op, context))
        );
        return {
          passed: orResults.some(r => r.passed),
          message: orResults.every(r => !r.passed) 
            ? 'No conditions met' 
            : undefined,
        };
      
      case 'COMPARISON':
        return this.evaluateComparison(ast, context);
      
      case 'FUNCTION':
        return this.evaluateFunction(ast, context);
      
      default:
        throw new Error(`Unknown AST type: ${ast.type}`);
    }
  }

  async calculateCompliance(
    clientId: string,
    frameworkId: string,
  ): Promise<ComplianceScore> {
    const controls = await this.getFrameworkControls(frameworkId);
    const evaluations = await Promise.all(
      controls.map(control => 
        this.evaluateControlCompliance(clientId, control.id)
      )
    );

    const passed = evaluations.filter(e => e.passed).length;
    const total = evaluations.length;
    const score = (passed / total) * 100;

    return {
      frameworkId,
      score,
      passed,
      total,
      failed: total - passed,
      details: evaluations,
      calculatedAt: new Date(),
    };
  }
}
```

#### 3.3.2 Control Mapping Engine
**File**: `services/policy-service/src/modules/compliance/mapping-engine.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface FrameworkControl {
  frameworkId: string;
  controlId: string;
  title: string;
  description: string;
  category: string;
  mappings?: string[];
}

@Injectable()
export class MappingEngineService {
  // Mapping database - in production this would be in PostgreSQL
  private mappings = new Map<string, Set<string>>();

  async mapControlToFrameworks(
    controlId: string,
    frameworkIds: string[],
  ): Promise<void> {
    for (const frameworkId of frameworkIds) {
      const key = `${controlId}:${frameworkId}`;
      
      // Find best matching control in target framework
      const match = await this.findBestMatch(controlId, frameworkId);
      
      if (match.confidence > 0.7) {
        this.addMapping(controlId, match.targetControlId);
      }
    }
  }

  private async findBestMatch(
    sourceControlId: string,
    targetFramework: string,
  ): Promise<{ targetControlId: string; confidence: number }> {
    const sourceControl = await this.getControl(sourceControlId);
    const targetControls = await this.getFrameworkControls(targetFramework);

    let bestMatch = { targetControlId: '', confidence: 0 };

    for (const target of targetControls) {
      const similarity = this.calculateSimilarity(sourceControl, target);
      
      if (similarity > bestMatch.confidence) {
        bestMatch = {
          targetControlId: target.controlId,
          confidence: similarity,
        };
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(
    source: FrameworkControl,
    target: FrameworkControl,
  ): number {
    // Calculate similarity based on:
    // 1. Title similarity (30%)
    // 2. Description similarity (40%)
    // 3. Category match (20%)
    // 4. Existing mappings (10%)

    const titleSim = this.textSimilarity(source.title, target.title) * 0.3;
    const descSim = this.textSimilarity(source.description, target.description) * 0.4;
    const catSim = source.category === target.category ? 0.2 : 0;
    const mapSim = this.mappingSimilarity(source.mappings, target.mappings) * 0.1;

    return titleSim + descSim + catSim + mapSim;
  }

  private textSimilarity(text1: string, text2: string): number {
    // Implement Levenshtein distance or use NLP library
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  async suggestMappings(control: Control): Promise<SuggestedMapping[]> {
    const suggestions: SuggestedMapping[] = [];

    // Check against common frameworks
    const frameworks = ['SOC2', 'ISO27001', 'NIST', 'PCI-DSS'];
    
    for (const framework of frameworks) {
      const matches = await this.findBestMatch(control.id, framework);
      
      if (matches.confidence > 0.5) {
        suggestions.push({
          framework,
          targetControlId: matches.targetControlId,
          confidence: matches.confidence,
          reason: this.explainMapping(control, matches),
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private explainMapping(
    control: Control,
    match: any,
  ): string {
    // Generate human-readable explanation
    return `Similar requirements for ${control.category} controls`;
  }
}
```

### 3.4 Control Service - Risk Management

#### 3.4.1 Risk Scoring Engine
**File**: `services/control-service/src/modules/risk/risk-calculator.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface ThreatProfile {
  threatActorCapability: number; // 0-100
  threatActorMotivation: number; // 0-100
  threatFrequency: number; // events per year
}

interface VulnerabilityProfile {
  exposure: number; // 0-100
  exploitability: number; // 0-100
  prevalence: number; // 0-100
}

interface RiskCalculation {
  inherentRisk: number;
  residualRisk: number;
  riskReduction: number;
  confidenceInterval: [number, number];
}

@Injectable()
export class RiskCalculatorService {
  async calculateInherentRisk(
    threat: ThreatProfile,
    vulnerability: VulnerabilityProfile,
  ): Promise<Risk> {
    // FAIR methodology calculation
    const threatEventFrequency = this.calculateTEF(threat);
    const lossMagnitude = this.calculateLossMagnitude(vulnerability);
    
    const inherentRisk = threatEventFrequency * lossMagnitude;

    return {
      value: inherentRisk,
      level: this.getRiskLevel(inherentRisk),
      factors: {
        threatEventFrequency,
        lossMagnitude,
        threat,
        vulnerability,
      },
    };
  }

  private calculateTEF(threat: ThreatProfile): number {
    // Threat Event Frequency = Contact Frequency × Probability of Action
    const contactFrequency = threat.threatFrequency;
    const probabilityOfAction = 
      (threat.threatActorCapability / 100) * 
      (threat.threatActorMotivation / 100);
    
    return contactFrequency * probabilityOfAction;
  }

  private calculateLossMagnitude(vulnerability: VulnerabilityProfile): number {
    // Primary Loss + Secondary Loss
    const primaryLoss = this.calculatePrimaryLoss(vulnerability);
    const secondaryLoss = this.calculateSecondaryLoss(vulnerability);
    
    return primaryLoss + secondaryLoss;
  }

  private calculatePrimaryLoss(vulnerability: VulnerabilityProfile): number {
    // Asset value × Vulnerability
    const assetValue = 1000000; // Example: $1M
    const vulnerabilityFactor = 
      (vulnerability.exposure / 100) * 
      (vulnerability.exploitability / 100);
    
    return assetValue * vulnerabilityFactor;
  }

  private calculateSecondaryLoss(vulnerability: VulnerabilityProfile): number {
    // Reputation damage, legal costs, etc.
    const reputationLoss = 500000;
    const legalCosts = 200000;
    const regulatoryFines = 300000;
    
    const probabilityOfSecondaryLoss = vulnerability.prevalence / 100;
    
    return (reputationLoss + legalCosts + regulatoryFines) * probabilityOfSecondaryLoss;
  }

  async calculateResidualRisk(
    inherentRisk: Risk,
    controls: Control[],
  ): Promise<Risk> {
    let riskReduction = 0;

    for (const control of controls) {
      const effectiveness = await this.getControlEffectiveness(control);
      riskReduction += effectiveness * (1 - riskReduction); // Diminishing returns
    }

    const residualValue = inherentRisk.value * (1 - riskReduction);

    return {
      value: residualValue,
      level: this.getRiskLevel(residualValue),
      riskReduction: riskReduction * 100,
      controlsApplied: controls.length,
    };
  }

  private async getControlEffectiveness(control: Control): Promise<number> {
    // Based on control testing results
    const testResults = await this.getControlTestResults(control.id);
    
    if (!testResults || testResults.length === 0) {
      return 0.5; // Default 50% if untested
    }

    const passRate = testResults.filter(t => t.passed).length / testResults.length;
    return passRate * control.designEffectiveness;
  }

  async runMonteCarloSimulation(
    threat: ThreatProfile,
    vulnerability: VulnerabilityProfile,
    iterations: number = 10000,
  ): Promise<MonteCarloResult> {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Add random variation to inputs
      const variedThreat = this.addVariation(threat, 0.2);
      const variedVuln = this.addVariation(vulnerability, 0.2);
      
      const risk = await this.calculateInherentRisk(variedThreat, variedVuln);
      results.push(risk.value);
    }

    results.sort((a, b) => a - b);

    return {
      mean: results.reduce((a, b) => a + b, 0) / results.length,
      median: results[Math.floor(results.length / 2)],
      percentile5: results[Math.floor(results.length * 0.05)],
      percentile95: results[Math.floor(results.length * 0.95)],
      standardDeviation: this.calculateStdDev(results),
      confidenceInterval: [
        results[Math.floor(results.length * 0.025)],
        results[Math.floor(results.length * 0.975)],
      ],
    };
  }

  private addVariation(
    profile: any,
    variationPercent: number,
  ): any {
    const varied = { ...profile };
    
    for (const key in varied) {
      if (typeof varied[key] === 'number') {
        const variation = (Math.random() - 0.5) * 2 * variationPercent;
        varied[key] = varied[key] * (1 + variation);
      }
    }
    
    return varied;
  }

  private getRiskLevel(value: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (value < 100000) return 'LOW';
    if (value < 500000) return 'MEDIUM';
    if (value < 1000000) return 'HIGH';
    return 'CRITICAL';
  }
}
```

---

## 4. API Contracts & Data Flows

### 4.1 Service Communication Matrix

| Source Service | Target Service | Communication Method | Data Flow |
|----------------|----------------|---------------------|-----------|
| Frontend | Auth Service | REST API | Login, JWT tokens |
| Frontend | Client Service | REST API | Client CRUD |
| Auth Service | All Services | JWT Validation | User context |
| Client Service | Policy Service | Kafka Events | Client created/updated |
| Policy Service | Control Service | REST API | Control requirements |
| Control Service | Evidence Service | Kafka Events | Evidence requests |
| Evidence Service | Workflow Service | Kafka Events | Collection tasks |
| Workflow Service | All Services | REST API | Task execution |
| Reporting Service | All Services | REST API | Data aggregation |
| All Services | Notification Service | Kafka Events | Alert triggers |
| All Services | Audit Service | Kafka Events | Audit trail |

### 4.2 Event Definitions

```typescript
// Standardized event structure
interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  version: string;
  source: string;
  userId: string;
  organizationId: string;
  correlationId?: string;
  payload: Record<string, any>;
}

// Event types
enum EventType {
  // Auth events
  USER_REGISTERED = 'auth.user.registered',
  USER_LOGGED_IN = 'auth.user.logged_in',
  USER_LOGGED_OUT = 'auth.user.logged_out',
  
  // Client events
  CLIENT_CREATED = 'client.organization.created',
  CLIENT_UPDATED = 'client.organization.updated',
  CLIENT_ONBOARDED = 'client.organization.onboarded',
  
  // Policy events
  POLICY_CREATED = 'policy.policy.created',
  POLICY_EVALUATED = 'policy.policy.evaluated',
  COMPLIANCE_CALCULATED = 'policy.compliance.calculated',
  
  // Control events
  CONTROL_IMPLEMENTED = 'control.control.implemented',
  CONTROL_TESTED = 'control.control.tested',
  RISK_ASSESSED = 'control.risk.assessed',
  
  // Evidence events
  EVIDENCE_COLLECTED = 'evidence.evidence.collected',
  EVIDENCE_APPROVED = 'evidence.evidence.approved',
  EVIDENCE_REJECTED = 'evidence.evidence.rejected',
  
  // Workflow events
  WORKFLOW_STARTED = 'workflow.workflow.started',
  TASK_ASSIGNED = 'workflow.task.assigned',
  TASK_COMPLETED = 'workflow.task.completed',
  
  // Reporting events
  REPORT_GENERATED = 'reporting.report.generated',
  REPORT_SCHEDULED = 'reporting.report.scheduled',
}
```

### 4.3 REST API Contracts

```typescript
// Standard response format
interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Example: Client Service API
interface ClientAPI {
  // GET /clients
  getClients(query: ClientQuery): Promise<ApiResponse<Client[]>>;
  
  // GET /clients/:id
  getClient(id: string): Promise<ApiResponse<Client>>;
  
  // POST /clients
  createClient(data: CreateClientDto): Promise<ApiResponse<Client>>;
  
  // PATCH /clients/:id
  updateClient(id: string, data: UpdateClientDto): Promise<ApiResponse<Client>>;
  
  // DELETE /clients/:id
  deleteClient(id: string): Promise<ApiResponse<void>>;
  
  // POST /clients/:id/onboard
  startOnboarding(id: string): Promise<ApiResponse<OnboardingSession>>;
  
  // GET /clients/:id/compliance
  getComplianceStatus(id: string): Promise<ApiResponse<ComplianceStatus>>;
}
```

---

## 5. Testing Requirements

### 5.0 CRITICAL: TypeORM Testing Pattern
**THIS IS WHY TESTS APPEAR TO PASS BUT DON'T WORK**

```typescript
// ❌ WRONG - Standard NestJS testing (WILL FAIL WITH TYPEORM)
describe('ClientService', () => {
  let service: ClientService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ClientService],
    }).compile();
    
    service = module.get<ClientService>(ClientService);
  });
});

// ✅ CORRECT - Manual instantiation for TypeORM
describe('ClientService', () => {
  let service: ClientService;
  let mockRepository: any;
  
  beforeEach(() => {
    // Manual mocks
    mockRepository = {
      find: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    
    // Manual instantiation
    service = new ClientService(
      mockRepository,
      mockEventEmitter,
      mockRedisService
    );
  });
  
  it('should create client', async () => {
    mockRepository.save.mockResolvedValue({ id: '123' });
    const result = await service.create(data);
    expect(result.id).toBe('123');
  });
});
```

**Why This Matters**:
- TypeORM decorators conflict with NestJS DI in tests
- Tests using Test.createTestingModule will hang or fail silently
- This is why services show "100% passing" but don't actually work

### 5.1 Unit Test Coverage Requirements

| Service | Target Coverage | Current Coverage | Required Tests |
|---------|----------------|------------------|----------------|
| Auth Service | 85% | 100% | Maintain |
| Client Service | 85% | 70% | Add service tests |
| Policy Service | 85% | 58% | Fix failing tests |
| Control Service | 85% | 100% | Maintain |
| Evidence Service | 85% | 80% | Add edge cases |
| Workflow Service | 80% | Unknown | Full test suite |
| Reporting Service | 80% | Unknown | Full test suite |
| Audit Service | 85% | Unknown | Full test suite |
| Integration Service | 80% | Unknown | Full test suite |
| Notification Service | 80% | Unknown | Full test suite |
| AI Service | 75% | Unknown | Full test suite |

### 5.2 Integration Test Scenarios

```typescript
// Example: Client Onboarding E2E Test
describe('Client Onboarding Flow', () => {
  it('should complete full onboarding process', async () => {
    // 1. Create user account
    const user = await authService.register({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
    
    // 2. Login and get token
    const { token } = await authService.login({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
    
    // 3. Create client
    const client = await clientService.create({
      name: 'Test Corp',
      type: 'enterprise',
    }, token);
    
    // 4. Start onboarding
    const session = await clientService.startOnboarding(client.id);
    
    // 5. Complete each step
    await clientService.completeStep(session.id, 'ORGANIZATION_DETAILS', {
      legalName: 'Test Corporation Inc.',
      taxId: '12-3456789',
    });
    
    // 6. Verify completion
    const finalStatus = await clientService.getOnboardingStatus(session.id);
    expect(finalStatus.completed).toBe(true);
    
    // 7. Verify events emitted
    expect(eventBus.events).toContainEqual(
      expect.objectContaining({ type: 'client.organization.onboarded' })
    );
  });
});
```

### 5.3 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| API Response Time | < 200ms (p95) | APM monitoring |
| Database Query Time | < 50ms (p95) | Query logging |
| Kafka Message Processing | < 100ms | Event timestamps |
| Report Generation | < 30s for 100 pages | Timer |
| Concurrent Users | 1000 | Load testing |
| Uptime | 99.9% | Health checks |

---

## 6. Deployment Pipeline

### 6.0 🚨 CRITICAL: Stop Testing Locally - Use Docker for REAL Functionality
**LOCAL TESTING PROVES NOTHING - DOCKER IS PRODUCTION**

```bash
# ❌ WRONG - This proves NOTHING about real functionality
cd services/auth-service
npm run start:dev  # Running locally with mock data
curl http://localhost:3001/health  # Meaningless test

# ✅ CORRECT - Real production testing in Docker
docker-compose up -d auth-service client-service policy-service
docker-compose logs -f auth-service  # Watch real logs

# With Kong Konnect (cloud gateway):
curl https://[your-gateway].konghq.com/auth/health  # Through Konnect
curl https://[your-gateway].konghq.com/clients  # Real service calls

# Or if using local development proxy:
curl http://localhost:8000/auth/health  # Through local proxy to Konnect
```

**Why Local Testing is USELESS**:
1. **No Real Integration**: Services can't talk to each other
2. **Wrong Network**: Using localhost instead of Docker network
3. **No Kong Gateway**: Missing authentication and routing
4. **Mock Data**: Not using real PostgreSQL/Redis/Kafka
5. **False Positives**: Services appear to work but don't

**REAL E2E Testing Requirements**:
```yaml
# ALL services must be in docker-compose.yml and RUNNING:
services:
  kong:         # API Gateway - MUST be running
  postgres:     # Real database - NOT in-memory
  redis:        # Real cache - NOT mocked
  kafka:        # Real events - NOT EventEmitter only
  auth-service: # In Docker - NOT local
  client-service: # In Docker - NOT local
  [all 11 services in Docker]
```

**Real Functionality Test**:
```bash
# This is the ONLY valid test of functionality:
1. Start ALL services in Docker
   docker-compose up -d

2. Create a user through Kong
   curl -X POST http://localhost:8000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'

3. Login and get JWT
   TOKEN=$(curl -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}' \
     | jq -r '.token')

4. Create a client through authenticated API
   curl -X POST http://localhost:8000/clients \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Corp","type":"enterprise"}'

5. Verify Kafka events were published
   docker exec kafka kafka-console-consumer \
     --bootstrap-server localhost:9092 \
     --topic client-events \
     --from-beginning

6. Verify data persisted in PostgreSQL
   docker exec postgres psql -U soc_user -d soc_clients \
     -c "SELECT * FROM clients;"

# If ANY of these fail, the service is NOT functional
```

### 6.1 Docker Deployment Configuration

```dockerfile
# Standard Dockerfile template for all services
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error()})"

# Run as non-root user
USER node

# Start application
CMD ["node", "dist/main.js"]
```

### 6.2 Kubernetes Deployment

```yaml
# Example: Auth Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: soc-compliance
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: soc-compliance/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-credentials
              key: secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 6.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Check coverage
        run: npm run test:coverage
        
  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, client, policy, control, evidence, workflow, reporting, audit, integration, notification, ai]
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t soc-compliance/${{ matrix.service }}-service:${{ github.sha }} \
            -f services/${{ matrix.service }}-service/Dockerfile \
            services/${{ matrix.service }}-service
            
      - name: Push to registry
        run: |
          docker push soc-compliance/${{ matrix.service }}-service:${{ github.sha }}
          
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/${{ matrix.service }}-service \
            ${{ matrix.service }}-service=soc-compliance/${{ matrix.service }}-service:${{ github.sha }} \
            -n soc-compliance
```

---

## 7. Success Metrics

### 7.0 Definition of "Functional Service"
**A service is NOT functional unless ALL of these are true:**

```yaml
Functional Service Checklist:
  ✓ Builds to dist/main.js (NOT dist/src/main.js)
  ✓ Dockerfile works and starts without errors
  ✓ Runs in docker-compose with other services
  ✓ Registered with Kong Konnect (cloud gateway)
  ✓ Health endpoint responds through Konnect gateway
  ✓ Can receive and validate JWT tokens from Keycloak/Auth service
  ✓ Connects to its PostgreSQL database (not mocked)
  ✓ Publishes events to Kafka (verified with consumer)
  ✓ Receives events from Kafka (verified with producer)
  ✓ Stores data that persists across restarts
  ✓ Returns real data (not hardcoded responses)
  ✓ Handles errors without crashing
  ✓ Logs to stdout for Docker logging
  ✓ Integrates with at least one other service
  ✓ Frontend can call it through Kong and get real data
```

**How to Verify a Service is Functional**:
```bash
# 1. Service starts in Docker
docker-compose up -d [service-name]
docker-compose ps [service-name]  # Status should be "Up"

# 2. Health check works through Kong
curl http://localhost:8000/[service]/health
# Should return: {"status":"ok","timestamp":"..."}

# 3. Service accepts authenticated requests
TOKEN="[jwt-from-auth-service]"
curl http://localhost:8000/[service]/endpoint \
  -H "Authorization: Bearer $TOKEN"
# Should return real data, not 401/403

# 4. Database has real data
docker exec postgres psql -U soc_user -d soc_[service] \
  -c "SELECT COUNT(*) FROM [table];"
# Should show > 0 records after operations

# 5. Kafka events are flowing
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic [service]-events \
  --max-messages 1
# Should see JSON events

# 6. Service-to-service calls work
# Create entity in Service A that triggers Service B
# Verify Service B received and processed the event
```

### 7.1 Week-by-Week Milestones

| Week | Deliverables | Success Criteria |
|------|--------------|------------------|
| Week 1 | Infrastructure fixes, Type safety | Kong operational, 0 "as any" |
| Week 2 | Auth & Client services | Full CRUD, Keycloak integrated |
| Week 3 | Policy & Control services | Engine working, Risk calculations |
| Week 4 | Evidence & Workflow services | File upload, BPMN engine |
| Week 5 | Reporting & Audit services | PDF generation, Audit trails |
| Week 6 | Integration & Notification | Webhooks, Multi-channel delivery |
| Week 7 | AI Service | Anomaly detection, Predictions |
| Week 8 | Frontend integration | Real API connections |
| Week 9 | Testing & Quality | 80% coverage, All tests passing |
| Week 10 | Production deployment | All services running, Monitoring active |

### 7.2 Definition of Done

- [ ] Code compiles without errors
- [ ] Zero "as any" in production code
- [ ] Unit tests passing with >80% coverage
- [ ] Integration tests for critical paths
- [ ] Docker container builds and runs
- [ ] API documentation complete
- [ ] Security review passed
- [ ] Performance benchmarks met
- [ ] Deployed to staging environment
- [ ] E2E tests passing

### 7.3 Key Performance Indicators

| KPI | Target | Measurement |
|-----|--------|-------------|
| Service Availability | 99.9% | Uptime monitoring |
| API Response Time | <200ms p95 | APM metrics |
| Test Coverage | >80% | Jest coverage |
| Build Success Rate | >95% | CI/CD metrics |
| Deployment Frequency | Daily | GitHub Actions |
| Mean Time to Recovery | <1 hour | Incident tracking |
| Customer Satisfaction | >4.5/5 | User surveys |

---

## Appendix A: Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | Node.js | 18.x | JavaScript runtime |
| Framework | NestJS | 10.x | Backend framework |
| Database | PostgreSQL | 15.x | Primary database |
| Cache | Redis | 7.x | Session & cache storage |
| Message Queue | Kafka | 3.x | Event streaming |
| Search | Elasticsearch | 8.x | Full-text search |
| API Gateway | Kong | 3.4 | API management |
| Authentication | Keycloak | 22.x | Identity provider |
| Monitoring | Prometheus | 2.x | Metrics collection |
| Tracing | Jaeger | 1.x | Distributed tracing |
| Container | Docker | 24.x | Containerization |
| Orchestration | Kubernetes | 1.28 | Container orchestration |
| CI/CD | GitHub Actions | - | Automation pipeline |

---

## Appendix B: Security Considerations

### B.1 Authentication & Authorization
- JWT tokens with 1-hour expiration
- Refresh tokens with 7-day expiration
- API keys for service-to-service communication
- Role-based access control (RBAC)
- Multi-factor authentication (MFA)

### B.2 Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII data masking in logs
- Secure credential storage (HashiCorp Vault)
- Regular security audits

### B.3 Compliance
- SOC 2 Type II compliant infrastructure
- GDPR data handling procedures
- HIPAA-compliant data storage (if needed)
- Regular penetration testing
- Vulnerability scanning

---

## Appendix C: Troubleshooting Guide

### C.1 Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Kong not starting | Connection refused on port 8000 | Check YAML syntax, verify Docker network |
| TypeScript errors | Compilation fails | Remove "as any", add proper types |
| Tests hanging | Jest doesn't complete | Add --detectOpenHandles flag |
| Database connection failed | ECONNREFUSED | Use 127.0.0.1 instead of localhost |
| Kafka not connecting | Timeout errors | Check Zookeeper status, verify network |
| Redis connection lost | Session errors | Check Redis memory, restart container |

### C.2 Debug Commands

```bash
# Check service health
curl http://localhost:3001/health

# View Docker logs
docker-compose logs -f [service-name]

# Access PostgreSQL
docker exec -it overmatch-digital-postgres-1 psql -U soc_user -d soc_auth

# Check Kafka topics
docker exec overmatch-digital-kafka-1 kafka-topics.sh --list --bootstrap-server localhost:9092

# Monitor Redis
docker exec -it overmatch-digital-redis-1 redis-cli -a soc_redis_pass monitor

# View Kong configuration
curl http://localhost:8001/config

# Check port usage
netstat -ano | findstr :3001
```

---

## Appendix D: No Workarounds Policy

### D.1 Enterprise Standards Only
**This platform MUST use enterprise-grade solutions. NO EXCEPTIONS.**

```yaml
APPROVED Solutions:
  API Gateway: Kong Konnect (cloud) - NOT local Kong
  Identity: Keycloak with OIDC/SAML - NOT basic JWT only
  Secrets: Infrastructure-level (K8s/Docker) - NOT app-level
  Monitoring: OpenTelemetry + Prometheus - NOT console.log
  Databases: Managed PostgreSQL - NOT SQLite/H2
  Events: Kafka with schemas - NOT simple EventEmitter
  Cache: Redis Cluster - NOT in-memory maps

PROHIBITED Workarounds:
  ✗ Local Kong instead of Konnect
  ✗ Hardcoded credentials
  ✗ Mock data in production code  
  ✗ Skipping authentication "for now"
  ✗ Using localhost in production configs
  ✗ "Temporary" solutions that become permanent
  ✗ Testing locally without Docker
```

### D.2 Definition of "Production Ready"
```yaml
Production Ready means:
  ✓ Works in Docker/Kubernetes (not just locally)
  ✓ Connects through Kong Konnect (not direct)
  ✓ Uses real databases (not mocks)
  ✓ Implements full security (not bypassed)
  ✓ Has monitoring/logging (not console.log)
  ✓ Handles errors properly (not crashes)
  ✓ Scales horizontally (not single instance)
  ✓ Has disaster recovery (not single point of failure)
```

### D.3 When Tempted to Use Workarounds
```bash
# Before implementing ANY workaround, ask:
1. Is this how Amazon/Google/Microsoft would build it?
2. Will this pass a SOC 2 audit?
3. Can this handle 10,000 concurrent users?
4. Will this work in multiple regions?
5. Can we explain this to enterprise customers?

# If ANY answer is "no", DON'T DO IT.
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Aug 2025 | Team | Initial comprehensive roadmap |
| 1.1.0 | Aug 2025 | Team | Added Kong Konnect enterprise architecture |

---

**END OF DOCUMENT**

This implementation roadmap serves as the definitive guide for achieving a production-ready SOC compliance platform with real, functional business logic across all services.