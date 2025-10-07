# Policy Service API Documentation

## Overview
The Policy Service provides RESTful APIs for managing compliance policies, controls, and frameworks. All endpoints require authentication via Kong Gateway.

## Base URL
```
http://localhost:3003/api/v1
```

## Authentication
All requests must include a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Response Format

### Success Response
```json
{
  "data": {}, // or array for list endpoints
  "meta": {
    "timestamp": "2025-08-14T10:00:00Z"
  }
}
```

### Paginated Response
```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false,
    "statistics": {} // optional
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": []
  }
}
```

## Endpoints

### Frameworks

#### List Frameworks
```http
GET /frameworks
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `isActive` (boolean): Filter by active status
- `category` (string): Filter by category
- `regulatoryBody` (string): Filter by regulatory body
- `search` (string): Search in name, description, identifier
- `sortBy` (string): Sort field (default: name)
- `sortOrder` (string): ASC or DESC (default: ASC)
- `includeControls` (boolean): Include controls in response
- `includeStats` (boolean): Include statistics

**Response:**
```json
{
  "data": [
    {
      "id": "framework-123",
      "identifier": "SOC2",
      "name": "SOC 2 Type II",
      "version": "2017",
      "description": "Service Organization Control 2",
      "type": "REGULATORY",
      "category": "security",
      "regulatoryBody": "AICPA",
      "isActive": true,
      "controls": [] // if includeControls=true
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "statistics": {
      "totalActive": 8,
      "totalInactive": 2,
      "byType": {
        "REGULATORY": 5,
        "INDUSTRY": 3,
        "INTERNAL": 2
      },
      "averageComplianceScore": 85,
      "totalControls": 250,
      "implementedControls": 213
    }
  }
}
```

#### Get Framework Coverage Report
```http
GET /frameworks/:id/coverage-report
```

**Response:**
```json
{
  "framework": {
    "id": "framework-123",
    "name": "SOC 2 Type II"
  },
  "coverage": {
    "totalControls": 100,
    "coveredControls": 85,
    "coveragePercentage": 85,
    "uncoveredControls": [
      {
        "id": "CC2.1",
        "reason": "No policy mapped"
      }
    ]
  },
  "recommendations": [
    "Create policy for CC2.1",
    "Update expired policy for CC3.4"
  ]
}
```

#### Get Framework Compliance Score
```http
GET /frameworks/:id/compliance-score
```

**Response:**
```json
{
  "frameworkId": "framework-123",
  "score": 85,
  "breakdown": {
    "controlImplementation": 90,
    "policyMapping": 85,
    "evidenceCollection": 80,
    "continuousMonitoring": 85
  },
  "trend": {
    "current": 85,
    "previous": 82,
    "change": 3,
    "direction": "up"
  }
}
```

#### Validate Framework
```http
GET /frameworks/:id/validate
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    "5 controls have no implementation status"
  ]
}
```

#### Get Implementation Guide
```http
GET /frameworks/:id/implementation-guide
```

**Response:**
```json
{
  "framework": {},
  "steps": [
    {
      "order": 1,
      "title": "Assess Current State",
      "description": "Evaluate existing controls and policies",
      "estimatedDuration": "2 weeks",
      "resources": ["Compliance team", "IT security"]
    }
  ],
  "timeline": {
    "totalDuration": "3-6 months",
    "phases": [
      {
        "name": "Assessment",
        "duration": "1 month"
      }
    ]
  },
  "resources": {
    "personnel": ["Compliance team", "IT security", "Legal"],
    "tools": ["GRC platform", "Document management"],
    "budget": "Varies by organization size"
  }
}
```

### Controls

#### List Controls
```http
GET /controls
```

**Query Parameters:**
- `frameworkId` (string): Filter by framework
- `category` (string): Filter by category
- `priority` (string): Filter by priority
- `implementationStatus` (string): Filter by status
- `search` (string): Search in title
- `page` (number): Page number
- `limit` (number): Items per page
- `includeStats` (boolean): Include statistics

**Response:**
```json
{
  "data": [
    {
      "id": "control-123",
      "identifier": "CC1.1",
      "title": "Control Environment",
      "description": "Control description",
      "category": "PREVENTIVE",
      "priority": "HIGH",
      "implementationStatus": "IMPLEMENTED",
      "implementationScore": 90
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "statistics": {
      "byStatus": {
        "IMPLEMENTED": 30,
        "PARTIAL": 10,
        "NOT_IMPLEMENTED": 10
      },
      "automationRate": 0.6
    }
  }
}
```

### Policies

#### List Policies
```http
GET /policies
```

**Query Parameters:**
- `status` (string): Filter by status
- `type` (string): Filter by type
- `search` (string): Search text
- `effectiveDateFrom` (string): Filter by effective date
- `effectiveDateTo` (string): Filter by effective date
- `includeMetrics` (boolean): Include metrics

**Response:**
```json
{
  "data": [
    {
      "id": "policy-123",
      "policyNumber": "SEC-2025-001",
      "title": "Information Security Policy",
      "status": "EFFECTIVE",
      "type": "SECURITY",
      "effectiveDate": "2025-02-01",
      "complianceScore": 0.92
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "metrics": {
      "byStatus": {
        "DRAFT": 5,
        "EFFECTIVE": 20
      },
      "expiringSoon": 3,
      "needsReview": 2
    }
  }
}
```

## Rate Limiting
- Standard endpoints: 100 requests per minute
- Bulk operations: 10 requests per minute
- Export operations: 5 requests per minute

## Error Codes

| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Request validation failed |
| NOT_FOUND | Resource not found |
| CONFLICT | Resource conflict (e.g., duplicate) |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| RATE_LIMITED | Too many requests |
| INTERNAL_ERROR | Server error |

## Webhooks

The service emits events that can trigger webhooks:

- `framework.created`
- `framework.updated`
- `framework.removed`
- `control.created`
- `control.updated`
- `control.tested`
- `policy.created`
- `policy.updated`
- `policy.approved`
- `policy.expired`

## Bulk Operations

### Bulk Import Frameworks
```http
POST /frameworks/import
Content-Type: application/json

{
  "frameworks": [
    {
      "identifier": "CUSTOM-FW",
      "name": "Custom Framework",
      "controls": []
    }
  ]
}
```

### Bulk Map Controls
```http
POST /compliance-mapping/bulk
Content-Type: application/json

{
  "mappings": [
    {
      "policyId": "policy-123",
      "controlIds": ["control-1", "control-2"]
    }
  ]
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { PolicyServiceClient } from '@soc-compliance/policy-sdk';

const client = new PolicyServiceClient({
  baseUrl: 'http://localhost:3003',
  apiKey: process.env.API_KEY
});

// List frameworks
const frameworks = await client.frameworks.list({
  isActive: true,
  includeStats: true
});

// Get compliance score
const score = await client.frameworks.getComplianceScore('framework-123');
```

### Python
```python
from soc_compliance import PolicyServiceClient

client = PolicyServiceClient(
    base_url="http://localhost:3003",
    api_key=os.environ["API_KEY"]
)

# List frameworks
frameworks = client.frameworks.list(
    is_active=True,
    include_stats=True
)

# Get compliance score
score = client.frameworks.get_compliance_score("framework-123")
```

## Postman Collection
A Postman collection is available at `/docs/postman/policy-service.json`

## OpenAPI Specification
The OpenAPI 3.0 specification is available at `/api-docs`