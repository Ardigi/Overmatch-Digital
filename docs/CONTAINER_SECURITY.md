# Container Security Guide

## Overview
This guide covers container security best practices for the SOC Compliance Platform, ensuring secure containerization across all microservices.

## Table of Contents
- [Container Image Security](#container-image-security)
- [Runtime Security](#runtime-security)
- [Pod Security Standards](#pod-security-standards)
- [Network Policies](#network-policies)
- [Secrets Management](#secrets-management)
- [Vulnerability Scanning](#vulnerability-scanning)
- [Security Monitoring](#security-monitoring)

## Container Image Security

### Base Image Selection
```dockerfile
# Use official, minimal base images
FROM node:20-alpine AS builder

# Add security updates
RUN apk update && apk upgrade

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set security labels
LABEL security.scan="required" \
      security.compliance="soc2"
```

### Multi-Stage Builds
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:20-alpine
RUN apk add --no-cache dumb-init
USER nodejs
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### Image Scanning Pipeline
```yaml
# .github/workflows/security-scan.yml
name: Container Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'soc-platform:${{ github.sha }}'
          format: 'sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
```

## Runtime Security

### Security Context
```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: auth-service
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
              - ALL
          runAsNonRoot: true
          runAsUser: 1001
```

### Resource Limits
```yaml
resources:
  limits:
    cpu: "1"
    memory: "512Mi"
    ephemeral-storage: "1Gi"
  requests:
    cpu: "100m"
    memory: "128Mi"
    ephemeral-storage: "100Mi"
```

## Pod Security Standards

### Pod Security Policy (PSP)
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
```

### Pod Security Admission
```yaml
# namespace-labels.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: soc-platform
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Network Policies

### Default Deny All
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: soc-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

### Service-Specific Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-policy
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

## Secrets Management

### Container Secrets
```yaml
# Use Kubernetes secrets with encryption at rest
apiVersion: v1
kind: Secret
metadata:
  name: auth-service-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded>
  db-password: <base64-encoded>
```

### Secret Mounting
```yaml
spec:
  containers:
  - name: auth-service
    volumeMounts:
    - name: secrets
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: secrets
    secret:
      secretName: auth-service-secrets
      defaultMode: 0400
```

## Vulnerability Scanning

### CI/CD Integration
```bash
# Scan during build
trivy image --severity HIGH,CRITICAL --exit-code 1 soc-platform:latest

# Scan running containers
trivy k8s --report summary cluster

# Generate SBOM
syft soc-platform:latest -o spdx-json > sbom.json
```

### Automated Scanning Schedule
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: vulnerability-scanner
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: scanner
            image: aquasec/trivy:latest
            command:
            - sh
            - -c
            - |
              trivy image --format json --output /tmp/scan.json \
              $(kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\n' | sort -u)
```

## Security Monitoring

### Runtime Protection with Falco
```yaml
# falco-rules.yaml
- rule: Unauthorized Process
  desc: Detect unauthorized process execution
  condition: >
    spawned_process and 
    container and
    not proc.name in (allowed_processes)
  output: >
    Unauthorized process started 
    (user=%user.name command=%proc.cmdline container=%container.id)
  priority: WARNING
```

### Container Activity Monitoring
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: falco-config
data:
  falco.yaml: |
    rules_file:
      - /etc/falco/falco_rules.yaml
      - /etc/falco/falco_rules.local.yaml
    json_output: true
    log_stderr: true
    log_syslog: false
    log_level: info
```

## Best Practices Checklist

### Image Security
- [ ] Use minimal base images (Alpine, Distroless)
- [ ] Run as non-root user
- [ ] Remove unnecessary packages and tools
- [ ] Sign images with Cosign
- [ ] Scan images in CI/CD pipeline
- [ ] Use multi-stage builds
- [ ] Pin base image versions
- [ ] Update base images regularly

### Runtime Security
- [ ] Enable Pod Security Standards
- [ ] Implement Network Policies
- [ ] Use read-only root filesystem
- [ ] Drop all capabilities
- [ ] Set resource limits
- [ ] Use security contexts
- [ ] Enable seccomp profiles
- [ ] Implement AppArmor/SELinux

### Monitoring & Compliance
- [ ] Enable audit logging
- [ ] Implement runtime protection
- [ ] Regular vulnerability scanning
- [ ] Generate and review SBOMs
- [ ] Monitor container behavior
- [ ] Track security metrics
- [ ] Maintain compliance reports
- [ ] Incident response procedures

## Security Tools Integration

### Required Tools
```bash
# Install security tools
npm install -g snyk
brew install trivy
brew install cosign
brew install syft

# Kubernetes tools
kubectl apply -f https://raw.githubusercontent.com/falcosecurity/falco/master/deploy/kubernetes/falco-daemonset-configmap.yaml
```

### Scanning Commands
```bash
# Snyk container scanning
snyk container test soc-platform:latest

# Trivy comprehensive scan
trivy image --scanners vuln,secret,config soc-platform:latest

# Generate and sign SBOM
syft soc-platform:latest -o spdx-json > sbom.json
cosign sign --key cosign.key sbom.json
```

## Compliance Validation

### SOC 2 Requirements
- Container images must be scanned before deployment
- All containers must run as non-root
- Network policies must be enforced
- Runtime monitoring must be enabled
- Audit logs must be retained for 7 years

### Validation Script
```bash
#!/bin/bash
# validate-container-security.sh

echo "Validating container security compliance..."

# Check for non-root users
kubectl get pods -o jsonpath='{.items[*].spec.securityContext.runAsUser}' | grep -v "0"

# Verify network policies
kubectl get networkpolicies --all-namespaces

# Check pod security standards
kubectl get namespaces -o json | jq '.items[].metadata.labels'

# Scan all running images
for image in $(kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'); do
  trivy image --severity HIGH,CRITICAL $image
done
```

## Incident Response

### Container Breach Response
1. **Isolate**: Immediately isolate affected container
2. **Preserve**: Capture container state and logs
3. **Analyze**: Review audit logs and runtime monitoring
4. **Remediate**: Patch vulnerabilities and redeploy
5. **Document**: Update security procedures

### Emergency Commands
```bash
# Isolate container
kubectl cordon <node>
kubectl delete pod <pod-name>

# Capture forensics
kubectl logs <pod-name> > incident.log
kubectl describe pod <pod-name> > pod-state.txt
docker save <image> > image-backup.tar

# Review security events
kubectl get events --sort-by='.lastTimestamp'
```

## Next Steps

1. **Immediate Actions**:
   - Implement image scanning in CI/CD
   - Enable Pod Security Standards
   - Deploy runtime monitoring

2. **Short-term Goals**:
   - Complete Network Policy implementation
   - Set up automated vulnerability scanning
   - Implement image signing

3. **Long-term Goals**:
   - Achieve CIS Kubernetes Benchmark compliance
   - Implement Zero Trust networking
   - Advanced threat detection with ML

## References

- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST Container Security Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [OWASP Container Security Top 10](https://owasp.org/www-project-docker-top-10/)