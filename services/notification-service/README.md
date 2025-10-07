# Notification Service

[![Tests](https://img.shields.io/badge/tests-151%20tests-brightgreen)](./src)
[![Coverage](https://img.shields.io/badge/coverage-enterprise--grade-blue)]()
[![TypeScript](https://img.shields.io/badge/typescript-100%25-blue)](./tsconfig.json)
[![Enterprise](https://img.shields.io/badge/enterprise-ready-success)](./docs)

The Notification Service is a comprehensive, enterprise-grade microservice built with NestJS that handles multi-channel notifications across the SOC Compliance Platform. It provides reliable, scalable, and highly configurable notification delivery with advanced features like templating, user preferences, scheduling, and detailed analytics.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Channels & Providers](#channels--providers)
- [Templates & Personalization](#templates--personalization)
- [User Preferences](#user-preferences)
- [Notification Rules & History](#notification-rules--history)
- [Queue Processing](#queue-processing)
- [Monitoring & Analytics](#monitoring--analytics)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)

## Features

### Core Capabilities
- **Multi-Channel Support**: Email, SMS, Slack, Teams, In-App, Push Notifications, Webhooks
- **Advanced Templating**: Handlebars-based templates with variable substitution
- **User Preferences**: Granular notification preferences with Do Not Disturb and quiet hours
- **Smart Scheduling**: Schedule notifications for optimal delivery times
- **Notification Rules Engine**: Intelligent rule-based notification triggering with complete history tracking
- **Queue Processing**: Bull queue for reliable background processing
- **Retry Logic**: Intelligent retry mechanisms with exponential backoff
- **Delivery Tracking**: Comprehensive tracking of opens, clicks, bounces, and engagement
- **Batch Processing**: Efficient bulk notification handling

### Enterprise Features
- **Redis Caching**: High-performance caching with `@Cacheable` decorator
- **Kafka Integration**: Event-driven architecture for inter-service communication
- **Health Monitoring**: Comprehensive health checks for all dependencies
- **Observability**: OpenTelemetry integration with distributed tracing
- **Security**: JWT authentication, rate limiting, and input validation
- **Audit Logging**: Complete audit trail for all notification activities

### Analytics & Reporting
- **Delivery Analytics**: Real-time delivery rates and performance metrics
- **Engagement Tracking**: Open rates, click-through rates, and user engagement
- **Provider Analytics**: Per-provider performance and reliability metrics
- **Rule History Analytics**: Complete history tracking for notification rules with performance metrics
- **MetricsService Integration**: Advanced metrics collection for rule evaluation and execution
- **Cost Optimization**: Channel cost analysis and optimization recommendations

## Architecture

```mermaid
graph TB
    subgraph "Notification Service"
        API[REST API Controller]
        Service[Notifications Service]
        Queue[Bull Queue Processor]
        Cache[Redis Cache]
        DB[(PostgreSQL)]
        
        API --> Service
        Service --> Queue
        Service --> Cache
        Service --> DB
        Queue --> Providers
        
        subgraph "Notification Providers"
            Email[Email Provider]
            SMS[SMS Provider]
            Slack[Slack Provider]
            Teams[Teams Provider]
            InApp[In-App Provider]
            Push[Push Provider]
            Webhook[Webhook Provider]
        end
        
        subgraph "Template System"
            Templates[Handlebars Templates]
            Variables[Variable Substitution]
            Validation[Template Validation]
        end
        
        subgraph "User Management"
            Preferences[User Preferences]
            DND[Do Not Disturb]
            Quiet[Quiet Hours]
        end
    end
    
    subgraph "External Services"
        SendGrid[SendGrid]
        Twilio[Twilio]
        SlackAPI[Slack API]
        TeamsAPI[Teams API]
        FCM[Firebase FCM]
    end
    
    Providers --> SendGrid
    Providers --> Twilio
    Providers --> SlackAPI
    Providers --> TeamsAPI
    Providers --> FCM
```

### Key Components

#### Entities
- **Notification**: Core notification entity with full lifecycle tracking
- **NotificationTemplate**: Handlebars-based template system
- **NotificationPreference**: User-specific notification preferences

#### Services
- **NotificationsService**: Core business logic and orchestration
- **NotificationTemplatesService**: Template management and rendering
- **NotificationPreferencesService**: User preference management
- **UserDataService**: User data enrichment and validation

#### Providers
- **EmailProvider**: SendGrid, SMTP, and custom email providers
- **SMSProvider**: Twilio and custom SMS providers
- **SlackProvider**: Slack Incoming Webhooks and Bot API
- **TeamsProvider**: Microsoft Teams Connector Cards
- **PushProvider**: Firebase Cloud Messaging for web and mobile
- **WebhookProvider**: Custom HTTP webhook delivery

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Bull Queue
- Kafka (for event publishing)

### Development Setup

1. **Install Dependencies**
   ```bash
   cd services/notification-service
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   npm run migration:run
   ```

4. **Start Redis & Dependencies**
   ```bash
   # Start Docker services
   docker-compose up -d postgres redis kafka
   ```

5. **Start Development Server**
   ```bash
   npm run start:dev
   ```

The service will be available at `http://localhost:3010`

### Docker Deployment

```dockerfile
# Build and run with Docker
docker build -t notification-service .
docker run -p 3010:3010 notification-service
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3010
NODE_ENV=development
SERVICE_NAME=notification-service

# Database
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_NAME=soc_notifications
DATABASE_USERNAME=soc_user
DATABASE_PASSWORD=soc_pass
DATABASE_SSL=false

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass

# Kafka
KAFKA_BROKER=127.0.0.1:9092
KAFKA_CLIENT_ID=notification-service

# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=notifications@yourcompany.com
SENDGRID_FROM_NAME=Your Company

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook

# Microsoft Teams
TEAMS_WEBHOOK_URL=https://outlook.office.com/your-webhook

# Firebase (Push)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account-email
```

### Service Configuration

```typescript
// config/configuration.ts
export default () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3010,
    env: process.env.NODE_ENV || 'development',
    name: 'notification-service',
  },
  database: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    name: process.env.DATABASE_NAME || 'soc_notifications',
    username: process.env.DATABASE_USERNAME || 'soc_user',
    password: process.env.DATABASE_PASSWORD || 'soc_pass',
    ssl: process.env.DATABASE_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },
  providers: {
    email: {
      default: 'sendgrid',
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        fromName: process.env.SENDGRID_FROM_NAME,
      },
    },
    sms: {
      default: 'twilio',
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      },
    },
  },
});
```

## API Documentation

### Core Endpoints

#### Create Notification
```http
POST /api/notifications
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "channel": "email",
  "type": "alert",
  "priority": "high",
  "category": "security",
  "recipient": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "content": {
    "subject": "Security Alert",
    "body": "Suspicious login attempt detected",
    "htmlBody": "<h1>Security Alert</h1><p>Suspicious login attempt detected</p>"
  },
  "scheduledFor": "2025-08-09T15:30:00Z",
  "templateId": "security-alert-template",
  "variables": {
    "userName": "John Doe",
    "ipAddress": "192.168.1.100",
    "location": "New York, NY"
  }
}
```

#### Bulk Create Notifications
```http
POST /api/notifications/bulk
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "notifications": [
    {
      "channel": "email",
      "type": "info",
      "recipient": { "id": "user1", "email": "user1@example.com" },
      "content": { "subject": "Update", "body": "System maintenance tonight" }
    },
    {
      "channel": "sms",
      "type": "alert",
      "recipient": { "id": "user2", "phone": "+1234567890" },
      "content": { "body": "Alert: Service disruption" }
    }
  ]
}
```

#### Query Notifications
```http
GET /api/notifications?status=sent&channel=email&limit=50&offset=0
Authorization: Bearer <jwt-token>
```

#### Get Notification Details
```http
GET /api/notifications/{id}
Authorization: Bearer <jwt-token>
```

#### Update Notification
```http
PUT /api/notifications/{id}
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "status": "cancelled",
  "scheduledFor": "2025-08-10T10:00:00Z"
}
```

### Template Management

#### Create Template
```http
POST /api/templates
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "name": "security-alert",
  "description": "Security alert notification template",
  "channel": "email",
  "type": "alert",
  "category": "security",
  "subject": "Security Alert - {{alertType}}",
  "body": "Hello {{userName}}, we detected a {{alertType}} from IP {{ipAddress}} at {{timestamp}}.",
  "htmlBody": "<h2>Security Alert</h2><p>Hello <strong>{{userName}}</strong>, we detected a <em>{{alertType}}</em> from IP <code>{{ipAddress}}</code> at {{timestamp}}.</p>",
  "variables": {
    "userName": { "type": "string", "required": true },
    "alertType": { "type": "string", "required": true },
    "ipAddress": { "type": "string", "required": true },
    "timestamp": { "type": "date", "required": true }
  },
  "isActive": true
}
```

### User Preferences

#### Get User Preferences
```http
GET /api/preferences/{userId}
Authorization: Bearer <jwt-token>
```

#### Update User Preferences
```http
PUT /api/preferences/{userId}
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "channels": {
    "email": {
      "enabled": true,
      "types": ["alert", "info", "reminder"],
      "quietHours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00",
        "timezone": "America/New_York"
      }
    },
    "sms": {
      "enabled": true,
      "types": ["alert", "urgent"],
      "emergencyOverride": true
    }
  },
  "doNotDisturb": {
    "enabled": false,
    "until": "2025-08-10T09:00:00Z"
  },
  "frequency": {
    "digestEnabled": true,
    "digestSchedule": "daily",
    "digestTime": "09:00"
  }
}
```

## Channels & Providers

### Email Provider

**Supported Providers**: SendGrid, SMTP, Custom

**Features**:
- HTML and plain text support
- Attachments
- Open and click tracking
- Bounce handling
- Unsubscribe management

```typescript
// Email notification example
{
  "channel": "email",
  "recipient": {
    "email": "user@example.com",
    "name": "John Doe"
  },
  "content": {
    "subject": "Welcome to SOC Platform",
    "body": "Welcome to our platform!",
    "htmlBody": "<h1>Welcome!</h1><p>Thanks for joining us.</p>",
    "attachments": [
      {
        "filename": "welcome-guide.pdf",
        "content": "base64-encoded-content",
        "contentType": "application/pdf"
      }
    ]
  }
}
```

### SMS Provider

**Supported Providers**: Twilio, Custom

**Features**:
- Global SMS delivery
- Delivery receipts
- Two-way messaging support
- Cost optimization

```typescript
// SMS notification example
{
  "channel": "sms",
  "recipient": {
    "phone": "+1234567890",
    "name": "John Doe"
  },
  "content": {
    "body": "Alert: Your account login from new device. Reply STOP to opt out."
  }
}
```

### Slack Provider

**Supported Methods**: Incoming Webhooks, Bot API, Interactive Messages

**Features**:
- Rich message formatting
- Interactive components
- File attachments
- Thread support

```typescript
// Slack notification example
{
  "channel": "slack",
  "recipient": {
    "slackUserId": "U1234567890",
    "name": "John Doe"
  },
  "content": {
    "body": "Security alert detected",
    "slackBlocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Security Alert*\nSuspicious activity detected on your account."
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "View Details" },
            "url": "https://platform.example.com/security/alerts/123"
          }
        ]
      }
    ]
  }
}
```

### Microsoft Teams Provider

**Features**:
- Adaptive Cards
- Actionable messages
- Rich formatting
- Integration with Teams workflows

### Push Notifications

**Supported Platforms**: Web (FCM), iOS (APNS via FCM), Android (FCM)

**Features**:
- Rich notifications with images
- Action buttons
- Badge updates
- Silent notifications

### Webhook Provider

**Features**:
- Custom HTTP endpoints
- Flexible payload formats
- Retry logic
- Authentication support

## Templates & Personalization

### Template System

The notification service uses **Handlebars** for powerful template rendering with variable substitution, conditionals, and helpers.

#### Basic Template
```handlebars
Hello {{userName}},

Your {{actionType}} was {{status}} at {{timestamp}}.

{{#if needsAction}}
Please take action by clicking: {{actionUrl}}
{{/if}}

Best regards,
The SOC Team
```

#### HTML Template
```handlebars
<!DOCTYPE html>
<html>
<head>
    <title>{{subject}}</title>
</head>
<body>
    <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #2c3e50;">{{title}}</h2>
        <p>Hello <strong>{{userName}}</strong>,</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #007bff;">
            {{description}}
        </div>
        
        {{#each items}}
        <div style="margin: 10px 0;">
            <strong>{{this.label}}:</strong> {{this.value}}
        </div>
        {{/each}}
        
        {{#if actionUrl}}
        <a href="{{actionUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Take Action
        </a>
        {{/if}}
    </div>
</body>
</html>
```

#### Custom Helpers

```typescript
// Register custom Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date, format: string) => {
  return moment(date).format(format);
});

Handlebars.registerHelper('currency', (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
});

// Usage in template
{{formatDate createdAt "MMMM Do YYYY, h:mm a"}}
{{currency amount "USD"}}
```

#### Variable Validation

```typescript
// Template variable schema
{
  "variables": {
    "userName": {
      "type": "string",
      "required": true,
      "maxLength": 100
    },
    "amount": {
      "type": "number",
      "required": true,
      "minimum": 0
    },
    "items": {
      "type": "array",
      "required": false,
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    }
  }
}
```

## User Preferences

### Preference Management

Users can configure detailed notification preferences including:

- **Channel Preferences**: Enable/disable specific channels
- **Type Filtering**: Choose which notification types to receive
- **Quiet Hours**: Set time windows to suppress non-urgent notifications
- **Do Not Disturb**: Temporary notification suppression
- **Frequency Controls**: Digest notifications and batching
- **Emergency Override**: Always receive critical notifications

### Implementation Example

```typescript
// User preference configuration
const preferences = {
  channels: {
    email: {
      enabled: true,
      types: ['alert', 'info', 'reminder', 'approval'],
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: 'America/New_York',
        allowUrgent: true
      }
    },
    sms: {
      enabled: true,
      types: ['alert', 'urgent'],
      emergencyOverride: true,
      quietHours: {
        enabled: false
      }
    },
    slack: {
      enabled: true,
      types: ['alert', 'assignment', 'mention'],
      workingHoursOnly: true
    },
    inApp: {
      enabled: true,
      types: ['info', 'reminder', 'approval', 'assignment'],
      showInactive: false
    }
  },
  doNotDisturb: {
    enabled: false,
    until: null,
    allowUrgent: true
  },
  frequency: {
    digestEnabled: true,
    digestSchedule: 'daily', // daily, weekly, monthly
    digestTime: '09:00',
    maxNotificationsPerHour: 10,
    groupSimilar: true
  },
  categories: {
    security: { priority: 'high', override: true },
    compliance: { priority: 'medium', override: false },
    system: { priority: 'low', override: false }
  }
};
```

## Notification Rules & History

### Intelligent Rule Engine

The notification service includes a sophisticated rule engine for automated notification triggering with comprehensive history tracking and metrics integration.

#### Rule-Based Notification Triggering
```typescript
// Example notification rule configuration
const notificationRule = {
  id: 'security-alert-rule',
  name: 'High Priority Security Alerts',
  description: 'Trigger notifications for critical security events',
  enabled: true,
  conditions: {
    eventType: 'security_incident',
    severity: ['high', 'critical'],
    source: ['auth-service', 'audit-service'],
    timeWindow: '5m'
  },
  actions: [
    {
      channel: 'email',
      template: 'security-alert-template',
      recipients: ['security-team@company.com'],
      priority: 'urgent'
    },
    {
      channel: 'slack',
      webhook: 'security-channel-webhook',
      template: 'slack-security-alert'
    }
  ],
  throttling: {
    enabled: true,
    maxTriggers: 5,
    timeWindow: '1h'
  }
};
```

#### Rule History Tracking

The service now includes comprehensive history tracking for all notification rules:

```typescript
// Get rule history with detailed metrics
const ruleHistory = await notificationRulesService.getRuleHistory(ruleId, {
  startDate: '2025-08-01T00:00:00Z',
  endDate: '2025-08-09T23:59:59Z',
  includeMetrics: true,
  includePerformance: true
});

// Returns comprehensive history data:
{
  ruleId: 'security-alert-rule',
  ruleName: 'High Priority Security Alerts',
  period: {
    start: '2025-08-01T00:00:00Z',
    end: '2025-08-09T23:59:59Z'
  },
  summary: {
    totalTriggers: 47,
    successfulNotifications: 45,
    failedNotifications: 2,
    throttledTriggers: 8,
    averageProcessingTime: 1.2
  },
  history: [
    {
      timestamp: '2025-08-09T10:15:00Z',
      triggerId: 'trigger-uuid',
      event: {
        type: 'security_incident',
        severity: 'high',
        source: 'auth-service',
        data: { userId: 'user-123', action: 'suspicious_login' }
      },
      conditionsMatched: [
        'eventType === security_incident',
        'severity === high',
        'source === auth-service'
      ],
      actions: [
        {
          channel: 'email',
          status: 'sent',
          recipients: 2,
          processingTime: 0.8,
          deliveryTime: 2.3
        },
        {
          channel: 'slack',
          status: 'sent',
          processingTime: 0.4,
          deliveryTime: 1.1
        }
      ],
      metrics: {
        evaluationTime: 0.05,
        totalProcessingTime: 1.2,
        memoryUsage: '2.1MB',
        success: true
      }
    }
  ],
  performance: {
    averageEvaluationTime: 0.08,
    averageProcessingTime: 1.15,
    successRate: 0.957,
    p95ProcessingTime: 2.1,
    p99ProcessingTime: 3.8
  },
  usage: {
    peakTriggersPerHour: 12,
    averageTriggersPerDay: 5.2,
    mostActiveHours: ['09:00-10:00', '14:00-15:00'],
    channelBreakdown: {
      email: { count: 45, successRate: 0.978 },
      slack: { count: 45, successRate: 0.933 }
    }
  },
  changes: [
    {
      timestamp: '2025-08-05T14:30:00Z',
      type: 'rule_updated',
      field: 'throttling.maxTriggers',
      oldValue: 3,
      newValue: 5,
      updatedBy: 'admin-user-id',
      reason: 'Increased throttling limit due to high incident volume'
    },
    {
      timestamp: '2025-08-03T09:15:00Z',
      type: 'rule_cloned',
      sourceRuleId: 'original-rule-id',
      clonedBy: 'security-admin',
      modifications: ['conditions.severity', 'actions.recipients']
    }
  ]
}
```

### API Endpoints for Rule Management

#### Get Rule History
```http
GET /api/notification-rules/{ruleId}/history?startDate=2025-08-01&endDate=2025-08-09&includeMetrics=true
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "ruleId": "rule-uuid",
  "ruleName": "Security Alert Rule",
  "totalTriggers": 47,
  "successfulNotifications": 45,
  "failedNotifications": 2,
  "history": [...],
  "performance": {...},
  "usage": {...}
}
```

#### Clone Notification Rule
```http
POST /api/notification-rules/{ruleId}/clone
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "name": "Cloned Security Alert Rule",
  "description": "Modified version of the original security rule",
  "modifications": {
    "conditions.severity": ["critical"],
    "actions[0].recipients": ["critical-alerts@company.com"]
  },
  "enabled": false
}
```

### MetricsService Integration

The service integrates with a comprehensive MetricsService for advanced analytics:

#### Real-Time Metrics Collection
```typescript
// Metrics are automatically collected during rule evaluation
const ruleEvaluation = await this.ruleEvaluationService.evaluateRule(rule, event);

// MetricsService automatically tracks:
// - Rule evaluation time
// - Notification delivery success/failure rates
// - Channel performance metrics
// - Resource usage (memory, CPU)
// - Queue processing times
// - Error rates and types

// Metrics can be queried for dashboards and reporting
const metrics = await this.metricsService.getRuleMetrics(ruleId, {
  period: '24h',
  granularity: 'hourly',
  includeBreakdown: true
});
```

#### Advanced Analytics
```typescript
// Performance analytics for rule optimization
const performanceAnalysis = await this.metricsService.analyzeRulePerformance(ruleId);
// Returns:
{
  optimization: {
    recommendations: [
      {
        type: 'condition_order',
        impact: 'medium',
        description: 'Reorder conditions to evaluate faster checks first',
        estimatedImprovement: '15% faster evaluation'
      },
      {
        type: 'throttling_adjustment',
        impact: 'high',
        description: 'Current throttling may be too restrictive',
        estimatedImprovement: '8% more notifications delivered'
      }
    ]
  },
  trends: {
    evaluationTime: 'stable',
    successRate: 'improving',
    triggerFrequency: 'increasing'
  },
  benchmarks: {
    performanceTier: 'excellent',
    similarRulesComparison: '+23% faster than average',
    industryBenchmark: 'top 10%'
  }
}
```

### Rule History Features

#### Complete Audit Trail
- **Rule Creation**: Track when rules are created and by whom
- **Rule Updates**: Log all modifications with before/after values
- **Rule Cloning**: Track cloned rules and their modifications
- **Rule Execution**: Record every trigger and its outcome
- **Performance Metrics**: Detailed timing and resource usage data

#### Advanced Analytics
- **Success Rate Trends**: Track notification delivery success over time
- **Performance Optimization**: Identify slow-performing rules
- **Usage Patterns**: Understand peak usage and channel preferences
- **Error Analysis**: Detailed failure analysis and resolution tracking

#### Compliance & Reporting
- **Regulatory Compliance**: Complete audit trail for compliance reporting
- **SLA Monitoring**: Track service level agreement compliance
- **Cost Analysis**: Monitor costs per rule and channel
- **Capacity Planning**: Historical data for infrastructure planning

## Queue Processing

### Bull Queue Configuration

The service uses **Bull Queue** for reliable background processing with Redis:

```typescript
// Queue configuration
{
  redis: {
    host: 'redis-host',
    port: 6379,
    password: 'redis-password'
  },
  defaultJobOptions: {
    removeOnComplete: 100,    // Keep last 100 completed jobs
    removeOnFail: 50,         // Keep last 50 failed jobs
    attempts: 3,              // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000,            // Start with 2 second delay
    }
  }
}
```

### Job Processing

```typescript
// Queue processor
@Processor('notifications')
export class NotificationQueueProcessor {
  @Process('send-notification')
  async handleNotification(job: Job<SendNotificationJobData>) {
    const { notificationId, channel } = job.data;
    
    try {
      // Get provider for channel
      const provider = this.providerRegistry.getProvider(channel);
      
      // Send notification
      const result = await provider.send(job.data);
      
      // Update notification status
      await this.updateNotificationStatus(notificationId, 'sent', result);
      
      return result;
    } catch (error) {
      // Log error and update status
      this.logger.error(`Failed to send notification ${notificationId}`, error);
      await this.updateNotificationStatus(notificationId, 'failed', error.message);
      throw error;
    }
  }
  
  @Process('send-bulk')
  async handleBulkNotifications(job: Job<BulkNotificationJobData>) {
    const { notifications } = job.data;
    const results = [];
    
    for (const notification of notifications) {
      try {
        const result = await this.sendSingleNotification(notification);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }
}
```

## Monitoring & Analytics

### Delivery Analytics

Track comprehensive metrics for notification performance:

```typescript
interface NotificationMetrics {
  deliveryRate: number;        // % of notifications successfully delivered
  openRate: number;           // % of delivered notifications opened
  clickRate: number;          // % of opened notifications clicked
  bounceRate: number;         // % of notifications bounced
  unsubscribeRate: number;    // % of notifications leading to unsubscribe
  avgDeliveryTime: number;    // Average time to delivery in ms
  providerReliability: {      // Per-provider metrics
    [provider: string]: {
      deliveryRate: number;
      avgResponseTime: number;
      errorRate: number;
    };
  };
}
```

### Health Monitoring

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.kafka.pingCheck('kafka'),
      () => this.queue.isHealthy('notification-queue'),
    ]);
  }
}
```

### Performance Monitoring

The service includes comprehensive observability:

- **Distributed Tracing**: OpenTelemetry integration
- **Metrics Collection**: Prometheus metrics
- **Error Tracking**: Structured error logging
- **Performance Monitoring**: Response time and throughput tracking

## Testing

### Test Suite Overview

The notification service includes **151 comprehensive tests** across 9 test files:

- **Unit Tests**: 89 tests covering core business logic
- **Integration Tests**: 41 tests for database and Redis operations
- **Provider Tests**: 21 tests for notification providers

### Test Infrastructure

#### TypeORM Mock Setup
```typescript
// __mocks__/typeorm.ts
export const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
};
```

#### Redis Cache Mock
```typescript
// __mocks__/ioredis.ts
export class Redis {
  get = jest.fn();
  set = jest.fn();
  del = jest.fn();
  exists = jest.fn();
  expire = jest.fn();
  ttl = jest.fn();
  ping = jest.fn().mockResolvedValue('PONG');
  disconnect = jest.fn();
}
```

#### Provider Mocks
```typescript
// __mocks__/twilio.ts
export const mockTwilio = {
  messages: {
    create: jest.fn(),
  },
};

// __mocks__/@slack/web-api.ts
export class WebClient {
  chat = {
    postMessage: jest.fn(),
  };
  
  constructor(token?: string) {}
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run integration tests
npm run test:integration

# Run specific test file
npm test -- notifications.service.spec.ts

# Run tests in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

### Test Examples

#### Unit Test
```typescript
describe('NotificationsService', () => {
  it('should create a notification with template', async () => {
    // Arrange
    const createDto = {
      channel: NotificationChannel.EMAIL,
      type: NotificationType.ALERT,
      templateId: 'template-id',
      recipient: { id: 'user-id', email: 'user@example.com' },
      variables: { userName: 'John Doe' }
    };

    mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);
    mockNotificationRepository.save.mockResolvedValue(mockNotification);

    // Act
    const result = await service.create('org-id', createDto, 'creator-id');

    // Assert
    expect(result).toBeDefined();
    expect(mockTemplateRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'template-id', organizationId: 'org-id', isActive: true }
    });
  });
});
```

#### Integration Test
```typescript
describe('Database Integration', () => {
  it('should persist notification with all relationships', async () => {
    const notification = await notificationRepository.save({
      organizationId: 'test-org',
      channel: NotificationChannel.EMAIL,
      type: NotificationType.ALERT,
      recipient: { id: 'user-id', email: 'test@example.com' },
      content: { subject: 'Test', body: 'Test message' },
      createdBy: 'system'
    });

    const saved = await notificationRepository.findOne({
      where: { id: notification.id }
    });

    expect(saved).toBeDefined();
    expect(saved.organizationId).toBe('test-org');
  });
});
```

## Production Deployment

### Docker Configuration

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package.json ./

USER nestjs

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3010/health || exit 1

CMD ["node", "dist/main"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-service
  template:
    metadata:
      labels:
        app: notification-service
    spec:
      containers:
      - name: notification-service
        image: notification-service:latest
        ports:
        - containerPort: 3010
        env:
        - name: DATABASE_HOST
          value: "postgres-service"
        - name: REDIS_HOST
          value: "redis-service"
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
            port: 3010
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3010
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Production Checklist

#### Security
- [ ] JWT authentication configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] CORS properly configured
- [ ] Secrets management implemented
- [ ] TLS/SSL certificates installed

#### Performance
- [ ] Redis caching configured
- [ ] Database connection pooling
- [ ] Queue processing optimized
- [ ] Memory usage monitored
- [ ] CPU usage monitored

#### Reliability
- [ ] Health checks configured
- [ ] Error monitoring setup
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan
- [ ] Load balancing configured

#### Monitoring
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards configured
- [ ] Log aggregation setup
- [ ] Alert rules configured
- [ ] Distributed tracing enabled

## Contributing

### Development Guidelines

1. **Code Style**: Follow the existing TypeScript/NestJS patterns
2. **Testing**: Maintain 100% test coverage for new features
3. **Documentation**: Update documentation for API changes
4. **Type Safety**: Zero tolerance for `any` types in production code
5. **Performance**: Consider caching and optimization impact

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with comprehensive tests
3. Update documentation
4. Ensure all tests pass: `npm test`
5. Run linting: `npm run lint:fix`
6. Submit pull request with detailed description

### Adding New Providers

1. Implement `NotificationProvider` interface
2. Add provider to `ProvidersModule`
3. Create comprehensive tests
4. Update documentation
5. Add configuration options

```typescript
// Example provider implementation
@Injectable()
export class CustomProvider implements NotificationProvider {
  async send(notification: NotificationData): Promise<SendResult> {
    // Implementation
  }
  
  async getStatus(messageId: string): Promise<DeliveryStatus> {
    // Implementation
  }
  
  getCapabilities(): ProviderCapabilities {
    return {
      channels: [NotificationChannel.CUSTOM],
      features: ['tracking', 'scheduling'],
      maxBatchSize: 100,
    };
  }
}
```

## License

This project is proprietary software. All rights reserved.

---

For additional support or questions, contact the SOC Compliance Platform team.