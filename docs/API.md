# SOC Compliance Platform - API Reference

## API Overview

Base URLs:
- Development: `http://localhost:{service-port}/api/v1`
- Production: `https://api.soc-compliance.com/api/v1`

All API requests require authentication unless marked as public.

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "access_token": "eyJhbGciOiJ...",
  "refresh_token": "eyJhbGciOiJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "roles": ["admin"],
    "tenantId": "org-uuid"
  }
}
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp"
}
```

### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJ..."
}
```

### Headers
All authenticated requests must include:
```http
Authorization: Bearer eyJhbGciOiJ...
```

## Client Service API

### List Clients
```http
GET /clients
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20)
  - search: string
  - status: active|inactive|pending

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "Client Name",
      "status": "active",
      "contactEmail": "contact@client.com",
      "createdAt": "2025-01-24T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Create Client
```http
POST /clients
Content-Type: application/json

{
  "name": "New Client",
  "contactEmail": "contact@newclient.com",
  "contactPhone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "industry": "Technology",
  "size": "medium"
}
```

### Get Client
```http
GET /clients/{id}

Response:
{
  "id": "uuid",
  "name": "Client Name",
  "status": "active",
  "contactEmail": "contact@client.com",
  "contracts": [...],
  "audits": [...],
  "createdAt": "2025-01-24T10:00:00Z"
}
```

### Update Client
```http
PATCH /clients/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "inactive"
}
```

## Control Service API 

**Status**: In Development - 147/201 tests passing (73% pass rate)  
**Breaking Changes**: See [Migration Guide](CONTROL_SERVICE_MIGRATION_GUIDE.md)

### ⚠️ API Changes - January 9, 2025
- `getFrameworkCoverage` response field renamed: `coveragePercentage` → `coverage`
- `remove` method now returns the retired Control object instead of void

### List Controls
```http
GET /controls
Query Parameters:
  - framework: SOC2|SOC1|ISO27001|NIST|HIPAA|PCI|GDPR
  - category: string
  - status: implemented|partial|not_implemented
  - automationLevel: MANUAL|SEMI_AUTOMATED|AUTOMATED|FULLY_AUTOMATED
  - riskLevel: LOW|MEDIUM|HIGH|CRITICAL

Response:
{
  "data": [
    {
      "id": "uuid",
      "code": "CC6.1",
      "title": "Logical Access Controls",
      "description": "...",
      "framework": "SOC2",
      "category": "Access Control",
      "status": "implemented",
      "automationLevel": "SEMI_AUTOMATED",
      "riskLevel": "HIGH",
      "lastTested": "2024-12-15T10:00:00Z",
      "effectiveness": "85%",
      "costAnalysis": {
        "implementationCost": 15000,
        "annualMaintenanceCost": 3000,
        "roi": "120%"
      }
    }
  ],
  "meta": {
    "total": 150,
    "implemented": 120,
    "partial": 25,
    "notImplemented": 5,
    "averageEffectiveness": "82%"
  }
}
```

### Get Control Metrics (NEW - Enterprise Analytics)
```http
GET /controls/{id}/metrics

Response:
{
  "controlId": "uuid",
  "effectiveness": 85.5,
  "testingFrequency": "monthly",
  "lastTestDate": "2024-12-15T10:00:00Z",
  "riskScore": 7.2,
  "complianceScore": 92.3,
  "costAnalysis": {
    "implementationCost": 15000,
    "annualMaintenanceCost": 3000,
    "roi": 120.5,
    "costPerIncident": 500
  },
  "predictiveAnalytics": {
    "failureRisk": 12.5,
    "recommendedActions": [
      "Increase testing frequency",
      "Update control procedures"
    ],
    "trendAnalysis": "improving"
  }
}
```

### Get Framework Coverage (UPDATED)
```http
GET /controls/framework-coverage/{framework}/{organizationId}

Response:
{
  "framework": "SOC2",
  "totalControls": 100,
  "implementedControls": 73,
  "coverage": 73.0  // ⚠️ CHANGED from coveragePercentage
}
```

### Remove Control (UPDATED)
```http
DELETE /controls/{id}

Response: 200 OK
{
  "id": "uuid",
  "code": "CC6.1",
  "name": "Logical Access Controls",
  "status": "RETIRED",  // ⚠️ NOW RETURNS the retired control
  "updatedAt": "2025-01-09T10:00:00Z"
}
```

### Get Executive Dashboard (NEW - C-Suite Analytics)
```http
GET /controls/executive-dashboard

Response:
{
  "overview": {
    "totalControls": 150,
    "implementedControls": 120,
    "complianceScore": 87.5,
    "riskScore": 6.8,
    "lastAuditScore": 92.3
  },
  "frameworks": {
    "SOC2": { "compliance": 95.2, "controls": 45, "implemented": 43 },
    "ISO27001": { "compliance": 88.7, "controls": 35, "implemented": 31 },
    "HIPAA": { "compliance": 91.4, "controls": 25, "implemented": 23 }
  },
  "trends": {
    "complianceImprovement": 5.2,
    "riskReduction": -15.3,
    "costOptimization": 12.8
  },
  "alerts": [
    {
      "severity": "HIGH",
      "message": "3 critical controls require immediate attention",
      "controlIds": ["uuid1", "uuid2", "uuid3"]
    }
  ]
}
```

### Generate Framework Certification Package (NEW)
```http
POST /controls/certification-package
Content-Type: application/json

{
  "framework": "SOC2",
  "includeEvidence": true,
  "includeMetrics": true,
  "format": "pdf|excel|json"
}

Response:
{
  "packageId": "uuid",
  "downloadUrl": "https://...",
  "generatedAt": "2025-01-24T10:00:00Z",
  "validUntil": "2025-02-24T10:00:00Z",
  "contents": {
    "controls": 45,
    "evidence": 156,
    "testResults": 89,
    "metrics": true
  }
}
```

### Predictive Risk Analysis (NEW - ML-Powered)
```http
GET /controls/risk-analysis
Query Parameters:
  - timeframe: 30|60|90|365 (days)
  - framework: SOC2|ISO27001|etc

Response:
{
  "riskScore": 6.8,
  "trendDirection": "decreasing",
  "predictions": {
    "30days": {
      "riskScore": 6.2,
      "confidence": 87.5,
      "controlsAtRisk": 3
    },
    "90days": {
      "riskScore": 5.8,
      "confidence": 72.1,
      "controlsAtRisk": 2
    }
  },
  "recommendations": [
    {
      "priority": "HIGH",
      "action": "Implement automated monitoring for CC6.1",
      "expectedImpact": "15% risk reduction",
      "estimatedCost": 8000,
      "timeline": "2-4 weeks"
    }
  ],
  "benchmarking": {
    "industryAverage": 7.2,
    "bestInClass": 4.1,
    "yourRanking": "75th percentile"
  }
}
```

### Create Control Test
```http
POST /control-tests
Content-Type: application/json

{
  "controlId": "uuid",
  "testName": "Quarterly Access Review",
  "testType": "manual|automated|hybrid",
  "frequency": "daily|weekly|monthly|quarterly|annually",
  "assignedTo": "user-uuid",
  "dueDate": "2025-03-31",
  "automationLevel": "SEMI_AUTOMATED",
  "estimatedEffort": 4.5,
  "requiredEvidence": ["evidence-template-uuid"],
  "riskImpact": "HIGH"
}
```

### Submit Test Result
```http
POST /control-tests/{id}/results
Content-Type: application/json

{
  "status": "passed|failed|partial|not_tested",
  "effectivenessScore": 85.5,
  "notes": "Test observations...",
  "evidence": ["evidence-uuid-1", "evidence-uuid-2"],
  "testingMethod": "manual|automated|hybrid",
  "timeSpent": 3.5,
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "Finding description",
      "recommendation": "Remediation steps",
      "estimatedCost": 5000,
      "timeline": "2-4 weeks"
    }
  ],
  "metrics": {
    "complianceScore": 92.3,
    "riskReduction": 15.2,
    "costImpact": -2500
  }
}
```

### Get Control Test Analytics (NEW)
```http
GET /control-tests/analytics
Query Parameters:
  - framework: SOC2|ISO27001|etc
  - dateFrom: ISO8601
  - dateTo: ISO8601

Response:
{
  "summary": {
    "totalTests": 245,
    "passed": 205,
    "failed": 28,
    "partial": 12,
    "averageScore": 87.3,
    "trendDirection": "improving"
  },
  "byFramework": {
    "SOC2": { "tests": 89, "passRate": 94.2, "avgScore": 91.5 },
    "ISO27001": { "tests": 67, "passRate": 88.1, "avgScore": 85.7 }
  },
  "costAnalysis": {
    "totalCost": 125000,
    "costPerTest": 510,
    "roi": 145.2,
    "costSavings": 28000
  },
  "performanceTrends": [
    { "month": "2024-12", "passRate": 89.2, "avgScore": 86.1 },
    { "month": "2025-01", "passRate": 91.5, "avgScore": 87.3 }
  ]
}
```

## Evidence Service API ⭐ ENTERPRISE QUALITY

**Achievement**: Zero production `as any` bypasses, enterprise TypeScript quality

### ComplianceFramework Enum Values
Supported compliance frameworks:
- `SOC2` - SOC 2 Type II
- `SOC1` - SOC 1 Type II
- `ISO27001` - ISO 27001:2013
- `HIPAA` - Health Insurance Portability and Accountability Act
- `PCI` - Payment Card Industry Data Security Standard
- `CUSTOM` - Custom compliance framework

### TemplateField Interface
Evidence template fields support the following structure:
```typescript
interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'file' | 'select';
  required: boolean;
  description?: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}
```

### Create Evidence Template
```http
POST /evidence/templates
Content-Type: application/json

{
  "name": "SOC 2 Access Review Template",
  "description": "Template for quarterly access reviews",
  "category": "DOCUMENTATION",
  "complianceFramework": "SOC2",
  "fields": [
    {
      "name": "reviewDate",
      "type": "date",
      "required": true,
      "description": "Date when access review was performed"
    },
    {
      "name": "reviewedBy",
      "type": "text",
      "required": true,
      "description": "Name of person who performed the review"
    }
  ],
  "complianceMapping": {
    "soc2": true,
    "soc1": false,
    "iso27001": true,
    "hipaa": false,
    "pci": false,
    "custom": false
  }
}
```

### List Evidence Templates
```http
GET /evidence/templates
Query Parameters:
  - complianceFramework: SOC2|SOC1|ISO27001|HIPAA|PCI|CUSTOM
  - category: string
  - isActive: boolean

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "SOC 2 Access Review Template",
      "complianceFramework": "SOC2",
      "category": "DOCUMENTATION",
      "fields": [TemplateField[]],
      "complianceMapping": {
        "soc2": true,
        "iso27001": true
      },
      "isActive": true,
      "version": 1
    }
  ]
}
```

### Upload Evidence
```http
POST /evidence/upload
Content-Type: multipart/form-data

FormData:
  - file: binary
  - metadata: {
      "title": "Q4 Access Review",
      "description": "Quarterly user access review",
      "controlIds": ["control-uuid-1", "control-uuid-2"],
      "tags": ["access-review", "q4-2024"],
      "complianceFramework": "SOC2",
      "templateId": "template-uuid" // Optional: use evidence template
    }

Response:
{
  "id": "uuid",
  "filename": "q4-access-review.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "uploadedBy": "user-uuid",
  "uploadedAt": "2025-01-24T10:00:00Z"
}
```

### List Evidence
```http
GET /evidence
Query Parameters:
  - controlId: uuid
  - tags: comma-separated
  - dateFrom: ISO8601
  - dateTo: ISO8601

Response:
{
  "data": [
    {
      "id": "uuid",
      "title": "Q4 Access Review",
      "filename": "q4-access-review.pdf",
      "controls": ["CC6.1", "CC6.2"],
      "status": "approved",
      "uploadedAt": "2025-01-24T10:00:00Z"
    }
  ]
}
```

### Download Evidence
```http
GET /evidence/{id}/download

Response: Binary file stream
```

### Get Evidence Insights
```http
GET /evidence/insights/{organizationId}
Query Parameters:
  - integrationId: string (optional) - Filter insights by specific integration

Response:
{
  "organizationId": "uuid",
  "integrationId": "integration-name", // Only if integrationId was provided
  "statistics": {
    "total": 150,
    "byStatus": {
      "collected": 80,
      "approved": 50,
      "rejected": 10,
      "expired": 10
    },
    "byType": {
      "document": 60,
      "screenshot": 40,
      "log_file": 30,
      "report": 20
    },
    "expiringSoon": 5,
    "needsReview": 15,
    "averageQualityScore": 85.5,
    "completeness": 78
  },
  "collectionTrends": {
    "daily": [
      {
        "date": "2025-01-24",
        "count": 12,
        "byType": {
          "document": 5,
          "screenshot": 4,
          "log_file": 3
        }
      },
      // ... 6 more days
    ]
  },
  "qualityMetrics": {
    "averageQualityScore": 85.5,
    "needsReview": 15,
    "expiringSoon": 5,
    "completeness": 78
  },
  "integrationSpecific": {  // Only present if integrationId was provided
    "totalCollected": 45,
    "successRate": 92.5,
    "averageProcessingTime": 24.5,  // hours
    "lastCollectionDate": "2025-01-24T15:30:00Z",
    "collectionsByStatus": {
      "approved": 40,
      "rejected": 3,
      "pending": 2
    },
    "recentErrors": [
      {
        "date": "2025-01-23T10:15:00Z",
        "error": "Connection timeout"
      }
    ]
  }
}
```

**Note**: This endpoint supports both user authentication (via Bearer token) and service-to-service authentication (via X-Service-API-Key header).

## Policy Service API

### List Policies
```http
GET /policies
Query Parameters:
  - category: security|privacy|compliance
  - status: draft|published|archived

Response:
{
  "data": [
    {
      "id": "uuid",
      "title": "Information Security Policy",
      "version": "2.0",
      "status": "published",
      "effectiveDate": "2025-01-01",
      "nextReviewDate": "2026-01-01"
    }
  ]
}
```

### Create Policy
```http
POST /policies
Content-Type: application/json

{
  "title": "Data Retention Policy",
  "category": "privacy",
  "content": "Policy content in markdown...",
  "effectiveDate": "2025-02-01",
  "reviewPeriod": "annual",
  "approvers": ["user-uuid-1", "user-uuid-2"]
}
```

### Approve Policy
```http
POST /policies/{id}/approve
Content-Type: application/json

{
  "comments": "Approved with minor suggestions",
  "signature": "digital-signature-data"
}
```

## Reporting Service API

### Generate Report
```http
POST /reports/generate
Content-Type: application/json

{
  "type": "SOC2_Type2",
  "period": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  },
  "sections": ["controls", "tests", "findings", "management_response"],
  "format": "pdf|docx|html"
}

Response:
{
  "id": "uuid",
  "status": "processing",
  "estimatedTime": 300,
  "webhookUrl": "https://api.soc-compliance.com/reports/uuid/status"
}
```

### Download Report
```http
GET /reports/{id}/download

Response: Binary file stream
```

### Report Status
```http
GET /reports/{id}/status

Response:
{
  "id": "uuid",
  "status": "completed|processing|failed",
  "progress": 75,
  "downloadUrl": "/reports/uuid/download",
  "expiresAt": "2025-01-25T10:00:00Z"
}
```

## Notification Service API

### WebSocket Connection
```javascript
const socket = io('wss://api.soc-compliance.com', {
  auth: {
    token: 'Bearer eyJhbGciOiJ...'
  }
});

// Subscribe to events
socket.on('control.tested', (data) => {
  console.log('Control test completed:', data);
});

socket.on('evidence.uploaded', (data) => {
  console.log('New evidence:', data);
});
```

### List Notifications
```http
GET /notifications
Query Parameters:
  - unread: boolean
  - type: string
  - limit: number

Response:
{
  "data": [
    {
      "id": "uuid",
      "type": "control_test_due",
      "title": "Control Test Due Soon",
      "message": "CC6.1 test due in 3 days",
      "read": false,
      "createdAt": "2025-01-24T10:00:00Z"
    }
  ]
}
```

### Mark as Read
```http
PATCH /notifications/{id}/read
```

### Notification Rules Management

#### Get Rule History
```http
GET /notification-rules/{ruleId}/history
Query Parameters:
  - startDate: string (ISO 8601)
  - endDate: string (ISO 8601) 
  - includeMetrics: boolean
  - includePerformance: boolean
  - limit: number
  - offset: number

Response:
{
  "ruleId": "rule-uuid",
  "ruleName": "Security Alert Rule",
  "period": {
    "start": "2025-08-01T00:00:00Z",
    "end": "2025-08-09T23:59:59Z"
  },
  "summary": {
    "totalTriggers": 47,
    "successfulNotifications": 45,
    "failedNotifications": 2,
    "throttledTriggers": 8,
    "averageProcessingTime": 1.2
  },
  "history": [
    {
      "timestamp": "2025-08-09T10:15:00Z",
      "triggerId": "trigger-uuid",
      "event": {
        "type": "security_incident",
        "severity": "high",
        "source": "auth-service",
        "data": { "userId": "user-123" }
      },
      "conditionsMatched": ["eventType === security_incident"],
      "actions": [
        {
          "channel": "email",
          "status": "sent",
          "recipients": 2,
          "processingTime": 0.8,
          "deliveryTime": 2.3
        }
      ],
      "metrics": {
        "evaluationTime": 0.05,
        "totalProcessingTime": 1.2,
        "success": true
      }
    }
  ],
  "performance": {
    "averageEvaluationTime": 0.08,
    "averageProcessingTime": 1.15,
    "successRate": 0.957,
    "p95ProcessingTime": 2.1
  },
  "usage": {
    "peakTriggersPerHour": 12,
    "averageTriggersPerDay": 5.2,
    "channelBreakdown": {
      "email": { "count": 45, "successRate": 0.978 },
      "slack": { "count": 45, "successRate": 0.933 }
    }
  },
  "changes": [
    {
      "timestamp": "2025-08-05T14:30:00Z",
      "type": "rule_updated",
      "field": "throttling.maxTriggers",
      "oldValue": 3,
      "newValue": 5,
      "updatedBy": "admin-user-id"
    }
  ]
}
```

#### Clone Notification Rule
```http
POST /notification-rules/{ruleId}/clone
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

Response:
{
  "success": true,
  "data": {
    "ruleId": "new-rule-uuid",
    "name": "Cloned Security Alert Rule",
    "sourceRuleId": "original-rule-uuid",
    "enabled": false,
    "createdAt": "2025-08-09T15:30:00Z",
    "createdBy": "user-uuid"
  }
}
```

#### Get Rule Metrics
```http
GET /notification-rules/{ruleId}/metrics
Query Parameters:
  - period: string (1h, 24h, 7d, 30d)
  - granularity: string (hourly, daily, weekly)
  - includeBreakdown: boolean

Response:
{
  "ruleId": "rule-uuid",
  "period": "24h",
  "granularity": "hourly",
  "metrics": {
    "triggers": {
      "total": 24,
      "successful": 22,
      "failed": 2,
      "throttled": 3
    },
    "performance": {
      "averageEvaluationTime": 0.08,
      "averageProcessingTime": 1.15,
      "p95ProcessingTime": 2.1
    },
    "channels": {
      "email": {
        "notifications": 22,
        "successRate": 0.95,
        "averageDeliveryTime": 2.3
      },
      "slack": {
        "notifications": 22,
        "successRate": 0.91,
        "averageDeliveryTime": 1.1
      }
    }
  },
  "timeSeries": [
    {
      "timestamp": "2025-08-09T00:00:00Z",
      "triggers": 3,
      "successful": 3,
      "avgProcessingTime": 1.0
    }
  ]
}
```

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-24T10:00:00Z",
    "version": "1.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2025-01-24T10:00:00Z",
    "requestId": "req-uuid"
  }
}
```

### Pagination
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Rate Limits

| Endpoint Type | Rate Limit | Window |
|--------------|------------|---------|
| Authentication | 5 requests | 15 minutes |
| Read Operations | 100 requests | 1 minute |
| Write Operations | 30 requests | 1 minute |
| File Uploads | 10 requests | 5 minutes |
| Report Generation | 5 requests | 1 hour |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706174400
```

## Status Codes

| Code | Description | Usage |
|------|-------------|--------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## API Versioning

The API uses URL versioning:
- Current: `/api/v1/`
- Previous: `/api/v0/` (deprecated)

Version sunset notice provided 6 months in advance via:
- `Sunset` HTTP header
- API response warnings
- Email notifications

## Inter-Service Communication (UPDATED - July 31, 2025)

### Event-Driven Architecture

Services communicate asynchronously via Kafka events following a consistent naming pattern:

#### Event Naming Convention
```
Pattern: service.entity.action
Examples:
- auth.user.created
- client.organization.updated
- policy.control.mapped
- evidence.document.uploaded
```

#### Common Event Contracts

##### Organization Created Event
```typescript
// Event: client.organization.created
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

##### User Created Event
```typescript
// Event: auth.user.created
interface UserCreatedEvent {
  userId: string;
  email: string;
  organizationId: string;
  roles: string[];
  timestamp: Date;
  metadata?: {
    source: string;
    invitedBy?: string;
  };
}
```

##### Policy Updated Event
```typescript
// Event: policy.policy.updated
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

##### Control Test Completed Event
```typescript
// Event: control.test.completed
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

### Service Discovery

Services register with Kong Gateway and are accessible via standardized endpoints:

```
# Internal service URLs (through Kong)
http://kong:8000/auth/api/v1/...
http://kong:8000/client/api/v1/...
http://kong:8000/policy/api/v1/...

# Direct service URLs (development only)
http://auth-service:3001/api/v1/...
http://client-service:3002/api/v1/...
http://policy-service:3003/api/v1/...
```

### Authentication Headers

When services communicate through Kong, the following headers are available:

```
x-user-id: <user-uuid>
x-organization-id: <org-uuid>
x-user-email: <email>
x-user-roles: <comma-separated-roles>
x-correlation-id: <request-tracking-id>
```

### Health Check Endpoints

All services expose standardized health check endpoints:

```http
GET /health
Response:
{
  "status": "ok",
  "service": "auth-service",
  "version": "1.0.0",
  "timestamp": "2025-07-31T10:00:00Z",
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "kafka": "ok"
  }
}
```

### Circuit Breaker Configuration

Services implement circuit breakers for resilient communication:

```typescript
// Default circuit breaker settings
{
  timeout: 3000,          // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000,    // 30 seconds
  volumeThreshold: 10
}
```