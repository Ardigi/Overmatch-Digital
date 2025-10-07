# External Services Configuration

This guide covers the configuration and management of external services for the SOC Compliance Platform.

## Table of Contents
- [Overview](#overview)
- [Email Services](#email-services)
- [Storage Services](#storage-services)
- [AI Services](#ai-services)
- [Quick Setup](#quick-setup)
- [Environment Configuration](#environment-configuration)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

## Overview

The SOC Compliance Platform integrates with several external services:

| Service | Development | Production | Purpose |
|---------|------------|------------|---------|
| Email | MailDev | SendGrid | Transactional emails, notifications |
| Storage | MinIO | AWS S3 | Evidence documents, reports, audit files |
| AI | Mock/OpenAI/Claude | OpenAI/Claude | Compliance analysis, risk prediction, intelligent automation |

## Email Services

### Development: MailDev

MailDev provides a local SMTP server and web interface for testing emails.

**Features:**
- Catches all emails sent by the application
- Web interface at http://localhost:1080
- No external dependencies
- Automatic email clearing on restart

**Configuration:**
```env
EMAIL_PROVIDER=maildev
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=noreply@soc-compliance.local
EMAIL_FROM_NAME=SOC Compliance Platform (Dev)
```

### Production: SendGrid

SendGrid provides reliable email delivery with advanced features.

**Features:**
- Template management
- Bounce handling
- Click/open tracking
- Webhook support
- High deliverability

**Configuration:**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@soc-compliance.com
EMAIL_FROM_NAME=SOC Compliance Platform

# Template IDs
SENDGRID_TEMPLATE_WELCOME=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_PASSWORD_RESET=d-xxxxxxxxxxxxx
SENDGRID_TEMPLATE_EMAIL_VERIFICATION=d-xxxxxxxxxxxxx
```

**Required Templates:**
1. Welcome Email
2. Password Reset
3. Email Verification
4. MFA Setup
5. Audit Completed
6. Control Test Reminder
7. Evidence Request

## Storage Services

### Development: MinIO

MinIO provides S3-compatible object storage for local development.

**Features:**
- S3 API compatibility
- Web console at http://localhost:9001
- Bucket management
- Access policies

**Configuration:**
```env
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=soc_admin
MINIO_SECRET_KEY=soc_password
S3_BUCKET_EVIDENCE=soc-evidence
S3_BUCKET_REPORTS=soc-reports
S3_BUCKET_AUDIT=soc-audit-files
```

**Default Buckets:**
- `soc-evidence` - Evidence documents
- `soc-reports` - Generated reports
- `soc-audit-files` - Audit trail files

### Production: AWS S3

AWS S3 provides scalable, secure object storage.

**Features:**
- Server-side encryption
- Lifecycle policies
- Cross-region replication
- CloudFront integration

**Configuration:**
```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_EVIDENCE=soc-compliance-evidence
S3_BUCKET_REPORTS=soc-compliance-reports
S3_BUCKET_AUDIT=soc-compliance-audit
```

**Security Requirements:**
- Enable bucket encryption
- Configure lifecycle policies
- Set up access logging
- Implement retention policies

## AI Services

The SOC Compliance Platform supports multiple AI providers with intelligent provider selection based on task requirements and cost optimization.

### Development: Mock Responses

Mock AI responses for testing without API costs.

**Features:**
- Predictable responses for all AI capabilities
- No API key required
- Configurable delay and error simulation
- Comprehensive test coverage

**Configuration:**
```env
AI_PROVIDER=mock
AI_MOCK_DELAY=500
AI_MOCK_ERROR_RATE=0.05
```

### Production: Multi-Provider Support

#### OpenAI Provider

OpenAI API for comprehensive AI capabilities with embeddings support.

**Supported Models:**
- **GPT-4 Turbo Preview**: Advanced reasoning for complex compliance analysis
- **GPT-3.5 Turbo**: Cost-effective processing for routine tasks
- **Text-Embedding-3-Small**: High-quality embeddings for document similarity

**Configuration:**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_ORGANIZATION=org-your-organization-id
OPENAI_MODEL_CHAT=gpt-4-turbo-preview
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
OPENAI_MODEL_COMPLETION=gpt-3.5-turbo-instruct
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# Rate limits
AI_RATE_LIMIT_RPM=60
AI_RATE_LIMIT_TPM=90000
AI_CONCURRENT_REQUESTS=10
```

**Best Use Cases:**
- Large-scale document processing with embeddings
- Cost-effective analysis for routine compliance tasks
- Advanced control mapping with semantic search
- Function calling for complex workflows

#### Claude/Anthropic Provider

Claude API for superior reasoning and analysis capabilities.

**Supported Models:**
- **Claude-3 Sonnet**: Balanced performance for most compliance tasks
- **Claude-3 Opus**: Maximum capability for complex regulatory analysis

**Configuration:**
```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-api-your-anthropic-key
CLAUDE_MODEL_CHAT=claude-3-sonnet-20240229
CLAUDE_MODEL_VISION=claude-3-opus-20240229
CLAUDE_TEMPERATURE=0.7
CLAUDE_MAX_TOKENS=4096

# Rate limits
AI_RATE_LIMIT_RPM=60
AI_RATE_LIMIT_TPM=90000
AI_CONCURRENT_REQUESTS=10
```

**Best Use Cases:**
- Complex regulatory analysis requiring detailed reasoning
- Long document analysis (200K+ token context)
- Detailed compliance recommendations
- Risk assessment with comprehensive explanations

**Note**: Claude doesn't provide embeddings API. The service automatically falls back to mock embeddings or can be configured to use OpenAI for embeddings while using Claude for chat.

#### Hybrid Configuration

For optimal cost and performance, you can configure different providers for different tasks:

```env
# Primary provider for most tasks
AI_PROVIDER=claude

# Both provider configurations
ANTHROPIC_API_KEY=sk-ant-api-your-key
OPENAI_API_KEY=sk-your-openai-key

# The service will automatically use:
# - Claude for complex analysis and reasoning
# - OpenAI for embeddings and cost-effective tasks
# - Mock responses as fallback during development
```

### AI Features Available

**Core Capabilities:**
- **Compliance Analysis**: Intelligent SOC 1/SOC 2 compliance assessment
- **Risk Prediction**: ML-powered risk assessment and trend analysis
- **Control Mapping**: Automated control framework mapping and gap analysis
- **Document Summarization**: AI-powered document analysis and insights
- **Anomaly Detection**: Behavioral pattern analysis and security monitoring
- **Natural Language Queries**: AI-powered natural language interface
- **Intelligent Remediation**: Automated remediation planning and prioritization

**Provider Comparison:**

| Feature | OpenAI | Claude | Mock |
|---------|--------|--------|----- |
| Compliance Analysis | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Risk Prediction | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Control Mapping | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Document Summarization | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Embeddings Support | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| Context Length | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Cost Efficiency | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| JSON Mode | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Function Calling | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Development Cost | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

## Quick Setup

### Development Environment

```bash
# 1. Start external services
.\scripts\setup-external-services.ps1

# 2. Verify services are running
docker ps

# 3. Access web interfaces
# MailDev: http://localhost:1080
# MinIO: http://localhost:9001
```

### Production Environment

```bash
# 1. Set up production configuration
.\scripts\setup-external-services.ps1 -Production

# 2. Configure environment variables
# Edit .env.production with your credentials

# 3. Verify configuration
.\scripts\setup-external-services.ps1 -Service all -Production -Verbose
```

## Environment Configuration

### Service-Specific Environment Files

Each service can have its own environment configuration:

```
services/
├── auth-service/
│   └── .env              # Auth-specific config
├── notification-service/
│   └── .env              # Email configuration
├── evidence-service/
│   └── .env              # Storage configuration
└── ai-service/
    └── .env              # AI configuration
```

### Global Environment Variables

Common environment variables across services:

```env
# Node Environment
NODE_ENV=development|production

# External Services
EXTERNAL_SERVICES_ENABLED=true

# Feature Flags
FEATURE_EMAIL_ENABLED=true
FEATURE_STORAGE_ENABLED=true
FEATURE_AI_ENABLED=true
```

## Health Checks

### Email Service Health Check

```typescript
// Notification Service
GET /health/email

Response:
{
  "status": "healthy",
  "provider": "maildev",
  "lastEmailSent": "2024-01-15T10:30:00Z",
  "queueSize": 0
}
```

### Storage Service Health Check

```typescript
// Evidence Service
GET /health/storage

Response:
{
  "status": "healthy",
  "provider": "minio",
  "buckets": {
    "evidence": "accessible",
    "reports": "accessible",
    "audit": "accessible"
  }
}
```

### AI Service Health Check

```typescript
// AI Service
GET /health/ai

Response:
{
  "status": "healthy",
  "provider": "mock",
  "features": {
    "complianceAnalysis": true,
    "riskPrediction": true,
    "controlMapping": true
  }
}
```

## Troubleshooting

### Email Issues

**MailDev not receiving emails:**
```bash
# Check MailDev is running
docker ps | grep maildev

# Check SMTP configuration
telnet localhost 1025

# View MailDev logs
docker logs soc-maildev
```

**SendGrid errors:**
- Verify API key is valid
- Check template IDs exist
- Review SendGrid activity logs
- Ensure from email is verified

### Storage Issues

**MinIO connection errors:**
```bash
# Check MinIO is running
docker ps | grep minio

# Access MinIO console
# Username: soc_admin
# Password: soc_password
http://localhost:9001

# Test S3 connectivity
aws s3 ls --endpoint-url http://localhost:9000
```

**S3 access denied:**
- Verify IAM permissions
- Check bucket policies
- Ensure credentials are correct
- Review AWS CloudTrail logs

### AI Issues

**Mock responses not working:**
- Check AI_PROVIDER=mock
- Verify mock delay settings
- Review error rate configuration

**OpenAI API errors:**
- Verify API key is valid
- Check rate limits
- Monitor token usage
- Review error messages

## Best Practices

### Email
1. Use templates for consistent formatting
2. Implement retry logic with exponential backoff
3. Handle bounces and complaints
4. Monitor delivery rates

### Storage
1. Use presigned URLs for secure access
2. Implement virus scanning for uploads
3. Set up lifecycle policies
4. Monitor storage costs

### AI
1. Implement caching for repeated queries
2. Use appropriate models for each task
3. Monitor token usage and costs
4. Implement fallback mechanisms

## Monitoring

### Metrics to Track

**Email:**
- Delivery rate
- Bounce rate
- Open rate
- Queue size

**Storage:**
- Upload success rate
- Storage usage
- Request latency
- Error rate

**AI:**
- API response time
- Token usage
- Error rate
- Cache hit rate

### Alerting

Configure alerts for:
- Service downtime
- High error rates
- Rate limit approaching
- Storage quota exceeded

## Security Considerations

### Email
- Use DKIM/SPF for authentication
- Implement rate limiting
- Sanitize email content
- Log all email activities

### Storage
- Enable encryption at rest
- Use IAM roles for access
- Implement versioning
- Regular security audits

### AI
- Never log sensitive data
- Implement PII detection
- Use content filtering
- Monitor for abuse

## Migration Guide

### From Development to Production

1. **Email Migration:**
   - Export email templates
   - Update DNS records
   - Configure webhooks
   - Test deliverability

2. **Storage Migration:**
   - Migrate existing files
   - Update bucket policies
   - Configure CDN
   - Test access patterns

3. **AI Migration:**
   - Update API keys
   - Configure rate limits
   - Test all features
   - Monitor costs

## Support

For issues with external services:

1. Check service-specific logs
2. Review configuration
3. Consult service documentation
4. Contact service support

**Service Documentation:**
- [SendGrid Docs](https://docs.sendgrid.com/)
- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [OpenAI Docs](https://platform.openai.com/docs/)