# Evidence Service

## Overview

The Evidence Service is a core microservice in the SOC Compliance Platform responsible for managing compliance evidence throughout its lifecycle. It handles evidence collection, storage, validation, versioning, and linking to compliance controls.

## Key Features

- **Evidence Management**: Create, read, update, delete evidence items
- **Control Linking**: Link evidence to compliance controls and frameworks
- **Approval Workflows**: Review, approve, and reject evidence
- **Version Control**: Track evidence versions and maintain history
- **Bulk Operations**: Perform bulk updates, deletes, and control linking
- **Advanced Querying**: Filter by type, status, dates, expiration, and more
- **Access Tracking**: Monitor views and downloads
- **Compliance Mapping**: Map evidence to SOC 2, ISO 27001, HIPAA frameworks
- **Security**: Role-based access control, confidentiality levels

## Architecture

### Technology Stack
- **Framework**: NestJS 10.x
- **Language**: TypeScript
- **Database**: PostgreSQL (TypeORM)
- **Events**: Apache Kafka (event-driven architecture)
- **File Storage**: Local/S3/Azure Blob (configurable)
- **Authentication**: JWT with Kong Gateway integration

### Database Schema
The service uses PostgreSQL with the following main entity:

**Evidence Entity**:
- Basic info (title, description, type, status, source)
- Relationships (clientId, auditId, controlId)
- Dates (collection, effective, expiration, review)
- Storage info (URL, provider, path)
- Compliance mapping (frameworks, controls, TSCs)
- Version control (version, parent, history)
- Security (confidentiality, access control, encryption)
- Metadata (file info, validation, quality score)

### Evidence Types
```typescript
enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG_FILE = 'log_file',
  CONFIGURATION = 'configuration',
  REPORT = 'report',
  ATTESTATION = 'attestation',
  SYSTEM_EXPORT = 'system_export',
  API_RESPONSE = 'api_response',
  DATABASE_QUERY = 'database_query',
  INTERVIEW = 'interview',
  OBSERVATION = 'observation',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  DIAGRAM = 'diagram',
  VIDEO = 'video',
  CODE_SNIPPET = 'code_snippet',
  SECURITY_SCAN = 'security_scan',
  AUDIT_LOG = 'audit_log',
  OTHER = 'other'
}
```

### Evidence Status Flow
```
DRAFT → PENDING_COLLECTION → COLLECTING → COLLECTED → PENDING_REVIEW 
  ↓                                           ↓              ↓
  └────────────────────────────────────→ ARCHIVED      UNDER_REVIEW
                                                             ↓
                                                    APPROVED / REJECTED
                                                             ↓
                                                      NEEDS_UPDATE / EXPIRED
```

## API Endpoints

### Evidence CRUD

#### Create Evidence
```http
POST /evidence
Authorization: Bearer <token>

{
  "title": "Security Policy Document",
  "description": "Annual security policy review",
  "type": "POLICY",
  "source": "MANUAL_UPLOAD",
  "confidentialityLevel": "CONFIDENTIAL",
  "clientId": "uuid",
  "controlId": "uuid",
  "effectiveDate": "2024-01-01T00:00:00Z",
  "expirationDate": "2025-01-01T00:00:00Z",
  "tags": ["security", "policy"],
  "metadata": {
    "fileName": "security_policy_2024.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf"
  }
}
```

#### Upload Evidence with File
```http
POST /evidence/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
title: "Evidence Title"
description: "Evidence Description"
type: "DOCUMENT"
clientId: "uuid"
```

#### Get Evidence
```http
GET /evidence/:id
Authorization: Bearer <token>
```

#### Update Evidence
```http
PATCH /evidence/:id
Authorization: Bearer <token>

{
  "description": "Updated description",
  "status": "PENDING_REVIEW",
  "tags": ["security", "updated"]
}
```

#### Delete Evidence
```http
DELETE /evidence/:id?hard=false
Authorization: Bearer <token>
```

### Evidence Queries

#### Query Evidence
```http
GET /evidence?page=1&limit=20&type=POLICY&status=APPROVED
Authorization: Bearer <token>
```

Query Parameters:
- `page`, `limit`: Pagination
- `clientId`, `auditId`, `controlId`: Filter by relationship
- `type`, `types[]`: Filter by evidence type
- `status`, `statuses[]`: Filter by status
- `search`: Text search in title/description
- `collectionDateFrom`, `collectionDateTo`: Date range filters
- `expiringSoon`: Boolean flag for expiring evidence
- `needsReview`: Boolean flag for evidence needing review
- `includeMetrics`: Include statistics in response

#### Get Expiring Evidence
```http
GET /evidence/expiring?daysAhead=30
Authorization: Bearer <token>
```

#### Get Evidence by Audit
```http
GET /evidence/audit/:auditId
Authorization: Bearer <token>
```

### Control Linking

#### Link Evidence to Control
```http
POST /evidence/:id/link-control
Authorization: Bearer <token>

{
  "controlId": "uuid",
  "organizationId": "uuid",
  "framework": "SOC2",
  "controlCode": "CC1.1",
  "metadata": {
    "mappingType": "primary",
    "relevanceScore": 0.95,
    "notes": "Primary evidence for control"
  }
}
```

#### Bulk Link Evidence
```http
POST /evidence/bulk/link-control
Authorization: Bearer <token>

{
  "evidenceIds": ["uuid1", "uuid2"],
  "controlId": "uuid",
  "organizationId": "uuid",
  "framework": "ISO27001"
}
```

#### Unlink from Control
```http
DELETE /evidence/:id/unlink-control
Authorization: Bearer <token>

{
  "controlId": "uuid",
  "removeFromFramework": true
}
```

#### Search Evidence by Control
```http
POST /evidence/control/search
Authorization: Bearer <token>

{
  "controlId": "uuid",
  "organizationId": "uuid",
  "includeArchived": false,
  "includeExpired": false,
  "status": "APPROVED"
}
```

#### Get Control Evidence Summary
```http
GET /evidence/control/:controlId/summary?organizationId=uuid
Authorization: Bearer <token>
```

### Approval Workflows

#### Approve Evidence
```http
POST /evidence/:id/approve
Authorization: Bearer <token>

{
  "comments": "Evidence meets all requirements"
}
```

#### Reject Evidence
```http
POST /evidence/:id/reject
Authorization: Bearer <token>

{
  "reason": "Missing required sections"
}
```

### Version Management

#### Get Version History
```http
GET /evidence/:id/versions
Authorization: Bearer <token>
```

#### Create New Version
```http
POST /evidence/:id/new-version
Authorization: Bearer <token>

{
  "title": "Updated Evidence",
  "description": "New version with updates",
  // ... other evidence fields
}
```

### Bulk Operations

#### Bulk Update
```http
POST /evidence/bulk/update
Authorization: Bearer <token>

{
  "evidenceIds": ["uuid1", "uuid2"],
  "status": "COLLECTED",
  "tags": ["bulk-updated"]
}
```

#### Bulk Delete
```http
POST /evidence/bulk/delete
Authorization: Bearer <token>

{
  "evidenceIds": ["uuid1", "uuid2"],
  "reason": "Cleanup outdated evidence"
}
```

## Event Integration

The Evidence Service publishes the following Kafka events:

- `evidence.created`: When new evidence is created
- `evidence.updated`: When evidence is updated
- `evidence.deleted`: When evidence is deleted
- `evidence.archived`: When evidence is soft deleted
- `evidence.approved`: When evidence is approved
- `evidence.rejected`: When evidence is rejected
- `evidence.linked_to_control`: When evidence is linked to a control
- `evidence.unlinked_from_control`: When evidence is unlinked
- `evidence.expiring-soon`: When evidence is about to expire
- `evidence.bulk-deleted`: When multiple evidence items are deleted

## Configuration

### Environment Variables

```env
# Service Configuration
NODE_ENV=development
PORT=3005

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=soc_evidence

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=evidence-service
KAFKA_CONSUMER_GROUP=evidence-service-group

# Storage (for file uploads)
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
# For S3
# STORAGE_PROVIDER=s3
# AWS_ACCESS_KEY_ID=xxx
# AWS_SECRET_ACCESS_KEY=xxx
# AWS_REGION=us-east-1
# S3_BUCKET_NAME=soc-evidence

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
```

## Security Features

### Access Control
- Role-based permissions (admin, compliance_manager, auditor, analyst, evidence_viewer)
- Evidence-level access control (allowed/denied users and roles)
- Confidentiality levels (public, internal, confidential, highly_confidential, restricted)

### Data Protection
- Optional encryption for sensitive evidence
- Audit trail for all actions
- Access tracking (views, downloads)

## Development

### Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start in development
npm run start:dev

# Run tests
npm test
```

### Testing
```bash
# Run the test script
node test-evidence-service.js

# Run unit tests
npm test

# Run e2e tests
npm run test:e2e
```

## Maintenance

### Scheduled Tasks
- **Daily at 2 AM**: Check for expiring evidence and update expired statuses

### Database Indexes
The following indexes are created for performance:
- `(clientId, status)`
- `(auditId, controlId)`
- `(type, status)`
- `collectionDate`
- `expirationDate`

### Monitoring
- Health endpoint: `GET /health`
- Metrics: View counts, download counts, quality scores
- Events: All actions emit Kafka events for audit trail

## Integration Examples

### Linking Evidence to a Control
```javascript
// 1. Create evidence
const evidence = await createEvidence({
  title: "Access Control Policy",
  type: "POLICY",
  clientId: organizationId
});

// 2. Link to control
await linkEvidenceToControl(evidence.id, {
  controlId: "control-uuid",
  organizationId: organizationId,
  framework: "SOC2",
  controlCode: "CC6.1"
});

// 3. Get all evidence for the control
const controlEvidence = await getEvidenceByControl({
  controlId: "control-uuid",
  organizationId: organizationId,
  status: "APPROVED"
});
```

### Evidence Approval Workflow
```javascript
// 1. Submit evidence for review
await updateEvidence(evidenceId, {
  status: "PENDING_REVIEW"
});

// 2. Review and approve
await approveEvidence(evidenceId, {
  comments: "Verified and compliant"
});

// OR reject with reason
await rejectEvidence(evidenceId, {
  reason: "Missing required signatures"
});
```

## Troubleshooting

### Common Issues

1. **Evidence not linking to control**
   - Verify control exists and is assigned to organization
   - Check user has proper permissions
   - Ensure framework name matches exactly

2. **File upload fails**
   - Check file size limits
   - Verify storage configuration
   - Ensure upload directory has write permissions

3. **Query performance slow**
   - Check database indexes are created
   - Use pagination for large result sets
   - Consider adding specific indexes for common queries

## Future Enhancements

- [ ] Automated evidence collection from integrations
- [ ] AI-powered evidence validation
- [ ] OCR for document text extraction
- [ ] Evidence templates and auto-generation
- [ ] Advanced analytics and reporting
- [ ] Blockchain-based evidence integrity