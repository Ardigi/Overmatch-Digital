# API Gateway Documentation - Kong Konnect

## Overview

The SOC Compliance Platform uses **Kong Konnect** (cloud-based SaaS) as its API Gateway to manage all client-to-service and service-to-service communication. Kong Konnect provides centralized management for authentication, rate limiting, monitoring, and security policies across all 11 microservices without requiring local infrastructure management.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Client    │     │   Client    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                    ┌──────▼──────┐
                    │Kong Konnect │
                    │ Cloud Gateway│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌──────▼──────┐
│ Auth Service  │  │Client Service │  │ AI Service  │
│   Port 3001   │  │  Port 3002    │  │ Port 3011  │
└───────────────┘  └───────────────┘  └─────────────┘
```

## Service Endpoints

All services are accessible through Kong Konnect with the following URL pattern:
```
https://api.soc-platform.com/{service}/{endpoint}
```

### Service Routes

| Service | Port | Gateway Path | Description |
|---------|------|--------------|-------------|
| Auth | 3001 | `/auth` | Authentication & authorization |
| Client | 3002 | `/clients` | Client management |
| Policy | 3003 | `/policies` | Policy & framework management |
| Control | 3004 | `/controls` | Control implementation |
| Evidence | 3005 | `/evidence` | Evidence collection |
| Workflow | 3006 | `/workflows` | Workflow automation |
| Reporting | 3007 | `/reports` | Report generation |
| Audit | 3008 | `/audits` | Audit trail & logging |
| Integration | 3009 | `/integrations` | External integrations |
| Notification | 3010 | `/notifications` | Notification management |
| AI | 3011 | `/ai` | AI-powered analysis |

## Authentication

### JWT Authentication with Keycloak

The platform uses Keycloak (running on port 8180) as the identity provider, with Kong Konnect validating JWT tokens:

```bash
curl -X GET https://api.soc-platform.com/clients \
  -H "Authorization: Bearer <jwt-token>"
```

### Public Endpoints

The following endpoints do not require authentication:
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/health`
- `GET /{service}/health` (all services)

### Protected Endpoints

All other endpoints require valid JWT tokens with appropriate claims:
- `/auth/profile`
- `/auth/logout`
- `/auth/change-password`
- `/auth/mfa`
- All CRUD operations on resources

## Rate Limiting

Rate limits are enforced per consumer and endpoint through Kong Konnect:

### Default Limits

| Tier | Per Minute | Per Hour | Per Day |
|------|------------|----------|------------|
| Public | 10 | 100 | 1,000 |
| Basic | 60 | 1,000 | 10,000 |
| Standard | 100 | 2,000 | 20,000 |
| Premium | 200 | 4,000 | 40,000 |
| Internal | 500 | 10,000 | Unlimited |

### Service-Specific Limits

- **AI Service**: 10/min, 100/hour, 1,000/day (resource intensive)
- **Evidence Service**: 50/min, 500/hour (file uploads)
- **Reporting Service**: 30/min, 300/hour (resource intensive)

### Rate Limit Headers

```
X-RateLimit-Limit-Minute: 100
X-RateLimit-Remaining-Minute: 95
X-RateLimit-Limit-Hour: 2000
X-RateLimit-Remaining-Hour: 1950
```

## CORS Configuration

### Allowed Origins

Production:
- `https://app.soc-platform.com`
- `https://www.soc-platform.com`
- `https://admin.soc-platform.com`

Development:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### CORS Headers

```
Access-Control-Allow-Origin: https://app.soc-platform.com
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Accept, Authorization, Content-Type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

## Security Headers

All responses include security headers enforced by Kong Konnect:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Request/Response Transformation

### Request Headers Added by Gateway

```
X-Correlation-ID: <uuid>
X-Request-ID: <uuid>
X-Consumer-ID: <jwt.sub>
X-Consumer-Username: <jwt.username>
X-Consumer-Role: <jwt.role>
X-Organization-ID: <jwt.organizationId>
X-Client-ID: <jwt.clientId>
X-Real-IP: <client-ip>
X-Forwarded-Proto: https
```

### Response Headers Added by Gateway

```
X-Correlation-ID: <uuid>
X-Request-ID: <uuid>
X-Response-Time: <ms>
Cache-Control: no-store, no-cache, must-revalidate, private
```

## Health Checks

All services expose health endpoints accessible through Kong Konnect:

```bash
# Service health
GET https://api.soc-platform.com/{service}/health

# Detailed health with dependencies
GET https://api.soc-platform.com/{service}/health/detailed
```

Response format:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-16T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "kafka": "healthy"
  },
  "version": "1.0.0"
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "code": "invalid_format",
        "message": "Email must be valid"
      }
    ],
    "timestamp": "2025-08-16T10:30:00Z",
    "path": "/clients",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid request format |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded |
| 500 | INTERNAL_SERVER_ERROR | Server error |
| 502 | BAD_GATEWAY | Upstream service error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily down |
| 504 | GATEWAY_TIMEOUT | Upstream timeout |

## Kong Konnect Configuration

Kong Konnect is already configured for the platform with:

- **Service Discovery**: Automatic service registration
- **Load Balancing**: Round-robin with health checks
- **Circuit Breakers**: Automatic failure detection
- **Observability**: Built-in analytics and monitoring
- **Security**: Enterprise-grade security policies
- **Global Distribution**: Multi-region support

### Access Kong Konnect

- **Control Plane**: https://cloud.konghq.com
- **Admin API**: Managed through Konnect UI
- **Analytics**: Real-time dashboards in Konnect

## Development vs Production

### Development
- Services run locally on ports 3001-3011
- Direct access for debugging: `http://127.0.0.1:{port}`
- Kong Konnect routes to local services via ngrok or similar

### Production
- Services run in Docker/Kubernetes
- All access through Kong Konnect
- No direct service access allowed

## Monitoring & Metrics

Kong Konnect provides built-in monitoring:

- Request count by status code
- Request latency (p50, p90, p99)
- Bandwidth usage
- Upstream health status
- Rate limit violations
- API usage analytics
- Consumer analytics

## Best Practices

1. **Always use HTTPS** in production
2. **Include correlation IDs** for request tracking
3. **Handle rate limits** gracefully with exponential backoff
4. **Cache responses** when appropriate
5. **Compress large payloads** with gzip
6. **Monitor API usage** through Konnect dashboards
7. **Rotate API keys** and tokens regularly
8. **Use appropriate timeouts** for long operations
9. **Version your APIs** from the start
10. **Review Konnect analytics** regularly

## Support

For API Gateway issues:
- Check service health: `/{service}/health`
- Review Kong Konnect dashboard
- Contact: platform-support@soc-platform.com
- Documentation: https://docs.konghq.com/konnect/