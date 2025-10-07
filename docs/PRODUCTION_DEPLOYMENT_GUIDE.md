# Production Deployment Guide

## Prerequisites

### Infrastructure Requirements
- **Kubernetes Cluster**: v1.28+ with 3+ nodes
- **Database**: PostgreSQL 14+ (High Availability setup)
- **Redis**: v7+ (Cluster mode for production)
- **Kafka**: 3.5+ (Multi-broker setup)
- **Kong API Gateway**: 3.4+ (with Enterprise plugins)
- **Container Registry**: Private registry for Docker images

### Security Requirements
- **SSL Certificates**: Valid certificates for all domains
- **Secrets Management**: AWS Secrets Manager or HashiCorp Vault configured
- **Network Policies**: Kubernetes NetworkPolicies configured
- **RBAC**: Kubernetes RBAC properly configured
- **Service Mesh**: Istio or Linkerd for zero-trust networking

## Pre-Deployment Checklist

### 1. Environment Configuration
```bash
# Verify all required environment variables
./scripts/verify-production-config.ps1

# Expected output:
# ✅ Database connections verified
# ✅ Redis cluster accessible
# ✅ Kafka brokers healthy
# ✅ Secrets manager connected
# ✅ Monitoring stack ready
```

### 2. Security Scan
```bash
# Run comprehensive security scan
./scripts/security/scan-hardcoded-secrets.ps1 -OutputFormat JSON

# Vulnerability scanning
trivy image overmatch-digital/*:latest

# License compliance
license-checker --production --onlyAllow "MIT;Apache-2.0;BSD"
```

### 3. Database Migrations
```bash
# Run migrations in production
kubectl exec -it postgres-primary -- psql -U soc_user <<EOF
BEGIN;
-- Run migration scripts
\i /migrations/v2.0.0-production.sql
COMMIT;
EOF
```

## Deployment Process

### Phase 1: Infrastructure Setup

#### 1.1 Kubernetes Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: soc-production
  labels:
    environment: production
    compliance: soc2
```

#### 1.2 Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: soc-network-policy
  namespace: soc-production
spec:
  podSelector:
    matchLabels:
      app: soc-platform
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kong-gateway
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: soc-production
```

### Phase 2: Secrets Deployment

#### 2.1 Create Kubernetes Secrets
```bash
# Deploy secrets from AWS Secrets Manager
kubectl create secret generic soc-secrets \
  --from-literal=JWT_SECRET=$(aws secretsmanager get-secret-value --secret-id prod/soc/jwt-secret --query SecretString --output text) \
  --from-literal=DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id prod/soc/db-password --query SecretString --output text) \
  --from-literal=REDIS_PASSWORD=$(aws secretsmanager get-secret-value --secret-id prod/soc/redis-password --query SecretString --output text) \
  -n soc-production
```

#### 2.2 External Secrets Operator (Recommended)
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: soc-production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-west-2
      auth:
        secretRef:
          accessKeyIDSecretRef:
            name: aws-credentials
            key: access-key-id
```

### Phase 3: Service Deployment

#### 3.1 Deploy Services in Order
```bash
# 1. Deploy infrastructure services
kubectl apply -f k8s/production/postgres-ha.yaml
kubectl apply -f k8s/production/redis-cluster.yaml
kubectl apply -f k8s/production/kafka-cluster.yaml
kubectl apply -f k8s/production/elasticsearch.yaml

# Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=postgres -n soc-production --timeout=300s

# 2. Deploy core services
kubectl apply -f k8s/production/auth-service.yaml
kubectl apply -f k8s/production/client-service.yaml
kubectl apply -f k8s/production/policy-service.yaml

# 3. Deploy dependent services
kubectl apply -f k8s/production/control-service.yaml
kubectl apply -f k8s/production/evidence-service.yaml
kubectl apply -f k8s/production/workflow-service.yaml

# 4. Deploy auxiliary services
kubectl apply -f k8s/production/reporting-service.yaml
kubectl apply -f k8s/production/audit-service.yaml
kubectl apply -f k8s/production/integration-service.yaml
kubectl apply -f k8s/production/notification-service.yaml
kubectl apply -f k8s/production/ai-service.yaml

# 5. Deploy frontend
kubectl apply -f k8s/production/frontend.yaml
```

#### 3.2 Service Configuration Example
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: soc-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: auth-service
        image: registry.soc-platform.com/auth-service:v2.0.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: NODE_ENV
          value: "production"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: soc-secrets
              key: JWT_SECRET
```

### Phase 4: Kong API Gateway Configuration

#### 4.1 Deploy Kong
```bash
kubectl apply -f k8s/production/kong-gateway.yaml

# Configure routes
curl -X POST http://kong-admin:8001/services \
  -d name=auth-service \
  -d url=http://auth-service.soc-production.svc.cluster.local:3001

curl -X POST http://kong-admin:8001/services/auth-service/routes \
  -d paths[]=/api/v1/auth
```

#### 4.2 Enable Plugins
```bash
# Rate limiting
curl -X POST http://kong-admin:8001/plugins \
  -d name=rate-limiting \
  -d config.minute=100 \
  -d config.policy=local

# JWT validation
curl -X POST http://kong-admin:8001/plugins \
  -d name=jwt \
  -d config.secret_is_base64=false
```

### Phase 5: Monitoring Setup

#### 5.1 Deploy Monitoring Stack
```bash
kubectl apply -f k8s/production/prometheus.yaml
kubectl apply -f k8s/production/grafana.yaml
kubectl apply -f k8s/production/jaeger.yaml
kubectl apply -f k8s/production/elk-stack.yaml
```

#### 5.2 Configure Alerts
```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: soc-alerts
  namespace: soc-production
spec:
  groups:
  - name: soc-platform
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      for: 5m
      annotations:
        summary: "High error rate detected"
    - alert: ServiceDown
      expr: up{job="soc-services"} == 0
      for: 1m
      annotations:
        summary: "Service {{ $labels.instance }} is down"
```

## Post-Deployment Verification

### 1. Health Checks
```bash
# Check all services
./scripts/check-production-health.ps1

# Verify endpoints
curl -H "Authorization: Bearer $TOKEN" https://api.soc-platform.com/health
```

### 2. Smoke Tests
```bash
# Run production smoke tests
npm run test:e2e:production

# Verify critical paths
./scripts/verify-critical-paths.ps1
```

### 3. Performance Testing
```bash
# Load testing
k6 run k6/production-load-test.js

# Stress testing
k6 run k6/production-stress-test.js --vus 1000 --duration 30m
```

## Rollback Procedures

### Automated Rollback
```bash
# Kubernetes will automatically rollback if health checks fail
kubectl rollout status deployment/auth-service -n soc-production

# Manual rollback if needed
kubectl rollout undo deployment/auth-service -n soc-production
```

### Database Rollback
```bash
# Always backup before deployment
pg_dump -h postgres-primary -U soc_user -d soc_production > backup-$(date +%Y%m%d).sql

# Rollback if needed
psql -h postgres-primary -U soc_user -d soc_production < backup-20250809.sql
```

## Maintenance Mode

### Enable Maintenance
```bash
# Set maintenance mode in Kong
curl -X POST http://kong-admin:8001/plugins \
  -d name=request-termination \
  -d config.status_code=503 \
  -d config.message="System under maintenance"
```

### Disable Maintenance
```bash
# Remove maintenance plugin
curl -X DELETE http://kong-admin:8001/plugins/{plugin-id}
```

## Monitoring & Alerts

### Key Metrics to Monitor
- **Response Time**: p50, p95, p99 < 500ms
- **Error Rate**: < 0.1%
- **CPU Usage**: < 70% sustained
- **Memory Usage**: < 80% sustained
- **Database Connections**: < 80% of pool
- **Queue Depth**: Kafka lag < 1000 messages

### Alert Channels
- **PagerDuty**: Critical production issues
- **Slack**: #soc-platform-alerts
- **Email**: devops@soc-platform.com

## Disaster Recovery

### Backup Strategy
```bash
# Automated daily backups
0 2 * * * /scripts/backup-production.sh

# Backup retention
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months
```

### Recovery Procedures
1. **Database Recovery**: Restore from latest backup
2. **Service Recovery**: Redeploy from container registry
3. **Data Recovery**: Restore from S3 backups
4. **Configuration Recovery**: Pull from Git + Secrets Manager

## Security Considerations

### Runtime Security
- **Pod Security Policies**: Enforced
- **Network Policies**: Zero-trust networking
- **Secret Rotation**: Every 90 days
- **Audit Logging**: All API calls logged
- **Vulnerability Scanning**: Daily scans

### Compliance Checks
```bash
# SOC 2 compliance verification
./scripts/verify-soc2-compliance.ps1

# GDPR compliance
./scripts/verify-gdpr-compliance.ps1
```

## Support & Escalation

### Support Tiers
1. **L1 Support**: Basic troubleshooting (24/7)
2. **L2 Support**: Service-specific issues (Business hours)
3. **L3 Support**: Architecture/Infrastructure (On-call)

### Escalation Matrix
| Severity | Response Time | Escalation |
|----------|--------------|------------|
| Critical | 15 minutes | Immediate page |
| High | 1 hour | Email + Slack |
| Medium | 4 hours | Email |
| Low | 24 hours | Ticket |

## Documentation

### Required Documentation
- **Runbook**: `/docs/runbook.md`
- **Architecture**: `/docs/architecture.md`
- **API Documentation**: `/docs/api.md`
- **Security Guide**: `/docs/security.md`

### Change Log
All production changes must be documented in `/CHANGELOG.md`

---

**Last Updated**: 2025-08-09
**Version**: 2.0.0
**Status**: Production Ready