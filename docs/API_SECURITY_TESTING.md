# API Security Testing Guide

## Overview
Comprehensive API security testing procedures for the SOC Compliance Platform, covering authentication, authorization, input validation, and vulnerability testing.

## Table of Contents
- [Testing Strategy](#testing-strategy)
- [Authentication Testing](#authentication-testing)
- [Authorization Testing](#authorization-testing)
- [Input Validation Testing](#input-validation-testing)
- [API Fuzzing](#api-fuzzing)
- [Rate Limiting Testing](#rate-limiting-testing)
- [OWASP API Security Top 10](#owasp-api-security-top-10)
- [Automated Security Testing](#automated-security-testing)

## Testing Strategy

### Security Testing Levels
1. **Unit Tests**: Security-focused unit tests for auth logic
2. **Integration Tests**: API endpoint security validation
3. **DAST**: Dynamic Application Security Testing in CI/CD
4. **Penetration Testing**: Manual security assessment
5. **Continuous Monitoring**: Runtime API security monitoring

### Testing Environment Setup
```bash
# Install security testing tools
npm install -g @zaproxy/cli
npm install --save-dev @hapi/joi supertest-security
pip install safety bandit

# API testing framework
npm install --save-dev newman postman-to-openapi
npm install --save-dev @stoplight/spectral-core
```

## Authentication Testing

### JWT Token Security
```typescript
// test/security/jwt.security.spec.ts
describe('JWT Security Tests', () => {
  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    
    expect(response.body.error).toBe('Token expired');
  });

  it('should reject tokens with invalid signature', async () => {
    const tamperedToken = jwt.sign(
      { userId: '123' },
      'wrong-secret',
      { expiresIn: '1h' }
    );
    
    await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(401);
  });

  it('should reject tokens with algorithm confusion', async () => {
    const maliciousToken = jwt.sign(
      { userId: '123' },
      publicKey,
      { algorithm: 'HS256' } // Attempting algorithm confusion
    );
    
    await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${maliciousToken}`)
      .expect(401);
  });
});
```

### OAuth2/OIDC Testing
```typescript
describe('OAuth2 Security Tests', () => {
  it('should validate redirect_uri against whitelist', async () => {
    const response = await request(app)
      .get('/oauth/authorize')
      .query({
        client_id: 'test-client',
        redirect_uri: 'https://evil.com/callback',
        response_type: 'code'
      })
      .expect(400);
    
    expect(response.body.error).toBe('invalid_redirect_uri');
  });

  it('should prevent authorization code replay', async () => {
    const code = await getAuthorizationCode();
    
    // First use should succeed
    await exchangeCodeForToken(code).expect(200);
    
    // Second use should fail
    await exchangeCodeForToken(code).expect(400);
  });
});
```

## Authorization Testing

### RBAC Testing
```typescript
// test/security/rbac.security.spec.ts
describe('Role-Based Access Control', () => {
  const endpoints = [
    { path: '/api/admin/users', method: 'GET', allowedRoles: ['admin'] },
    { path: '/api/policies', method: 'POST', allowedRoles: ['admin', 'auditor'] },
    { path: '/api/evidence', method: 'GET', allowedRoles: ['admin', 'auditor', 'user'] }
  ];

  endpoints.forEach(endpoint => {
    it(`should enforce roles for ${endpoint.method} ${endpoint.path}`, async () => {
      // Test with unauthorized role
      const userToken = await getTokenForRole('guest');
      await request(app)
        [endpoint.method.toLowerCase()](endpoint.path)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Test with authorized role
      const adminToken = await getTokenForRole(endpoint.allowedRoles[0]);
      await request(app)
        [endpoint.method.toLowerCase()](endpoint.path)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect([200, 201]);
    });
  });
});
```

### Privilege Escalation Testing
```typescript
describe('Privilege Escalation Prevention', () => {
  it('should prevent horizontal privilege escalation', async () => {
    const user1Token = await loginAs('user1');
    const user2Id = 'user2-id';
    
    // Attempt to access another user's data
    await request(app)
      .get(`/api/users/${user2Id}/sensitive-data`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(403);
  });

  it('should prevent vertical privilege escalation', async () => {
    const userToken = await loginAs('regular-user');
    
    // Attempt to perform admin action
    await request(app)
      .post('/api/admin/system-config')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ setting: 'value' })
      .expect(403);
  });
});
```

## Input Validation Testing

### SQL Injection Testing
```typescript
describe('SQL Injection Prevention', () => {
  const sqlPayloads = [
    "' OR '1'='1",
    "1; DROP TABLE users--",
    "' UNION SELECT * FROM users--",
    "admin'--",
    "' OR 1=1--"
  ];

  sqlPayloads.forEach(payload => {
    it(`should sanitize SQL payload: ${payload}`, async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: payload })
        .expect(200);
      
      // Should return empty results, not SQL error
      expect(response.body.results).toEqual([]);
      expect(response.body.error).toBeUndefined();
    });
  });
});
```

### XSS Prevention Testing
```typescript
describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>'
  ];

  xssPayloads.forEach(payload => {
    it(`should sanitize XSS payload: ${payload.substring(0, 20)}...`, async () => {
      const response = await request(app)
        .post('/api/comments')
        .send({ content: payload })
        .expect(201);
      
      // Verify stored content is sanitized
      const stored = await getComment(response.body.id);
      expect(stored.content).not.toContain('<script>');
      expect(stored.content).not.toContain('javascript:');
    });
  });
});
```

## API Fuzzing

### Fuzzing Configuration
```yaml
# api-fuzzing.yaml
name: API Security Fuzzing
base_url: http://localhost:3000
auth:
  type: bearer
  token: ${API_TOKEN}

endpoints:
  - path: /api/users
    method: POST
    fuzzing:
      - field: email
        type: email_fuzzer
        invalid_formats: true
      - field: age
        type: number_fuzzer
        include_negative: true
        include_overflow: true
      - field: name
        type: string_fuzzer
        max_length: 10000
        special_chars: true

  - path: /api/search
    method: GET
    fuzzing:
      - field: q
        type: injection_fuzzer
        payloads:
          - sql_injection
          - nosql_injection
          - command_injection
```

### Fuzzing Implementation
```typescript
// test/security/fuzzing.spec.ts
import { Fuzzer } from '@secfuzz/core';

describe('API Fuzzing Tests', () => {
  const fuzzer = new Fuzzer({
    baseUrl: process.env.API_URL,
    iterations: 1000,
    parallel: 10
  });

  it('should handle malformed JSON', async () => {
    const results = await fuzzer.fuzz({
      endpoint: '/api/users',
      method: 'POST',
      contentType: 'application/json',
      payloads: [
        '{"name": "test"', // Missing closing brace
        '{"name": "test", "age": "not-a-number"}',
        '{"name": null, "email": 123}', // Wrong types
        '[[[[[[[[[[[[[[[[[[[[[[[', // Deeply nested arrays
      ]
    });

    results.forEach(result => {
      expect(result.statusCode).toBeLessThan(500);
      expect(result.response).toHaveProperty('error');
    });
  });
});
```

## Rate Limiting Testing

### Rate Limit Validation
```typescript
describe('Rate Limiting', () => {
  it('should enforce rate limits per endpoint', async () => {
    const requests = [];
    
    // Send 100 requests rapidly
    for (let i = 0; i < 100; i++) {
      requests.push(
        request(app)
          .get('/api/resource')
          .set('Authorization', `Bearer ${token}`)
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].headers['x-ratelimit-remaining']).toBe('0');
    expect(rateLimited[0].headers['retry-after']).toBeDefined();
  });

  it('should prevent brute force attacks', async () => {
    const attempts = [];
    
    for (let i = 0; i < 10; i++) {
      attempts.push(
        request(app)
          .post('/api/auth/login')
          .send({ email: 'user@test.com', password: `wrong${i}` })
      );
    }
    
    const responses = await Promise.all(attempts);
    const blocked = responses.filter(r => r.status === 429);
    
    expect(blocked.length).toBeGreaterThan(0);
  });
});
```

## OWASP API Security Top 10

### API1:2023 - Broken Object Level Authorization
```typescript
describe('BOLA Prevention', () => {
  it('should prevent unauthorized object access', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const user1Resource = await createResource(user1.id);
    
    // User2 attempts to access User1's resource
    await request(app)
      .get(`/api/resources/${user1Resource.id}`)
      .set('Authorization', `Bearer ${user2.token}`)
      .expect(403);
  });
});
```

### API2:2023 - Broken Authentication
```typescript
describe('Authentication Security', () => {
  it('should enforce strong password requirements', async () => {
    const weakPasswords = ['123456', 'password', 'qwerty'];
    
    for (const password of weakPasswords) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password })
        .expect(400);
      
      expect(response.body.error).toContain('password');
    }
  });

  it('should implement account lockout', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });
    }
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'correct' })
      .expect(423);
    
    expect(response.body.error).toBe('Account locked');
  });
});
```

### API3:2023 - Broken Object Property Level Authorization
```typescript
describe('Property Level Authorization', () => {
  it('should filter sensitive properties based on role', async () => {
    const adminResponse = await request(app)
      .get('/api/users/123')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    const userResponse = await request(app)
      .get('/api/users/123')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    
    // Admin sees all fields
    expect(adminResponse.body).toHaveProperty('ssn');
    expect(adminResponse.body).toHaveProperty('internalNotes');
    
    // Regular user doesn't see sensitive fields
    expect(userResponse.body).not.toHaveProperty('ssn');
    expect(userResponse.body).not.toHaveProperty('internalNotes');
  });
});
```

## Automated Security Testing

### CI/CD Pipeline Integration
```yaml
# .github/workflows/api-security.yml
name: API Security Testing
on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Security Tests
        run: |
          npm run test:security
          npm run test:fuzzing
      
      - name: OWASP ZAP Scan
        uses: zaproxy/action-api-scan@v0.4.0
        with:
          target: 'http://localhost:3000'
          format: openapi
          rules_file_name: '.zap/rules.tsv'
      
      - name: Run Spectral API Linting
        run: |
          npx @stoplight/spectral-cli lint openapi.yaml
      
      - name: Security Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            zap-report.html
            security-test-results.json
```

### Continuous Security Monitoring
```typescript
// monitoring/api-security-monitor.ts
import { SecurityMonitor } from '@soc-compliance/monitoring';

const monitor = new SecurityMonitor({
  endpoints: ['/api/**'],
  rules: [
    {
      name: 'Suspicious Pattern Detection',
      pattern: /(\.\./|<script|eval\(|exec\()/i,
      action: 'block',
      alert: true
    },
    {
      name: 'Rate Anomaly Detection',
      threshold: 100,
      window: '1m',
      action: 'throttle',
      alert: true
    }
  ]
});

monitor.on('security-event', async (event) => {
  await logger.security(event);
  await notifySecurityTeam(event);
});
```

## Security Testing Checklist

### Pre-Release Security Tests
- [ ] Authentication bypass attempts
- [ ] Authorization boundary testing
- [ ] Input validation for all endpoints
- [ ] Rate limiting verification
- [ ] Session management testing
- [ ] CORS policy validation
- [ ] API versioning security
- [ ] Error message information leakage
- [ ] HTTP security headers validation
- [ ] TLS/SSL configuration testing

### Penetration Testing Scenarios
- [ ] Token manipulation and replay
- [ ] Privilege escalation attempts
- [ ] Business logic bypass
- [ ] Race condition exploitation
- [ ] XXE injection testing
- [ ] SSRF vulnerability testing
- [ ] Mass assignment testing
- [ ] API endpoint enumeration
- [ ] GraphQL specific attacks
- [ ] WebSocket security testing

## Remediation Guidelines

### Critical Vulnerabilities (Fix Immediately)
- Authentication bypass
- SQL/NoSQL injection
- Remote code execution
- Privilege escalation
- Sensitive data exposure

### High Priority (Fix Within 24 Hours)
- XSS vulnerabilities
- CSRF attacks
- Broken access control
- Security misconfiguration
- Missing encryption

### Medium Priority (Fix Within Sprint)
- Information disclosure
- Weak cryptography
- Missing rate limiting
- Insufficient logging
- CORS misconfiguration

## Tools and Resources

### Testing Tools
```bash
# API Security Testing
npm install -g @zaproxy/cli            # OWASP ZAP
npm install -g @postman/newman         # API Testing
pip install nuclei                     # Vulnerability Scanner

# Static Analysis
npm install -g @stoplight/spectral-cli # OpenAPI Linting
npm install -g eslint-plugin-security  # Code Security

# Dynamic Testing
npm install -g artillery              # Load Testing
npm install -g autocannon            # HTTP Benchmarking
```

### Security Resources
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [API Security Checklist](https://github.com/shieldfy/API-Security-Checklist)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE API Security View](https://cwe.mitre.org/data/definitions/1346.html)