# SOC Compliance Platform - Deployment Guide

## Overview

This guide covers deployment options from local development to production Kubernetes.

## Deployment Options

### 1. Local Development (Without Docker)
See [DEVELOPMENT.md](./DEVELOPMENT.md) for native local setup.

### 2. Local Development (With Docker)

#### Prerequisites
- Docker Desktop v20.10+
- 16GB RAM minimum
- 20GB free disk space

#### Quick Start with Secrets Management (NEW!)
```bash
# Set up local secrets first
.\docker-secrets\create-dev-secrets.ps1

# Start infrastructure with secrets support
.\docker-secrets\deploy-with-secrets.ps1 -Mode Development

# Or manually:
docker-compose -f docker-compose.yml -f docker-compose.secrets.yml up -d

# Verify health including secrets
.\scripts\check-local-health.ps1 -Detailed
```

#### Legacy Quick Start (without secrets)
```bash
# Start all infrastructure
docker-compose up -d

# Deploy services
.\scripts\deploy-all-services.ps1

# Verify health
.\scripts\check-local-health.ps1
```

#### Service Endpoints
- Frontend: http://localhost:3000
- Kong Gateway: http://localhost:8000
- Kong Admin: http://localhost:8001

### 3. Production Deployment (Kubernetes)

#### Prerequisites
- Kubernetes cluster (EKS, GKE, or AKS)
- kubectl configured
- Helm 3+
- Domain name with SSL certificates

#### Infrastructure Setup

##### 1. Create Namespace
```bash
kubectl create namespace soc-compliance-prod
```

##### 2. Set Up Secrets Management (NEW!)
```bash
# For AWS Secrets Manager
kubectl create secret generic aws-secrets \
  --from-literal=AWS_REGION=us-east-1 \
  --from-literal=AWS_ACCESS_KEY_ID=<your-key> \
  --from-literal=AWS_SECRET_ACCESS_KEY=<your-secret> \
  -n soc-compliance-prod

# For HashiCorp Vault
helm install vault hashicorp/vault \
  --namespace soc-compliance-prod \
  --values infrastructure/kubernetes/values/vault.yaml

# Initialize Vault
kubectl exec -it vault-0 -n soc-compliance-prod -- vault operator init
kubectl exec -it vault-0 -n soc-compliance-prod -- vault operator unseal
```

##### 3. Install Infrastructure Components
```bash
# PostgreSQL (without hardcoded passwords)
helm install postgres bitnami/postgresql \
  --namespace soc-compliance-prod \
  --set auth.existingSecret=postgres-secret \
  --values infrastructure/kubernetes/values/postgres.yaml

# Redis (without hardcoded passwords)
helm install redis bitnami/redis \
  --namespace soc-compliance-prod \
  --set auth.existingSecret=redis-secret \
  --values infrastructure/kubernetes/values/redis.yaml

# Kafka
helm install kafka bitnami/kafka \
  --namespace soc-compliance-prod \
  --values infrastructure/kubernetes/values/kafka.yaml

# Kong
helm install kong kong/kong \
  --namespace soc-compliance-prod \
  --values infrastructure/kubernetes/values/kong.yaml
```

##### 4. Deploy Microservices
```bash
# Apply all service deployments
kubectl apply -k infrastructure/kubernetes/overlays/production/

# Verify deployments
kubectl get deployments -n soc-compliance-prod
```

##### 5. Configure Ingress
```bash
# Apply ingress rules
kubectl apply -f infrastructure/kubernetes/base/kong-ingress.yaml
```

#### Database Migrations
```bash
# Run migrations for each service
kubectl exec -it deployment/auth-service -n soc-compliance-prod -- npm run db:migrate
kubectl exec -it deployment/client-service -n soc-compliance-prod -- npm run db:migrate
# ... repeat for other services
```

#### Monitoring Setup

##### Prometheus & Grafana
```bash
# Install Prometheus Operator
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
```

##### Import Dashboards
1. Access Grafana at http://localhost:3000 (admin/prom-operator)
2. Import dashboards from `infrastructure/monitoring/grafana/dashboards/`

### 4. Cloud-Specific Deployments

#### AWS EKS
```bash
# Create cluster
eksctl create cluster --name soc-compliance --region us-east-1

# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds"
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=soc-compliance
```

#### Google GKE
```bash
# Create cluster
gcloud container clusters create soc-compliance \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4
```

#### Azure AKS
```bash
# Create cluster
az aks create \
  --resource-group soc-compliance-rg \
  --name soc-compliance \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3
```

## Environment Configuration

### Secrets Management Configuration (NEW!)

#### Production Secrets with AWS Secrets Manager
```env
# Secrets Provider Configuration
SECRETS_PROVIDER=aws
AWS_REGION=us-east-1
AWS_SECRETS_PREFIX=soc-compliance/prod/

# Services will automatically load secrets
# No hardcoded passwords needed!
```

#### Production Secrets with HashiCorp Vault
```env
# Secrets Provider Configuration
SECRETS_PROVIDER=vault
VAULT_ADDR=https://vault.soc-compliance.com
VAULT_NAMESPACE=soc-compliance
VAULT_ROLE_ID=<app-role-id>
VAULT_SECRET_ID=<app-secret-id>
```

#### Docker Swarm Secrets Deployment
```bash
# Create secrets in Swarm
echo "your-database-password" | docker secret create db_password -
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-redis-password" | docker secret create redis_password -

# Deploy with secrets
docker stack deploy -c docker-compose.yml -c docker-compose.production.yml soc-platform
```

### Legacy Environment Variables (DEPRECATED)
```env
# DO NOT use hardcoded values in production!
# These are loaded from secrets manager:
DATABASE_PASSWORD=${SECRET:database.password}
REDIS_PASSWORD=${SECRET:redis.password}
JWT_SECRET=${SECRET:jwt.secret}
```

## Scaling Configuration

### Horizontal Pod Autoscaling
```yaml
# Apply HPA for services
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: soc-compliance-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF
```

### Database Connection Pooling
Configure in each service:
```typescript
TypeOrmModule.forRoot({
  // ... other config
  extra: {
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
})
```

## Backup & Disaster Recovery

### Database Backups
```bash
# PostgreSQL backup
kubectl exec -it postgres-0 -n soc-compliance-prod -- \
  pg_dump -U postgres soc_auth > backup-auth-$(date +%Y%m%d).sql

# Schedule automated backups
kubectl apply -f infrastructure/kubernetes/cronjobs/backup.yaml
```

### Disaster Recovery Plan
1. **RTO**: 4 hours
2. **RPO**: 1 hour
3. **Backup Frequency**: Every hour
4. **Backup Retention**: 30 days
5. **Recovery Testing**: Monthly

## Security Hardening

### Network Policies
```yaml
# Restrict inter-service communication
kubectl apply -f infrastructure/kubernetes/network-policies/
```

### Pod Security Policies
```yaml
# Apply security constraints
kubectl apply -f infrastructure/kubernetes/pod-security-policies/
```

### SSL/TLS Configuration
- Use cert-manager for automatic certificate management
- Enforce HTTPS for all external traffic
- Enable mTLS between services

## Troubleshooting

### Common Issues

#### Pods Not Starting
```bash
# Check pod logs
kubectl logs -f deployment/auth-service -n soc-compliance-prod

# Describe pod for events
kubectl describe pod auth-service-xxx -n soc-compliance-prod
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it deployment/auth-service -n soc-compliance-prod -- \
  nc -zv postgres.soc-compliance-prod.svc.cluster.local 5432
```

#### Service Discovery Issues
```bash
# Check service endpoints
kubectl get endpoints -n soc-compliance-prod

# Test DNS resolution
kubectl exec -it deployment/auth-service -n soc-compliance-prod -- \
  nslookup client-service.soc-compliance-prod.svc.cluster.local
```

### Health Checks
```bash
# Check all service health endpoints
for service in auth client policy control evidence; do
  kubectl exec -it deployment/$service-service -n soc-compliance-prod -- \
    curl -f http://localhost:300x/health
done
```

## Rollback Procedures

### Application Rollback
```bash
# Rollback deployment
kubectl rollout undo deployment/auth-service -n soc-compliance-prod

# Check rollout status
kubectl rollout status deployment/auth-service -n soc-compliance-prod
```

### Database Rollback
```bash
# Restore from backup
kubectl exec -it postgres-0 -n soc-compliance-prod -- \
  psql -U postgres soc_auth < backup-auth-20250724.sql
```

## Performance Tuning

### JVM Settings (for NestJS services)
```bash
NODE_OPTIONS="--max-old-space-size=2048"
```

### PostgreSQL Tuning
```sql
-- Adjust shared_buffers
ALTER SYSTEM SET shared_buffers = '1GB';
-- Adjust work_mem
ALTER SYSTEM SET work_mem = '16MB';
-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Optimization
```bash
# Set maxmemory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 2gb
```