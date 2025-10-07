# Generate SSL/TLS Certificates for SOC Compliance Platform
# PowerShell script for development certificate generation

param(
    [Parameter(Mandatory=$false)]
    [string]$Domain = "localhost",
    
    [Parameter(Mandatory=$false)]
    [string]$SubjectAltNames = "DNS:localhost,DNS:*.localhost,DNS:127.0.0.1,DNS:api.localhost,DNS:auth.localhost,DNS:client.localhost",
    
    [Parameter(Mandatory=$false)]
    [int]$ValidDays = 365,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = $PSScriptRoot,
    
    [Parameter(Mandatory=$false)]
    [switch]$Production = $false
)

Write-Host "SOC Compliance Platform - Certificate Generation" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check if OpenSSL is installed
try {
    $opensslVersion = openssl version 2>&1
    Write-Host "OpenSSL found: $opensslVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: OpenSSL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install OpenSSL from https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Create certificate directories
$certDirs = @("dev", "prod", "intermediate", "private")
foreach ($dir in $certDirs) {
    $dirPath = Join-Path $OutputPath $dir
    if (!(Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
        Write-Host "Created directory: $dirPath" -ForegroundColor Green
    }
}

# Set certificate paths
if ($Production) {
    $certPath = Join-Path $OutputPath "prod"
    $keySize = 4096
    $hashAlg = "sha512"
} else {
    $certPath = Join-Path $OutputPath "dev"
    $keySize = 2048
    $hashAlg = "sha256"
}

$privatePath = Join-Path $OutputPath "private"

# Generate OpenSSL configuration
$opensslConfig = @"
[req]
default_bits = $keySize
prompt = no
default_md = $hashAlg
distinguished_name = dn
req_extensions = v3_req

[dn]
C = US
ST = California
L = San Francisco
O = SOC Compliance Platform
OU = IT Security
CN = $Domain

[v3_req]
subjectAltName = $SubjectAltNames
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
basicConstraints = CA:FALSE

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
"@

$configFile = Join-Path $certPath "openssl.cnf"
$opensslConfig | Out-File -FilePath $configFile -Encoding UTF8

Write-Host "`nGenerating certificates for: $Domain" -ForegroundColor Yellow
Write-Host "Subject Alternative Names: $SubjectAltNames" -ForegroundColor Yellow

# Generate CA private key
$caKeyPath = Join-Path $privatePath "ca-key.pem"
$caCertPath = Join-Path $certPath "ca-cert.pem"

if (!(Test-Path $caKeyPath) -or !(Test-Path $caCertPath)) {
    Write-Host "`nGenerating Certificate Authority (CA)..." -ForegroundColor Cyan
    
    # Generate CA private key
    & openssl genrsa -out $caKeyPath $keySize 2>&1 | Out-Null
    
    # Generate CA certificate
    & openssl req -new -x509 -nodes -days 3650 `
        -key $caKeyPath `
        -out $caCertPath `
        -config $configFile `
        -extensions v3_ca `
        -subj "/C=US/ST=California/L=San Francisco/O=SOC Compliance Platform/OU=Certificate Authority/CN=SOC Platform CA" 2>&1 | Out-Null
    
    Write-Host "CA certificate generated successfully" -ForegroundColor Green
} else {
    Write-Host "Using existing CA certificate" -ForegroundColor Yellow
}

# Generate server private key
$serverKeyPath = Join-Path $privatePath "server-key.pem"
Write-Host "`nGenerating server private key..." -ForegroundColor Cyan
& openssl genrsa -out $serverKeyPath $keySize 2>&1 | Out-Null

# Generate certificate signing request
$csrPath = Join-Path $certPath "server.csr"
Write-Host "Generating certificate signing request..." -ForegroundColor Cyan
& openssl req -new -key $serverKeyPath -out $csrPath -config $configFile 2>&1 | Out-Null

# Sign the certificate with our CA
$serverCertPath = Join-Path $certPath "server-cert.pem"
Write-Host "Signing certificate with CA..." -ForegroundColor Cyan
& openssl x509 -req -in $csrPath `
    -CA $caCertPath `
    -CAkey $caKeyPath `
    -CAcreateserial `
    -out $serverCertPath `
    -days $ValidDays `
    -extensions v3_req `
    -extfile $configFile 2>&1 | Out-Null

# Create certificate bundle
$bundlePath = Join-Path $certPath "server-bundle.pem"
Get-Content $serverCertPath, $caCertPath | Set-Content $bundlePath

# Generate DH parameters for extra security (optional, takes time)
$dhparamPath = Join-Path $certPath "dhparam.pem"
if (!(Test-Path $dhparamPath)) {
    Write-Host "`nGenerating DH parameters (this may take a while)..." -ForegroundColor Cyan
    & openssl dhparam -out $dhparamPath 2048 2>&1 | Out-Null
}

# Create nginx-compatible certificates
$nginxKeyPath = Join-Path $certPath "nginx-server.key"
$nginxCertPath = Join-Path $certPath "nginx-server.crt"
Copy-Item $serverKeyPath $nginxKeyPath
Copy-Item $bundlePath $nginxCertPath

# Display certificate information
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "Certificate Generation Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`nCertificate Details:" -ForegroundColor Yellow
& openssl x509 -in $serverCertPath -noout -text | Select-String -Pattern "Subject:|Subject Alternative Name:|Not After" | ForEach-Object {
    Write-Host $_.Line
}

Write-Host "`nGenerated files:" -ForegroundColor Yellow
Write-Host "  CA Certificate:     $caCertPath" -ForegroundColor Green
Write-Host "  Server Certificate: $serverCertPath" -ForegroundColor Green
Write-Host "  Server Key:         $serverKeyPath" -ForegroundColor Green
Write-Host "  Certificate Bundle: $bundlePath" -ForegroundColor Green
Write-Host "  Nginx Certificate:  $nginxCertPath" -ForegroundColor Green
Write-Host "  Nginx Key:          $nginxKeyPath" -ForegroundColor Green

# Generate example Kong configuration
$kongExample = @"

`nExample Kong SSL Configuration:
================================
Add to your Kong configuration:

tls:
  cert: $serverCertPath
  key: $serverKeyPath
  
services:
  - name: api-gateway
    protocol: https
    host: api.localhost
    port: 443
    
routes:
  - name: api-route
    protocols:
      - https
    hosts:
      - api.localhost
    
plugins:
  - name: cors
  - name: rate-limiting
  - name: jwt
"@

Write-Host $kongExample -ForegroundColor Cyan

# Clean up temporary files
Remove-Item $csrPath -ErrorAction SilentlyContinue
Remove-Item $configFile -ErrorAction SilentlyContinue

Write-Host "`nTo trust the CA certificate on Windows:" -ForegroundColor Yellow
Write-Host "  1. Double-click: $caCertPath" -ForegroundColor White
Write-Host "  2. Click 'Install Certificate'" -ForegroundColor White
Write-Host "  3. Select 'Local Machine' and click Next" -ForegroundColor White
Write-Host "  4. Select 'Place all certificates in the following store'" -ForegroundColor White
Write-Host "  5. Click Browse and select 'Trusted Root Certification Authorities'" -ForegroundColor White
Write-Host "  6. Click Next and Finish" -ForegroundColor White