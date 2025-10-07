# Inter-Service Communication Guide - SOC Compliance Platform

**Last Updated**: August 14, 2025

## Current State

### Docker Deployment Status
- **Policy Service**: ✅ Deployed to Docker with event bus configured
- **Other Services**: ⚠️ Need Docker deployment
- **Kafka**: ✅ Running and accessible
- **Event Flow**: Partially tested, needs full E2E validation

### Service-to-Service Authentication
- **Infrastructure Level**: Services use environment variables for configuration
- **API Keys**: Managed through ServiceApiKeysConfig for development
- **Production**: Will use AWS Secrets Manager or HashiCorp Vault

This guide documents the event-driven architecture and communication patterns used between microservices in the SOC Compliance Platform.

## Overview

The SOC Compliance Platform uses Apache Kafka for asynchronous, event-driven communication between services. This architecture ensures:

- **Loose Coupling**: Services communicate through events, not direct calls
- **Scalability**: Events can be processed by multiple consumers
- **Resilience**: Services can continue operating if others are temporarily unavailable
- **Audit Trail**: All events are logged for compliance requirements

## Architecture

```
┌─────────────┐     Events      ┌─────────────┐     Events      ┌─────────────┐
│   Service   │ ─────────────▶  │    Kafka    │ ─────────────▶  │   Service   │
│  Publisher  │                  │   Broker    │                  │  Consumer   │
└─────────────┘                  └─────────────┘                  └─────────────┘
                                        │
                                        ▼
                                 ┌─────────────┐
                                 │   Schema    │
                                 │  Registry   │
                                 └─────────────┘
```

## Event Naming Convention

All events follow a consistent naming pattern:

```
Pattern: service.entity.action

Examples:
- auth.user.created
- client.organization.updated
- policy.control.mapped
- evidence.document.uploaded
- workflow.step.completed
```

## Core Event Contracts

### Authentication Events

#### auth.user.created
```typescript
interface UserCreatedEvent {
  userId: string;
  email: string;
  organizationId: string;
  roles: string[];
  timestamp: Date;
  metadata?: {
    source: string;
    invitedBy?: string;
    correlationId?: string;
  };
}
```

#### auth.user.updated
```typescript
interface UserUpdatedEvent {
  userId: string;
  organizationId: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  updatedBy: string;
  timestamp: Date;
}
```

#### auth.session.created
```typescript
interface SessionCreatedEvent {
  sessionId: string;
  userId: string;
  organizationId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

#### auth.mfa.enabled
```typescript
interface MFAEnabledEvent {
  userId: string;
  method: 'totp' | 'sms' | 'email';
  timestamp: Date;
}
```

### Client Service Events

#### client.organization.created
```typescript
interface OrganizationCreatedEvent {
  organizationId: string;
  name: string;
  type: 'enterprise' | 'standard' | 'startup';
  ownerId: string;
  timestamp: Date;
  metadata?: {
    source: string;
    correlationId?: string;
  };
}
```

#### client.client.created
```typescript
interface ClientCreatedEvent {
  clientId: string;
  organizationId: string;
  name: string;
  industry: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  timestamp: Date;
}
```

#### client.contract.signed
```typescript
interface ContractSignedEvent {
  contractId: string;
  clientId: string;
  organizationId: string;
  signedBy: string;
  signedAt: Date;
  contractType: 'soc1' | 'soc2_type1' | 'soc2_type2';
}
```

### Policy Service Events

#### policy.policy.created
```typescript
interface PolicyCreatedEvent {
  policyId: string;
  organizationId: string;
  title: string;
  category: 'security' | 'privacy' | 'compliance' | 'operational';
  version: string;
  createdBy: string;
  timestamp: Date;
}
```

#### policy.policy.updated
```typescript
interface PolicyUpdatedEvent {
  policyId: string;
  organizationId: string;
  version: number;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  updatedBy: string;
  timestamp: Date;
}
```

#### policy.policy.approved
```typescript
interface PolicyApprovedEvent {
  policyId: string;
  organizationId: string;
  approvedBy: string;
  approvalLevel: 'reviewer' | 'manager' | 'executive';
  comments?: string;
  timestamp: Date;
}
```

#### policy.control.mapped
```typescript
interface ControlMappedEvent {
  policyId: string;
  controlId: string;
  frameworkId: string;
  organizationId: string;
  mappedBy: string;
  timestamp: Date;
}
```

### Control Service Events

#### control.test.scheduled
```typescript
interface ControlTestScheduledEvent {
  testId: string;
  controlId: string;
  organizationId: string;
  scheduledFor: Date;
  assignedTo: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  timestamp: Date;
}
```

#### control.test.completed
```typescript
interface ControlTestCompletedEvent {
  testId: string;
  controlId: string;
  organizationId: string;
  status: 'passed' | 'failed' | 'partial';
  findings: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }[];
  testedBy: string;
  timestamp: Date;
}
```

#### control.implementation.updated
```typescript
interface ControlImplementationUpdatedEvent {
  controlId: string;
  organizationId: string;
  implementationStatus: 'not_started' | 'in_progress' | 'implemented' | 'not_applicable';
  implementationDetails: string;
  updatedBy: string;
  timestamp: Date;
}
```

### Evidence Service Events

#### evidence.document.uploaded
```typescript
interface DocumentUploadedEvent {
  documentId: string;
  evidenceId: string;
  organizationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  associatedControls: string[];
  timestamp: Date;
  metadata?: {
    hash: string;
    virusScanStatus: 'clean' | 'infected' | 'pending';
  };
}
```

#### evidence.collection.completed
```typescript
interface EvidenceCollectionCompletedEvent {
  collectionId: string;
  organizationId: string;
  controlIds: string[];
  evidenceCount: number;
  period: {
    start: Date;
    end: Date;
  };
  completedBy: string;
  timestamp: Date;
}
```

### Workflow Service Events

#### workflow.instance.started
```typescript
interface WorkflowInstanceStartedEvent {
  instanceId: string;
  workflowId: string;
  organizationId: string;
  initiatedBy: string;
  context: Record<string, any>;
  timestamp: Date;
}
```

#### workflow.step.completed
```typescript
interface WorkflowStepCompletedEvent {
  instanceId: string;
  stepId: string;
  organizationId: string;
  outcome: 'approved' | 'rejected' | 'completed';
  completedBy: string;
  nextStepId?: string;
  timestamp: Date;
}
```

#### workflow.instance.completed
```typescript
interface WorkflowInstanceCompletedEvent {
  instanceId: string;
  workflowId: string;
  organizationId: string;
  finalStatus: 'completed' | 'cancelled' | 'failed';
  duration: number; // milliseconds
  timestamp: Date;
}
```

### Reporting Service Events

#### reporting.report.generated
```typescript
interface ReportGeneratedEvent {
  reportId: string;
  organizationId: string;
  reportType: 'soc1' | 'soc2_type1' | 'soc2_type2' | 'compliance_summary';
  format: 'pdf' | 'docx' | 'xlsx' | 'html';
  period: {
    start: Date;
    end: Date;
  };
  generatedBy: string;
  fileSize: number;
  timestamp: Date;
}
```

#### reporting.report.scheduled
```typescript
interface ReportScheduledEvent {
  scheduleId: string;
  organizationId: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  recipients: string[];
  nextRun: Date;
  createdBy: string;
  timestamp: Date;
}
```

### Audit Service Events

#### audit.audit.started
```typescript
interface AuditStartedEvent {
  auditId: string;
  organizationId: string;
  clientId: string;
  auditType: 'soc1' | 'soc2_type1' | 'soc2_type2';
  auditorId: string;
  period: {
    start: Date;
    end: Date;
  };
  timestamp: Date;
}
```

#### audit.finding.created
```typescript
interface AuditFindingCreatedEvent {
  findingId: string;
  auditId: string;
  organizationId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'control_deficiency' | 'compliance_gap' | 'operational_issue';
  affectedControls: string[];
  createdBy: string;
  timestamp: Date;
}
```

#### audit.audit.completed
```typescript
interface AuditCompletedEvent {
  auditId: string;
  organizationId: string;
  outcome: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer';
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  completedBy: string;
  timestamp: Date;
}
```

### Integration Service Events

#### integration.webhook.received
```typescript
interface WebhookReceivedEvent {
  webhookId: string;
  integrationId: string;
  organizationId: string;
  source: string;
  eventType: string;
  payload: any;
  timestamp: Date;
}
```

#### integration.sync.completed
```typescript
interface SyncCompletedEvent {
  syncId: string;
  integrationId: string;
  organizationId: string;
  provider: 'jira' | 'github' | 'slack' | 'teams' | 'okta';
  recordsSynced: number;
  errors: number;
  duration: number; // milliseconds
  timestamp: Date;
}
```

### Notification Service Events

#### notification.email.sent
```typescript
interface EmailSentEvent {
  notificationId: string;
  organizationId: string;
  recipientId: string;
  templateId: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  timestamp: Date;
  metadata?: {
    provider: 'sendgrid' | 'ses' | 'mailgun';
    messageId: string;
  };
}
```

#### notification.alert.triggered
```typescript
interface AlertTriggeredEvent {
  alertId: string;
  organizationId: string;
  type: 'control_failure' | 'compliance_issue' | 'security_event' | 'system_alert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  channels: ('email' | 'sms' | 'in_app' | 'slack')[];
  recipients: string[];
  timestamp: Date;
}
```

### AI Service Events

#### ai.analysis.completed
```typescript
interface AIAnalysisCompletedEvent {
  analysisId: string;
  organizationId: string;
  type: 'risk_assessment' | 'anomaly_detection' | 'compliance_prediction';
  confidence: number; // 0-1
  findings: {
    category: string;
    description: string;
    confidence: number;
    recommendations: string[];
  }[];
  timestamp: Date;
}
```

#### ai.insight.generated
```typescript
interface AIInsightGeneratedEvent {
  insightId: string;
  organizationId: string;
  category: 'compliance' | 'security' | 'operational' | 'financial';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendations: string[];
  timestamp: Date;
}
```

## Implementation Patterns

### Publishing Events

```typescript
// In any service
@Injectable()
export class SomeService {
  constructor(
    @Inject('EVENT_BUS')
    private readonly eventBus: ClientKafka,
  ) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(newUser);

    // Emit event
    await this.eventBus.emit('auth.user.created', {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles,
      timestamp: new Date(),
      metadata: {
        source: 'auth-service',
        correlationId: this.correlationId
      }
    });

    return user;
  }
}
```

### Consuming Events

```typescript
// In consuming service
@Controller()
export class EventHandlerController {
  constructor(
    private readonly userService: UserService,
  ) {}

  @EventPattern('auth.user.created')
  async handleUserCreated(data: UserCreatedEvent) {
    try {
      // Process the event
      await this.userService.onUserCreated(data);
      
      // Log success
      this.logger.log(`Processed user.created event for user ${data.userId}`);
    } catch (error) {
      // Handle errors appropriately
      this.logger.error(`Failed to process user.created event`, error);
      // Consider implementing retry logic or dead letter queue
    }
  }
}
```

### Event Bus Configuration

```typescript
// In app.module.ts
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'EVENT_BUS',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'auth-service',
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
          },
          consumer: {
            groupId: 'auth-service-group',
          },
          producer: {
            allowAutoTopicCreation: true,
            idempotent: true,
          },
        },
      },
    ]),
  ],
})
export class AppModule {}
```

## Best Practices

### 1. Event Design

- **Keep events immutable**: Once published, events should never change
- **Include all necessary data**: Events should be self-contained
- **Use past tense**: Events describe what has happened
- **Version events**: Include version field for future compatibility

### 2. Error Handling

```typescript
@EventPattern('some.event')
async handleEvent(data: SomeEvent) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await this.processEvent(data);
      return; // Success
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        // Send to dead letter queue
        await this.deadLetterQueue.send({
          event: 'some.event',
          data,
          error: error.message,
          attempts: attempt
        });
      } else {
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }
}
```

### 3. Idempotency

Ensure event handlers are idempotent:

```typescript
async handleOrderCreated(event: OrderCreatedEvent) {
  // Check if already processed
  const existing = await this.processedEvents.findOne({
    eventId: event.eventId
  });

  if (existing) {
    this.logger.warn(`Event ${event.eventId} already processed`);
    return;
  }

  // Process event
  await this.createOrder(event);

  // Mark as processed
  await this.processedEvents.save({
    eventId: event.eventId,
    processedAt: new Date()
  });
}
```

### 4. Event Ordering

When order matters, use event sourcing patterns:

```typescript
interface SequencedEvent {
  eventId: string;
  aggregateId: string;
  sequence: number;
  timestamp: Date;
  data: any;
}

// Process events in order
async processEventsForAggregate(aggregateId: string) {
  const events = await this.eventStore.find({
    where: { aggregateId },
    order: { sequence: 'ASC' }
  });

  for (const event of events) {
    await this.processEvent(event);
  }
}
```

### 5. Monitoring and Observability

```typescript
@EventPattern('*')
async handleAllEvents(data: any, context: KafkaContext) {
  const message = context.getMessage();
  const topic = context.getTopic();
  
  // Record metrics
  this.metrics.eventReceived.inc({
    topic,
    partition: message.partition
  });

  const timer = this.metrics.eventProcessingDuration.startTimer({
    topic
  });

  try {
    // Process event
    await this.processEvent(topic, data);
    
    this.metrics.eventProcessed.inc({
      topic,
      status: 'success'
    });
  } catch (error) {
    this.metrics.eventProcessed.inc({
      topic,
      status: 'error'
    });
    throw error;
  } finally {
    timer();
  }
}
```

## Testing Event-Driven Communication

### Unit Testing

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockEventBus: { emit: jest.Mock };

  beforeEach(() => {
    mockEventBus = { emit: jest.fn() };
    service = new UserService(mockRepository, mockEventBus);
  });

  it('should emit user.created event', async () => {
    const user = await service.createUser(dto);

    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'auth.user.created',
      expect.objectContaining({
        userId: user.id,
        email: user.email,
        timestamp: expect.any(Date)
      })
    );
  });
});
```

### Integration Testing

```typescript
describe('Event Integration', () => {
  let app: INestApplication;
  let eventBus: ClientKafka;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    eventBus = app.get('EVENT_BUS');
    
    await app.init();
    await eventBus.connect();
  });

  it('should handle cross-service event flow', async () => {
    const eventPromise = new Promise(resolve => {
      eventBus.subscribeToResponseOf('user.created');
      eventBus.send('user.created', userData).subscribe(resolve);
    });

    const result = await eventPromise;
    expect(result).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **Events not being received**
   - Check Kafka connectivity
   - Verify consumer group configuration
   - Ensure topic exists
   - Check service logs for errors

2. **Duplicate event processing**
   - Implement idempotency checks
   - Use unique event IDs
   - Configure proper consumer groups

3. **Event ordering issues**
   - Use single partition for ordered events
   - Implement sequence numbers
   - Consider event sourcing

4. **Performance issues**
   - Batch event processing
   - Implement async handlers
   - Monitor consumer lag
   - Scale consumers horizontally

### Debugging Commands

```bash
# List all topics
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# View consumer groups
docker exec kafka kafka-consumer-groups --list --bootstrap-server localhost:9092

# Check consumer lag
docker exec kafka kafka-consumer-groups --describe \
  --group auth-service-group \
  --bootstrap-server localhost:9092

# View topic messages
docker exec kafka kafka-console-consumer \
  --topic auth.user.created \
  --from-beginning \
  --bootstrap-server localhost:9092
```

## Service Communication Examples

### 1. Synchronous HTTP Communication Between Services
```typescript
// In client-service calling auth-service
import { Injectable, HttpService } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UserValidationService {
  constructor(private httpService: HttpService) {}

  async validateUser(userId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://auth-service:3001/users/${userId}`, {
          headers: {
            'X-Internal-Request': 'true',
            'X-Service-Name': 'client-service'
          }
        })
      );
      return response.data.active === true;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
```

### 2. Asynchronous Event Handling with Retries
```typescript
// In policy-service listening to control updates
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';

@Controller()
export class PolicyEventController {
  @EventPattern('control.control.updated')
  async handleControlUpdated(
    @Payload() data: ControlUpdatedEvent,
    @Ctx() context: KafkaContext
  ) {
    const retries = context.getMessage().headers?.['x-retry-count'] || 0;
    
    try {
      // Process the event
      await this.policyService.updateRelatedPolicies(data.controlId);
      
      // Acknowledge successful processing
      const channel = context.getChannelRef();
      const originalMessage = context.getMessage();
      await channel.ack(originalMessage);
    } catch (error) {
      if (retries < 3) {
        // Retry with exponential backoff
        await this.retryEvent(data, retries + 1);
      } else {
        // Send to dead letter queue
        await this.sendToDeadLetter(data, error);
      }
      throw error;
    }
  }

  private async retryEvent(data: any, retryCount: number) {
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    setTimeout(async () => {
      await this.eventBus.emit('control.control.updated', data, {
        headers: { 'x-retry-count': retryCount }
      });
    }, delay);
  }
}
```

### 3. Cross-Service Transaction Pattern
```typescript
// Saga pattern for distributed transactions
@Injectable()
export class CreateAuditSaga {
  constructor(
    private eventBus: ClientKafka,
    private auditService: AuditService
  ) {}

  async execute(createAuditDto: CreateAuditDto): Promise<Audit> {
    const sagaId = uuid();
    const steps = [];

    try {
      // Step 1: Create audit in audit service
      const audit = await this.auditService.create({
        ...createAuditDto,
        sagaId
      });
      steps.push({ service: 'audit', action: 'create', id: audit.id });

      // Step 2: Create workflow in workflow service
      await this.eventBus.emit('workflow.workflow.create', {
        auditId: audit.id,
        sagaId,
        workflowType: 'audit'
      });
      steps.push({ service: 'workflow', action: 'create' });

      // Step 3: Send notifications
      await this.eventBus.emit('notification.notification.send', {
        type: 'audit_created',
        recipients: audit.assignedTo,
        sagaId
      });
      steps.push({ service: 'notification', action: 'send' });

      return audit;
    } catch (error) {
      // Compensate by reversing completed steps
      await this.compensate(steps, sagaId);
      throw error;
    }
  }

  private async compensate(steps: any[], sagaId: string) {
    for (const step of steps.reverse()) {
      await this.eventBus.emit(`${step.service}.${step.action}.compensate`, {
        sagaId,
        ...step
      });
    }
  }
}
```

### 4. Service Health Checks Across Microservices
```typescript
// Centralized health check aggregator
@Injectable()
export class HealthAggregatorService {
  private readonly services = [
    { name: 'auth', url: 'http://auth-service:3001/health' },
    { name: 'client', url: 'http://client-service:3002/health' },
    { name: 'policy', url: 'http://policy-service:3003/health' },
    // ... other services
  ];

  async checkAllServices(): Promise<ServiceHealthStatus[]> {
    const healthChecks = await Promise.allSettled(
      this.services.map(async (service) => {
        try {
          const response = await firstValueFrom(
            this.httpService.get(service.url, { timeout: 5000 })
          );
          return {
            service: service.name,
            status: 'healthy',
            details: response.data
          };
        } catch (error) {
          return {
            service: service.name,
            status: 'unhealthy',
            error: error.message
          };
        }
      })
    );

    return healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    );
  }
}
```

## Service-to-Service Authentication

The platform uses API keys for secure service-to-service communication, managed through a centralized configuration system.

### Centralized API Key Management

All service API keys are managed through the `ServiceApiKeysConfig` class in the `@soc-compliance/auth-common` package:

```typescript
import { ServiceApiKeysConfig } from '@soc-compliance/auth-common';

// Get API key for a service
const apiKey = ServiceApiKeysConfig.getApiKey('evidence-service');

// Check if using default (development) key
const isDefault = ServiceApiKeysConfig.isUsingDefault('evidence-service');

// Validate an API key
const isValid = ServiceApiKeysConfig.validateApiKey('evidence-service', providedKey);
```

### Service Authentication Guard

Services can accept both user authentication (JWT) and service authentication (API key) using the `@ServiceAuth()` decorator:

```typescript
import { ServiceAuth } from '@soc-compliance/auth-common';

@Controller('evidence')
export class EvidenceController {
  @Get('insights/:organizationId')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  @ServiceAuth() // Allows both user JWT and service API key
  async getInsights(
    @Param('organizationId') organizationId: string,
    @Query('integrationId') integrationId?: string,
  ) {
    // This endpoint can be called by:
    // 1. Authenticated users with proper roles
    // 2. Other services using their API key
    return this.evidenceService.getInsights(organizationId, integrationId);
  }
}
```

### HTTP Client Service Authentication

The HTTP client automatically includes service API keys for inter-service communication:

```typescript
import { HttpClientService } from '@soc-compliance/http-common';

@Injectable()
export class WorkflowService {
  constructor(private httpClient: HttpClientService) {}

  async getEvidenceInsights(organizationId: string) {
    // The HTTP client automatically adds X-Service-API-Key header
    const response = await this.httpClient.get(
      `http://evidence-service:3005/evidence/insights/${organizationId}`,
      {},
      { name: 'evidence-service' } // Service config
    );
    
    return response.data;
  }
}
```

### Configuration

#### Development Environment
In development, services use default API keys that are automatically configured:
```bash
# .env.service-api-keys (auto-generated)
SERVICE_API_KEY_AUTH_SERVICE=dev-auth-service-api-key-2024
SERVICE_API_KEY_EVIDENCE_SERVICE=dev-evidence-service-api-key-2024
# ... other services
```

#### Production Environment
In production, API keys must be explicitly configured via environment variables:
```bash
# Production environment variables
SERVICE_API_KEY_AUTH_SERVICE=<secure-random-key>
SERVICE_API_KEY_EVIDENCE_SERVICE=<secure-random-key>
SERVICE_JWT_SECRET=<secure-jwt-secret>
```

### Security Headers

When services communicate, the following headers are used:
- `X-Service-Name`: The calling service's name
- `X-Service-API-Key`: The service's API key
- `X-Service-Token`: Alternative JWT token for service auth
- `X-Request-ID`: Unique request identifier for tracing

### Best Practices

1. **Never hardcode API keys** - Use environment variables or secrets management
2. **Rotate keys regularly** - Implement key rotation in production
3. **Use HTTPS in production** - Ensure encrypted communication
4. **Monitor API key usage** - Track which services are communicating
5. **Implement rate limiting** - Prevent abuse even between services

### Example: Complete Service-to-Service Flow

```typescript
// In workflow-service calling evidence-service
@Injectable()
export class WorkflowEvidenceService {
  constructor(
    private httpClient: HttpClientService,
    private logger: Logger,
  ) {}

  async checkEvidenceCompleteness(
    organizationId: string,
    workflowId: string
  ): Promise<boolean> {
    try {
      // Get evidence insights from evidence service
      const response = await this.httpClient.get<EvidenceInsights>(
        `http://evidence-service:3005/evidence/insights/${organizationId}`,
        {
          params: { workflowId }
        },
        {
          name: 'evidence-service',
          timeout: 10000,
          circuitBreaker: {
            errorThresholdPercentage: 50,
            resetTimeout: 30000
          }
        }
      );

      if (!response.success) {
        this.logger.error('Failed to get evidence insights', response.error);
        return false;
      }

      // Check completeness threshold
      return response.data.statistics.completeness >= 80;
    } catch (error) {
      this.logger.error('Error checking evidence completeness', error);
      return false;
    }
  }
}
```

## Summary

The event-driven architecture enables:
- **Decoupled services**: Services don't need to know about each other
- **Scalability**: Easy to add new services or scale existing ones
- **Resilience**: Services can handle temporary failures
- **Audit trail**: Complete history of all system events
- **Real-time updates**: Immediate propagation of changes

By following these patterns and conventions, the SOC Compliance Platform maintains a robust, scalable, and maintainable microservices architecture.

---

**Document Status**: Complete implementation guide for inter-service communication

## Next Steps

1. **Deploy All Services**: Get remaining 10 services deployed to Docker
2. **Test Event Flow**: Validate Kafka event publishing and consumption
3. **Kong Configuration**: Fix API Gateway routing and authentication
4. **Service Discovery**: Implement proper service registry
5. **Circuit Breakers**: Add resilience patterns for production
6. **Monitoring**: Instrument all inter-service calls with OpenTelemetry