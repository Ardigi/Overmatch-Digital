# SSL/TLS Configuration Guide

This guide covers SSL/TLS certificate setup and configuration for the SOC Compliance Platform, including development self-signed certificates and production certificate management.

## Table of Contents

1. [Overview](#overview)
2. [Development Environment](#development-environment)
3. [Production Environment](#production-environment)
4. [Kong API Gateway Configuration](#kong-api-gateway-configuration)
5. [Certificate Management](#certificate-management)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The SOC Compliance Platform uses SSL/TLS encryption for all client-facing communications:

- **Kong API Gateway**: Handles SSL termination for all API services
- **Nginx**: Provides SSL termination for the frontend application
- **Internal Services**: Communicate over HTTP within the Docker network (secure by default)

### Architecture

```
Internet → HTTPS → Nginx/Kong (SSL Termination) → HTTP → Internal Services
```

### Certificate Structure

```
gateway/certificates/
├── dev/                    # Development certificates
│   ├── ca-cert.pem        # Certificate Authority
│   ├── server-cert.pem    # Server certificate
│   ├── server-key.pem     # Private key
│   └── dhparam.pem        # DH parameters
├── prod/                   # Production certificates
│   ├── fullchain.pem      # Full certificate chain
│   ├── privkey.pem        # Private key
│   └── dhparam.pem        # DH parameters
├── generate-certs.ps1      # PowerShell script for dev certs
└── renew-certs.sh         # Bash script for production renewal
```

## Development Environment

### Prerequisites

1. **Install OpenSSL** (Windows):
   ```powershell
   # Download from https://slproweb.com/products/Win32OpenSSL.html
   # Or use Chocolatey:
   choco install openssl
   ```

2. **Install Docker Desktop** with Docker Compose support

### Generate Development Certificates

1. **Run the certificate generation script**:
   ```powershell
   cd gateway/certificates
   .\generate-certs.ps1
   ```

2. **For custom domains**:
   ```powershell
   .\generate-certs.ps1 -Domain "local.soc-platform.com" -SubjectAltNames "DNS:*.local.soc-platform.com,DNS:api.local.soc-platform.com"
   ```

3. **Trust the CA certificate** (Windows):
   - Double-click `gateway/certificates/dev/ca-cert.pem`
   - Click "Install Certificate"
   - Select "Local Machine" → Next
   - Choose "Place all certificates in the following store"
   - Browse → Select "Trusted Root Certification Authorities"
   - Next → Finish

### Start Services with SSL

```powershell
# Generate certificates first
cd gateway/certificates
.\generate-certs.ps1

# Start services with SSL configuration
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
```

### Access Points

- Frontend: https://localhost:3443
- API Gateway: https://api.localhost
- Auth Service: https://auth.localhost
- Kong Admin: http://localhost:8001 (internal only)

## Production Environment

### Certificate Options

1. **Let's Encrypt (Recommended)**
   - Free, automated certificate renewal
   - Requires domain ownership verification
   - 90-day validity (auto-renewed)

2. **Commercial CA Certificates**
   - Extended validation options
   - Longer validity periods
   - Manual renewal process

3. **AWS Certificate Manager**
   - Free for AWS resources
   - Automatic renewal
   - Integrates with ALB/CloudFront

### Let's Encrypt Setup

1. **Initial setup**:
   ```bash
   # On production server
   cd /opt/soc-platform/gateway/certificates
   chmod +x renew-certs.sh
   
   # Set environment variables
   export DOMAIN=soc-platform.com
   export EMAIL=admin@soc-platform.com
   
   # Run initial setup
   ./renew-certs.sh --initial-setup
   ```

2. **Configure automatic renewal**:
   ```bash
   # Setup cron job
   ./renew-certs.sh --setup-cron
   
   # Verify cron job
   crontab -l
   ```

### Custom CA Certificate Installation

1. **Prepare certificate files**:
   ```bash
   # Place in production directory
   cp /path/to/fullchain.pem gateway/certificates/prod/
   cp /path/to/privkey.pem gateway/certificates/prod/
   
   # Set permissions
   chmod 644 gateway/certificates/prod/fullchain.pem
   chmod 600 gateway/certificates/prod/privkey.pem
   ```

2. **Deploy to Kong**:
   ```bash
   # Run deployment
   ./renew-certs.sh --verify
   ```

## Kong API Gateway Configuration

### SSL Configuration

The Kong SSL configuration is defined in `gateway/kong-ssl.yml`:

```yaml
certificates:
  - cert: |
      -----BEGIN CERTIFICATE-----
      # Certificate content
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      # Private key content
      -----END PRIVATE KEY-----
    snis:
      - name: soc-platform.com
      - name: "*.soc-platform.com"
```

### Environment Variables

Configure Kong for SSL in production:

```bash
# Kong SSL environment variables
KONG_PROXY_LISTEN=0.0.0.0:8000, 0.0.0.0:8443 ssl http2
KONG_SSL_PROTOCOLS=TLSv1.2 TLSv1.3
KONG_SSL_PREFER_SERVER_CIPHERS=on
```

### SSL Plugins

Kong plugins for SSL security:

```yaml
plugins:
  # Force HTTPS redirect
  - name: request-transformer
    config:
      replace:
        headers:
          - "X-Forwarded-Proto: https"

  # HSTS header
  - name: response-transformer
    config:
      add:
        headers:
          - "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
```

## Certificate Management

### Certificate Monitoring

1. **Check certificate expiration**:
   ```bash
   # Check current certificate
   echo | openssl s_client -connect soc-platform.com:443 2>/dev/null | openssl x509 -noout -enddate
   
   # Check all certificates
   for domain in soc-platform.com api.soc-platform.com auth.soc-platform.com; do
     echo "Checking $domain:"
     echo | openssl s_client -connect $domain:443 2>/dev/null | openssl x509 -noout -enddate
   done
   ```

2. **Monitor with Prometheus** (optional):
   ```yaml
   # prometheus.yml
   - job_name: 'ssl_exporter'
     static_configs:
       - targets:
         - soc-platform.com:443
         - api.soc-platform.com:443
   ```

### Certificate Backup

1. **Automated backups**:
   ```bash
   # Backup script (add to cron)
   #!/bin/bash
   BACKUP_DIR="/backup/certificates/$(date +%Y%m%d)"
   mkdir -p $BACKUP_DIR
   cp -r /opt/soc-platform/gateway/certificates/prod/* $BACKUP_DIR/
   find /backup/certificates -type d -mtime +30 -exec rm -rf {} \;
   ```

2. **Secure storage**:
   - Store backups encrypted
   - Use AWS S3 with versioning
   - Keep offline copies

### Certificate Renewal

1. **Let's Encrypt (automatic)**:
   ```bash
   # Check renewal status
   ./renew-certs.sh --verify
   
   # Force renewal
   certbot renew --force-renewal
   ```

2. **Manual renewal**:
   ```bash
   # Generate new CSR
   openssl req -new -key privkey.pem -out renewal.csr
   
   # Submit to CA and get new certificate
   # Then deploy:
   cp new-fullchain.pem gateway/certificates/prod/fullchain.pem
   docker-compose restart kong nginx
   ```

## Security Best Practices

### 1. Strong Cipher Configuration

```nginx
# Nginx cipher configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
```

### 2. Security Headers

```nginx
# Essential security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### 3. Certificate Pinning (Optional)

```javascript
// Frontend certificate pinning
const pins = [
  'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
];

fetch('https://api.soc-platform.com', {
  headers: {
    'Public-Key-Pins': pins.join('; ')
  }
});
```

### 4. Key Management

- Use hardware security modules (HSM) for production keys
- Rotate keys annually
- Use strong key algorithms (RSA 4096 or ECDSA P-384)
- Implement key escrow for recovery

## Troubleshooting

### Common Issues

1. **Certificate not trusted**:
   ```bash
   # Check certificate chain
   openssl s_client -connect soc-platform.com:443 -showcerts
   
   # Verify certificate
   openssl verify -CAfile ca-cert.pem server-cert.pem
   ```

2. **Mixed content warnings**:
   - Ensure all resources use HTTPS
   - Check for hardcoded HTTP URLs
   - Update Content-Security-Policy

3. **SSL handshake failures**:
   ```bash
   # Test SSL connection
   openssl s_client -connect soc-platform.com:443 -tls1_2
   
   # Check supported ciphers
   nmap --script ssl-enum-ciphers -p 443 soc-platform.com
   ```

4. **Kong SSL errors**:
   ```bash
   # Check Kong logs
   docker logs soc-kong-ssl
   
   # Verify Kong certificate loading
   curl -i http://localhost:8001/certificates
   ```

### SSL Testing Tools

1. **SSL Labs Test**:
   ```
   https://www.ssllabs.com/ssltest/analyze.html?d=soc-platform.com
   ```

2. **Mozilla Observatory**:
   ```
   https://observatory.mozilla.org/analyze/soc-platform.com
   ```

3. **Local testing**:
   ```bash
   # Test cipher support
   openssl s_client -connect localhost:443 -cipher 'ECDHE-RSA-AES256-GCM-SHA384'
   
   # Test protocol support
   openssl s_client -connect localhost:443 -tls1_3
   ```

### Debug Mode

Enable SSL debugging:

```bash
# Kong debug mode
export KONG_LOG_LEVEL=debug
export KONG_NGINX_DAEMON=off

# Nginx debug mode
# Add to nginx.conf
error_log /var/log/nginx/error.log debug;
```

## Service-Specific Configuration

### Frontend (Next.js)

```javascript
// next.config.js
module.exports = {
  serverRuntimeConfig: {
    https: {
      key: fs.readFileSync('./certificates/server-key.pem'),
      cert: fs.readFileSync('./certificates/server-cert.pem')
    }
  }
}
```

### Backend Services

Each service should trust the proxy headers:

```typescript
// main.ts
app.set('trust proxy', true);
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Compliance Considerations

### SOC 2 Requirements

- Use TLS 1.2 or higher
- Implement certificate lifecycle management
- Document certificate renewal procedures
- Monitor certificate expiration
- Maintain certificate inventory

### GDPR Requirements

- Encrypt data in transit
- Use strong encryption algorithms
- Implement perfect forward secrecy
- Log SSL/TLS events for audit

### PCI DSS Requirements

- Use trusted certificates
- Disable weak protocols (SSL, TLS 1.0, TLS 1.1)
- Implement strong cryptography
- Regular vulnerability scanning

## References

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Kong SSL/TLS Documentation](https://docs.konghq.com/gateway/latest/reference/configuration/#ssl-settings)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)