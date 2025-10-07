#!/bin/bash

# Generate self-signed certificates for local development
# Usage: ./generate-dev-certs.sh

set -e

echo "Generating self-signed certificates for local development..."

# Create directories if they don't exist
mkdir -p development

# Generate private key
openssl genrsa -out localhost.key 2048

# Generate certificate signing request
openssl req -new -key localhost.key -out localhost.csr \
  -subj "/C=US/ST=Development/L=Local/O=SOC Platform Dev/CN=localhost"

# Create extensions file for SAN
cat > localhost.ext <<EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
DNS.4 = ::1
DNS.5 = api.localhost
DNS.6 = *.api.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate self-signed certificate
openssl x509 -req -in localhost.csr -signkey localhost.key \
  -out localhost.crt -days 365 -sha256 -extfile localhost.ext

# Clean up
rm localhost.csr localhost.ext

# Generate additional certificates for specific services
services=("auth" "client" "policy" "control" "evidence" "workflow" "reporting" "audit" "integration" "notification" "ai")

for service in "${services[@]}"; do
  echo "Generating certificate for ${service} service..."
  
  # Generate service-specific key and certificate
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${service}.localhost.key" \
    -out "${service}.localhost.crt" \
    -subj "/C=US/ST=Development/L=Local/O=SOC Platform Dev/CN=${service}.localhost" \
    -addext "subjectAltName = DNS:${service}.localhost,DNS:${service}-service,IP:127.0.0.1"
done

# Generate a wildcard certificate for all services
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "wildcard.localhost.key" \
  -out "wildcard.localhost.crt" \
  -subj "/C=US/ST=Development/L=Local/O=SOC Platform Dev/CN=*.localhost" \
  -addext "subjectAltName = DNS:*.localhost,DNS:*.api.localhost,DNS:*.soc-platform.localhost,IP:127.0.0.1"

# Set appropriate permissions
chmod 600 *.key
chmod 644 *.crt

echo "Development certificates generated successfully!"
echo ""
echo "To trust the certificates on your system:"
echo "  - Windows: Double-click localhost.crt and install to 'Trusted Root Certification Authorities'"
echo "  - macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain localhost.crt"
echo "  - Linux: sudo cp localhost.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
echo ""
echo "Certificate details:"
openssl x509 -in localhost.crt -text -noout | grep -E "(Subject:|DNS:|IP:)"