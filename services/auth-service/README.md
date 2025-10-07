# Auth Service - SOC Compliance Platform

## 🚀 Overview

The Auth Service is a comprehensive authentication and authorization microservice built with NestJS. It provides enterprise-grade security features including JWT-based authentication, multi-factor authentication (MFA), role-based access control (RBAC), and session management.

## ✅ Current Implementation Status (90% Complete)

### Phase 1: Core Authentication ✅
- **JWT Authentication**: Complete with access/refresh token rotation
- **User Registration**: With email verification workflow
- **Login/Logout**: Session tracking and device fingerprinting
- **Password Management**: Reset, forgot password, change password flows
- **Organization Management**: Multi-tenant support with organization hierarchy

### Phase 2: Security Features ✅
- **Email Verification**: Token-based email verification
- **Password Policies**: Configurable per organization
- **Session Management**: Redis-based with concurrent session limits
- **Refresh Token Rotation**: Secure token refresh with IP validation
- **Account Security**: Failed login tracking, account lockout

### Phase 3: Advanced Features (In Progress)
- **MFA/2FA**: TOTP-based (structure in place, needs implementation)
- **API Keys**: Management structure exists
- **SSO**: OAuth2/SAML providers (structure in place)

## 🏗️ Architecture

```
auth-service/
├── src/
│   ├── modules/
│   │   ├── auth/          # Core authentication logic
│   │   ├── users/         # User management
│   │   ├── sessions/      # Session management
│   │   ├── mfa/          # Multi-factor authentication
│   │   ├── redis/        # Redis integration
│   │   ├── api-keys/     # API key management
│   │   └── security/     # Security utilities
│   ├── database/
│   │   └── seeds/        # Database seeders
│   └── main.ts           # Application entry point
```

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Environment Setup

1. Copy the environment file:
```bash
cp .env.local .env
```

2. Update `.env` with your configuration:
```env
# Database
DB_HOST=127.0.0.1  # Use 127.0.0.1 on Windows!
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=soc_auth

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=soc_redis_pass

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=30m
```

### Installation & Running

```bash
# Install dependencies
npm install

# Start the service
npm run start:dev

# Seed the database with test data
npm run db:seed

# Test the auth endpoints
npm run test:auth
```

## 📡 API Endpoints

### Public Endpoints

#### Setup (First-time only)
```http
POST /auth/setup
{
  "email": "admin@company.com",
  "password": "SecurePass123!",
  "firstName": "Admin",
  "lastName": "User",
  "organizationName": "My Company",
  "setupKey": "default-setup-key-change-in-production"
}
```

#### Login
```http
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "expiresIn": 1800,
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "roles": ["user"],
    "organizationId": "org-uuid"
  }
}
```

#### Register
```http
POST /auth/register
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "New",
  "lastName": "User",
  "organizationId": "org-uuid" // Optional
}
```

#### Refresh Token
```http
POST /auth/refresh
{
  "refresh_token": "your-refresh-token"
}
```

#### Password Reset
```http
POST /auth/forgot-password
{
  "email": "user@example.com"
}

POST /auth/reset-password
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!"
}
```

### Protected Endpoints

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <access-token>
```

#### Change Password
```http
POST /auth/change-password
Authorization: Bearer <access-token>
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!",
  "confirmNewPassword": "NewPass123!"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access-token>
```

## 🔐 Security Features

### Password Policy
- Minimum 8 characters
- Requires uppercase, lowercase, numbers, and special characters
- Password history tracking (prevents reuse)
- Configurable per organization

### Session Security
- Redis-based session storage
- Concurrent session limits
- Device fingerprinting
- IP address tracking
- Automatic session extension on activity

### Token Security
- Short-lived access tokens (30 minutes)
- Long-lived refresh tokens (7 days)
- Refresh token rotation on use
- IP address validation
- Automatic revocation on password change

## 🧪 Testing

### Run Auth Service Tests
```bash
# Unit tests
npm test

# Test coverage
npm run test:cov

# Test auth endpoints
npm run test:auth
```

### Default Test Users
After running `npm run db:seed`:
- **Super Admin**: admin@overmatch.digital / Welcome123!
- **MSP Admin**: msp.admin@overmatch.digital / Welcome123!
- **Client Admin**: admin@techcorp.example.com / Welcome123!

## 🔄 Database Management

### Seed Database
```bash
npm run db:seed
```

### Database Schema
The service uses TypeORM with auto-sync in development. Key entities:
- **User**: Core user information
- **Organization**: Multi-tenant organizations
- **Role**: RBAC roles
- **Permission**: Granular permissions
- **RefreshToken**: Token management
- **AuditLog**: Security audit trail

## 📝 Development Notes

### What's Working
- Complete authentication flow (register, login, logout)
- JWT token generation and validation
- Refresh token rotation
- Password reset and email verification
- Session management with Redis
- User CRUD operations
- Organization management
- Role-based access control
- Comprehensive seed data

### What Needs Completion (Last 10%)
1. **MFA Implementation**: Structure exists, needs TOTP logic
2. **External Email Service**: Currently logs to console
3. **SSO Providers**: OAuth2/SAML integration
4. **API Key Management**: Structure exists, needs implementation
5. **Kafka Events**: Event publishing commented out for simplicity
6. **Advanced Audit Logging**: Basic structure exists

### Known Issues
- TypeORM/Jest compatibility requires extensive mocking
- Windows requires `DB_HOST=127.0.0.1` instead of `localhost`
- Some endpoints need additional error handling

## 🚀 Production Considerations

1. **Environment Variables**: Use strong secrets for JWT_SECRET
2. **Database**: Run migrations instead of auto-sync
3. **Redis**: Configure proper persistence
4. **Security Headers**: Add helmet middleware
5. **Rate Limiting**: Configure per-endpoint limits
6. **Monitoring**: Add APM and logging
7. **Email Service**: Integrate real email provider

## 📚 Additional Resources

- [API Documentation](http://localhost:3001/api) - Swagger UI (when enabled)
- [Main README](../../README.md) - Platform overview
- [Testing Guide](../../docs/TESTING_ARCHITECTURE.md) - Testing strategy

---

**Note**: This service is 90% functional and ready for development use. The remaining 10% consists of external integrations (email, SSO) and advanced features (MFA implementation) that can be added as needed.