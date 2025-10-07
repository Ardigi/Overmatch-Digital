# SOC Compliance Platform - Complete Tech Stack Documentation
**Platform**: Enterprise SOC 1/2 Compliance Management System
**Architecture**: Microservices with Event-Driven Communication
**Last Updated**: October 7, 2025

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kong Konnect (Cloud)                         │
│                   Enterprise API Gateway                         │
└──────────────────┬──────────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │               │
┌───▼────┐   ┌────▼─────┐   ┌────▼────┐
│ Next.js│   │  NestJS  │   │ NestJS  │
│Frontend│   │Service #1│   │Service #N│
└────────┘   └────┬─────┘   └────┬────┘
                  │               │
         ┌────────┴───────────────┴──────────┐
         │                                   │
    ┌────▼────┐  ┌──────┐  ┌──────┐  ┌─────▼────┐
    │PostgreSQL│  │ Redis │  │ Kafka│  │ MongoDB  │
    └─────────┘  └───────┘  └──────┘  └──────────┘
```

---

## 📦 Monorepo Structure

### Workspace Organization
```
overmatch-digital/
├── services/              # 11 NestJS microservices
├── packages/              # Shared libraries (7 packages)
├── shared/                # Contracts, events, DTOs
├── app/                   # Next.js pages
├── frontend/              # React components
├── gateway/               # Kong configuration (deprecated)
├── docker/                # Docker configurations
├── scripts/               # Automation scripts
└── docs/                  # Documentation
```

**Package Manager**: npm with workspaces
**Build Tool**: Next.js (frontend), NestJS CLI (services)
**Total Services**: 11 microservices + 1 frontend

---

## 🎨 Frontend Stack

### Core Framework
- **Next.js 15.0.0** - React framework with SSR/SSG
  - App Router (latest)
  - Server Components
  - API Routes for BFF (Backend for Frontend)
  - Optimized image loading
  - Built-in SEO support

### UI & Styling
- **React 18.2** - UI library
- **Tailwind CSS 4.0** - Utility-first CSS framework
  - Custom design system
  - Dark mode support
  - Responsive breakpoints
  - @tailwindcss/postcss for builds

### Component Libraries
- **@headlessui/react 2.2.4** - Accessible UI primitives
  - Modals, Dropdowns, Tabs
  - Full keyboard navigation
  - Screen reader support
- **@heroicons/react 2.2.0** - Icon library (Tailwind design)
- **Lucide React 0.525** - Additional icon set
- **Framer Motion 12.23** - Animation library
  - Page transitions
  - Micro-interactions
  - Gesture recognition

### Form Management
- **React Hook Form 7.60** - Form state management
  - Performance optimized
  - Validation integration
  - TypeScript support
- **@hookform/resolvers 5.1.1** - Validation adapters
- **Zod 4.0.5** - Schema validation
  - TypeScript-first
  - Runtime type checking
  - Error message customization

### Data Fetching & State
- **@tanstack/react-query 5.83** - Server state management
  - Caching strategies
  - Background refetching
  - Optimistic updates
  - Devtools integration
- **Axios 1.11** - HTTP client
  - Interceptors for auth
  - Request/response transformation
  - Error handling

### Additional UI Components
- **React Select 5.10** - Advanced select/dropdown
- **React Datepicker 8.4** - Date/time selection
- **React Dropzone 14.3** - File upload
- **React Hot Toast 2.5** - Notification system
- **Recharts 3.1** - Data visualization
  - Charts and graphs
  - Responsive design
  - SOC compliance reporting

### Development Tools
- **TypeScript 5.0** - Type safety
- **Babel React Compiler 19.1-rc** - Automatic memoization

---

## ⚙️ Backend Stack (NestJS Microservices)

### Core Framework
- **NestJS 11.1.6** - Node.js framework
  - Dependency Injection
  - Modular architecture
  - Decorator-based
  - TypeScript native
  - Express under the hood (@nestjs/platform-express)

### NestJS Ecosystem
- **@nestjs/common** - Core utilities
- **@nestjs/core** - Application core
- **@nestjs/config 3.3** - Configuration management
  - Environment variables
  - Validation schemas
  - Hierarchical config
- **@nestjs/swagger 7.4** - API documentation
  - OpenAPI 3.0 spec
  - Auto-generated docs
  - Interactive UI
- **@nestjs/terminus 10.3** - Health checks
  - Database health
  - Memory/disk checks
  - Custom indicators

### Authentication & Authorization
- **@nestjs/passport 10.0** - Auth strategies
- **@nestjs/jwt 10.2** - JWT handling
- **Next-Auth 5.0-beta** - Frontend auth
- **jose 6.0.12** - JWT operations (JOSE standard)
- **jsonwebtoken 9.0.2** - Legacy JWT support
- **jwks-rsa 3.2** - RSA key management
  - Keycloak integration
  - Public key rotation
  - JWKS endpoint

### Database Layer

#### PostgreSQL (Primary Database)
- **TypeORM 0.3.x** - ORM for PostgreSQL
  - Entity management
  - Migrations
  - Query builder
  - Relations
- **@nestjs/typeorm 10.0.2** - NestJS integration
- **pg 8.16.3** - PostgreSQL driver
- **12 Databases**:
  - soc_auth
  - soc_clients
  - soc_policies
  - soc_controls
  - soc_evidence
  - soc_workflows
  - soc_reporting
  - soc_audits
  - soc_integrations
  - soc_notifications
  - soc_ai
  - soc_compliance (shared)

#### MongoDB (Document Storage)
- **MongoDB 7.0** - Document database
  - Evidence attachments
  - Unstructured data
  - Audit logs
- **Mongoose** - MongoDB ODM (via services)

#### Redis (Caching & Sessions)
- **Redis 7-alpine** - In-memory data store
- **redis 5.6.1** (npm package) - Node client
- **ioredis** - Alternative client (in some services)
- **Use Cases**:
  - Session storage
  - Rate limiting
  - Cache invalidation
  - Pub/Sub (backup to Kafka)

#### Elasticsearch (Search Engine)
- **Elasticsearch 8.11** - Full-text search
- **Use Cases**:
  - Policy search
  - Evidence discovery
  - Audit trail queries
  - Compliance reporting

### Event-Driven Architecture

#### Apache Kafka
- **Kafka** - Event streaming platform
- **kafkajs 2.2.4** - Node Kafka client
- **@nestjs/microservices 11.1.6** - Kafka integration
- **Zookeeper 2181** - Kafka coordination
- **Event Patterns**:
  - `auth.user.created`
  - `client.organization.updated`
  - `policy.control.mapped`
  - `evidence.collected`
  - `workflow.step.completed`

#### Event Bus
- **@nestjs/event-emitter 2.1** - Internal events
  - In-process events
  - Cross-module communication
  - Event handlers

### Scheduling & Background Jobs
- **@nestjs/schedule 4.1** - Cron jobs
  - Scheduled reports
  - Data cleanup
  - Cache warming
  - Health checks

### Identity & SSO
- **Keycloak 24.0** - Identity Provider
  - OAuth 2.0
  - OpenID Connect
  - SAML 2.0
  - User federation
  - Multi-factor authentication
  - Social login

---

## 🛡️ Security Stack

### Authentication
- **JWT Tokens** - Stateless auth
- **Refresh Tokens** - Long-lived sessions
- **API Keys** - Service-to-service auth
- **Service Auth Guard** - Inter-service security

### Encryption
- **bcrypt** - Password hashing
- **crypto (Node.js)** - Cryptographic operations
- **Web Crypto API** - Browser crypto

### Rate Limiting
- **Redis-based** - Distributed rate limiting
- **IP-based** - DDoS protection
- **User-based** - Abuse prevention

### Input Validation
- **class-validator** - DTO validation
- **class-transformer** - Data transformation
- **Zod** - Schema validation

### Security Headers
- **Helmet** - HTTP headers
- **CORS** - Cross-origin policies
- **CSP** - Content Security Policy

---

## 🌐 API Gateway

### Production (REQUIRED)
- **Kong Konnect (Cloud)** - Enterprise API Gateway
  - Managed service
  - Global CDN
  - Advanced analytics
  - Rate limiting
  - Authentication
  - Load balancing
  - **NOT replaceable with local Kong**

### Local Development (Deprecated)
- **Kong (Open Source)** - Local debugging only
  - DB-less mode
  - Declarative config
  - Not supported for production

---

## 🔍 Monitoring & Observability

### Metrics
- **Prometheus** - Time-series database
- **Grafana** - Visualization
- **OpenTelemetry** - Instrumentation
- **@soc-compliance/monitoring** - Custom package

### Logging
- **Winston** - Logging framework
- **Elasticsearch** - Log aggregation
- **Kibana** - Log visualization

### Tracing
- **Jaeger** - Distributed tracing
- **OpenTelemetry** - Trace collection

### APM
- **Custom metrics** - Business KPIs
- **Health endpoints** - Service health
- **@nestjs/terminus** - Health checks

---

## 🧪 Testing Stack

### Unit Testing
- **Jest** - Test framework
  - 70-80% of tests
  - Fast execution (<5s)
  - Mocked dependencies
- **ts-jest** - TypeScript support
- **@nestjs/testing** - NestJS test utilities

### Integration Testing
- **Jest** - Test runner (separate config)
  - 15-20% of tests
  - Real database connections
  - Docker infrastructure required
- **Supertest** - HTTP assertions
- **Docker Compose** - Test infrastructure

### E2E Testing
- **Puppeteer 24.16** - Browser automation
  - 5-10% of tests
  - Full user flows
  - Kong Konnect integration

### Code Quality
- **Biome 2.1.3** - Linter & Formatter
  - Replaces ESLint + Prettier
  - 10-100x faster
  - TypeScript/JavaScript
  - JSON formatting
- **Husky 9.1.7** - Git hooks
- **lint-staged 15.5** - Pre-commit checks

---

## 📦 Shared Packages

### @soc-compliance/contracts
- **Purpose**: Shared TypeScript interfaces
- **Contents**: DTOs, API contracts
- **Used By**: All services + frontend

### @soc-compliance/events
- **Purpose**: Event schemas
- **Contents**: Kafka event types
- **Used By**: All services

### @soc-compliance/auth-common
- **Purpose**: Authentication utilities
- **Contents**: Guards, decorators, strategies
- **Used By**: All services

### @soc-compliance/http-common
- **Purpose**: HTTP client utilities
- **Contents**: Service clients, interceptors
- **Used By**: All services

### @soc-compliance/cache-common
- **Purpose**: Caching abstractions
- **Contents**: Redis wrapper, cache decorators
- **Used By**: All services

### @soc-compliance/monitoring
- **Purpose**: Observability utilities
- **Contents**: Metrics, logging, tracing
- **Used By**: All services

### @soc-compliance/secrets
- **Purpose**: Secrets management
- **Contents**: Environment variable handling
- **Used By**: All services

---

## 🐳 DevOps & Infrastructure

### Containerization
- **Docker** - Container runtime
- **Docker Compose** - Local orchestration
- **Multi-stage builds** - Optimized images

### Image Strategy
- **Node 20-alpine** - Base images
- **Production stage** - Minimal footprint
- **Non-root user** - Security

### Networking
- **Docker networks** - Service isolation
- **soc-network** - Default network
- **Port mapping** - Service exposure

### Volumes
- **postgres-data** - Database persistence
- **mongo-data** - Document storage
- **redis-data** - Cache persistence
- **elastic-data** - Search indices

### Orchestration (Future)
- **Kubernetes** - Production orchestration
- **Helm charts** - Package management
- **ArgoCD** - GitOps deployment

---

## 📊 Service Breakdown

### 1. Auth Service (Port 3001)
**Database**: soc_auth
**Purpose**: Authentication, authorization, user management
**Tech**: NestJS, TypeORM, PostgreSQL, Redis, Keycloak
**Features**:
- JWT authentication
- Refresh tokens
- MFA support
- SSO integration (Keycloak)
- Role-based access control (RBAC)
- Anomaly detection
- Password policies
- Email verification

### 2. Client Service (Port 3002)
**Database**: soc_clients
**Purpose**: Organization & client management
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- Multi-tenancy
- Organization hierarchy
- Client onboarding
- Contract management
- Billing integration

### 3. Policy Service (Port 3003)
**Database**: soc_policies
**Purpose**: Policy & framework management
**Tech**: NestJS, TypeORM, PostgreSQL, Elasticsearch
**Features**:
- Policy templates
- Framework mapping (SOC 2, ISO 27001, NIST)
- Version control
- Full-text search
- Policy inheritance

### 4. Control Service (Port 3004)
**Database**: soc_controls
**Purpose**: Control management & testing
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- Control library
- Test procedures
- Risk assessment
- FAIR analysis (NPV, IRR, loss calculators)
- Control effectiveness monitoring

### 5. Evidence Service (Port 3005)
**Database**: soc_evidence
**Purpose**: Evidence collection & verification
**Tech**: NestJS, TypeORM, PostgreSQL, MongoDB
**Features**:
- File uploads
- Evidence verification
- Attachment storage (MongoDB)
- Retention policies
- Chain of custody

### 6. Workflow Service (Port 3006)
**Database**: soc_workflows
**Purpose**: Workflow automation & orchestration
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- Workflow engine
- State machine
- Task assignment
- Deadline tracking
- Notification integration

### 7. Reporting Service (Port 3007)
**Database**: soc_reporting
**Purpose**: Report generation & analytics
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- SOC 2 report templates
- PDF generation
- Data aggregation
- Chart rendering
- Export formats (PDF, Excel, CSV)

### 8. Audit Service (Port 3008)
**Database**: soc_audits
**Purpose**: Audit management & tracking
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- Audit planning
- Finding management
- Remediation tracking
- Auditor collaboration
- Audit trail

### 9. Integration Service (Port 3009)
**Database**: soc_integrations
**Purpose**: Third-party integrations
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- API connectors
- Webhook management
- Data synchronization
- OAuth flows
- Integration marketplace

### 10. Notification Service (Port 3010)
**Database**: soc_notifications
**Purpose**: Multi-channel notifications
**Tech**: NestJS, TypeORM, PostgreSQL, Redis
**Features**:
- Email (SMTP)
- SMS (Twilio)
- Push notifications
- Slack integration
- Teams integration
- Webhook delivery

### 11. AI Service (Port 3011)
**Database**: soc_ai
**Purpose**: AI-powered assistance & predictions
**Tech**: NestJS, TypeORM, PostgreSQL
**Features**:
- Control recommendations
- Risk predictions
- Policy suggestions
- Evidence analysis
- Anomaly detection

---

## 🔄 Data Flow Examples

### User Authentication Flow
```
1. Frontend → Kong Konnect → Auth Service
2. Auth Service → PostgreSQL (user lookup)
3. Auth Service → Redis (session storage)
4. Auth Service → Kafka (auth.user.login event)
5. Auth Service → Frontend (JWT token)
```

### Evidence Collection Flow
```
1. Frontend → Kong Konnect → Evidence Service
2. Evidence Service → MongoDB (file storage)
3. Evidence Service → PostgreSQL (metadata)
4. Evidence Service → Kafka (evidence.collected event)
5. Workflow Service ← Kafka (trigger next step)
6. Notification Service ← Kafka (notify auditor)
```

### Report Generation Flow
```
1. Frontend → Kong Konnect → Reporting Service
2. Reporting Service → Policy Service (get policies)
3. Reporting Service → Control Service (get controls)
4. Reporting Service → Evidence Service (get evidence)
5. Reporting Service → PostgreSQL (aggregate data)
6. Reporting Service → PDF Generation
7. Reporting Service → Frontend (download link)
```

---

## 🚀 Development Workflow

### Local Development
```bash
# 1. Build shared packages first
npm run build:shared

# 2. Start infrastructure
docker-compose up -d postgres redis kafka

# 3. Run migrations
npm run migration:run

# 4. Start frontend
npm run dev

# 5. Start specific service
cd services/auth-service && npm run start:dev
```

### Testing
```bash
# Unit tests (fast, mocked)
npm run test

# Integration tests (requires Docker)
npm run test:integration

# E2E tests (requires Kong Konnect)
npm run test:e2e
```

### Code Quality
```bash
# Lint and format
npm run check:fix

# Type checking
npm run type-check

# Build verification
npm run build:services
```

---

## 📚 Key Technologies Summary

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js, React, Tailwind, React Query |
| **Backend** | NestJS, TypeScript, Node.js |
| **Databases** | PostgreSQL, MongoDB, Redis, Elasticsearch |
| **Messaging** | Kafka, Event Emitter |
| **Auth** | Keycloak, JWT, OAuth 2.0 |
| **API Gateway** | Kong Konnect (production), Kong OSS (deprecated) |
| **Monitoring** | Prometheus, Grafana, Jaeger, OpenTelemetry |
| **Testing** | Jest, Supertest, Puppeteer |
| **DevOps** | Docker, Docker Compose |
| **Code Quality** | Biome, TypeScript, Husky |

---

## 🎯 Architecture Patterns

### Design Patterns
- **Microservices Architecture** - Service isolation
- **Event-Driven Architecture** - Async communication
- **CQRS** - Read/write separation
- **Repository Pattern** - Data access abstraction
- **Dependency Injection** - Loose coupling
- **Factory Pattern** - Object creation
- **Strategy Pattern** - Pluggable algorithms
- **Observer Pattern** - Event handling

### Architectural Principles
- **DRY** (Don't Repeat Yourself) - via shared packages
- **SOLID** - Object-oriented design
- **12-Factor App** - Cloud-native best practices
- **API-First** - Contract-driven development
- **Domain-Driven Design** - Business logic organization

---

## 📈 Performance Optimizations

### Frontend
- Server-side rendering (SSR)
- Static site generation (SSG)
- Image optimization
- Code splitting
- Route prefetching
- React Query caching

### Backend
- Database connection pooling
- Redis caching
- Query optimization
- Lazy loading
- Batch processing
- Event batching

### Infrastructure
- CDN (via Kong Konnect)
- Database indexing
- Read replicas (future)
- Load balancing
- Horizontal scaling

---

## 🔐 Compliance & Security

### SOC 2 Requirements Met
- **Access Controls** - RBAC, MFA
- **Encryption** - At rest and in transit
- **Audit Trails** - Comprehensive logging
- **Data Segregation** - Multi-tenancy
- **Backup & Recovery** - Automated backups
- **Incident Response** - Monitoring & alerts

### Security Best Practices
- **Principle of Least Privilege**
- **Defense in Depth**
- **Secure by Default**
- **Regular Security Audits**
- **Dependency Scanning**
- **Secrets Management**

---

## 📄 Documentation Links

- **Architecture**: See `docs/ARCHITECTURE.md`
- **API Documentation**: See `docs/API.md`
- **Development Guide**: See `docs/DEVELOPMENT.md`
- **Testing Guide**: See `docs/TESTING_SETUP.md`
- **Deployment Guide**: See `docs/DEPLOYMENT.md`
- **Troubleshooting**: See `docs/TROUBLESHOOTING.md`

---

**Last Updated**: October 7, 2025
**Platform Version**: 1.0.0
**Node Version**: 18.0.0+
**Architecture**: Microservices with Event-Driven Communication
