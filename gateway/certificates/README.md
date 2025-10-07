# SSL/TLS Certificates for Kong Gateway

This directory contains SSL/TLS certificates for the SOC Compliance Platform API Gateway.

## Certificate Structure

```
certificates/
├── production/
│   ├── api.soc-platform.com.crt      # Primary API certificate
│   ├── api.soc-platform.com.key      # Private key (encrypted)
│   ├── wildcard.soc-platform.com.crt # Wildcard certificate
│   ├── wildcard.soc-platform.com.key # Wildcard private key
│   └── ca-bundle.crt                 # CA certificate chain
├── staging/
│   ├── staging-api.soc-platform.com.crt
│   ├── staging-api.soc-platform.com.key
│   └── staging-ca-bundle.crt
└── development/
    ├── localhost.crt                  # Self-signed for local dev
    ├── localhost.key
    └── generate-dev-certs.sh         # Script to generate dev certs
```

## Production Certificates

Production certificates should be:
- Issued by a trusted Certificate Authority (CA)
- Use at least 2048-bit RSA or 256-bit ECC
- Include Subject Alternative Names (SANs) for all domains
- Have a validity period of no more than 1 year

### Required Domains

- `api.soc-platform.com` - Primary API endpoint
- `*.api.soc-platform.com` - Wildcard for service subdomains
- `ws.soc-platform.com` - WebSocket endpoint
- `webhooks.soc-platform.com` - Webhook receiver endpoint

## Certificate Installation

1. **Generate Certificate Signing Request (CSR)**
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout api.soc-platform.com.key \
  -out api.soc-platform.com.csr \
  -subj "/C=US/ST=State/L=City/O=SOC Platform Inc/CN=api.soc-platform.com"
```

2. **Submit CSR to Certificate Authority**
   - Use a trusted CA (e.g., Let's Encrypt, DigiCert, GlobalSign)
   - Request certificate with SAN entries

3. **Install Certificate in Kong**
```bash
# Update kong.yml with certificate content
# Or use Kong Admin API:
curl -X POST http://localhost:8001/certificates \
  -F "cert=@api.soc-platform.com.crt" \
  -F "key=@api.soc-platform.com.key" \
  -F "snis[]=api.soc-platform.com" \
  -F "snis[]=*.api.soc-platform.com"
```

## Certificate Renewal

Certificates should be renewed before expiration:

1. **Automated Renewal (Recommended)**
   - Use Let's Encrypt with certbot
   - Configure auto-renewal cron job
   - Integrate with Kong using webhook

2. **Manual Renewal**
   - Monitor expiration dates
   - Renew 30 days before expiration
   - Test in staging before production

## Security Best Practices

1. **Private Key Protection**
   - Store keys with restricted permissions (600)
   - Encrypt keys at rest
   - Use hardware security modules (HSM) in production

2. **Certificate Pinning**
   - Implement certificate pinning for mobile apps
   - Maintain backup pins for rotation

3. **TLS Configuration**
   - Use TLS 1.2 minimum, prefer TLS 1.3
   - Disable weak ciphers
   - Enable OCSP stapling

## Development Certificates

For local development, use self-signed certificates:

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout localhost.key \
  -out localhost.crt \
  -subj "/C=US/ST=State/L=City/O=Development/CN=localhost"
```

## Certificate Monitoring

Monitor certificate expiration and health:

1. **Expiration Monitoring**
   - Set up alerts 30, 14, and 7 days before expiration
   - Use monitoring tools (e.g., Nagios, Prometheus)

2. **Certificate Transparency**
   - Monitor CT logs for unauthorized certificates
   - Set up alerts for new certificate issuance

## Troubleshooting

Common certificate issues:

1. **Certificate Chain Issues**
   - Ensure complete certificate chain is provided
   - Order: Server cert → Intermediate → Root CA

2. **Domain Mismatch**
   - Verify certificate CN and SANs match requested domains
   - Check for www vs non-www mismatches

3. **Expiration**
   - Check certificate validity dates
   - Ensure system time is synchronized

## Emergency Procedures

In case of certificate compromise:

1. **Immediate Actions**
   - Revoke compromised certificate
   - Generate and install new certificate
   - Update certificate pins if used

2. **Communication**
   - Notify security team
   - Update status page
   - Inform affected clients if necessary

## Compliance

Ensure certificates meet compliance requirements:

- **SOC 2**: Use industry-standard encryption
- **PCI DSS**: Minimum TLS 1.2, strong ciphers
- **HIPAA**: End-to-end encryption for PHI