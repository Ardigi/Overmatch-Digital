# SOC Compliance Platform

Enterprise-grade SOC 1/SOC 2 compliance management platform built with modern microservices architecture.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build shared packages (REQUIRED!)
npm run build:shared

# 3. Start infrastructure
.\start-docker-services.ps1
# OR
docker-compose up -d

# 4. Start development
npm run dev              # Frontend only
npm run dev:all          # Frontend + all services
```

Access the platform at http://localhost:3000

## 📁 Project Structure

```
├── services/        # 12 NestJS microservices
├── packages/        # Shared libraries
├── shared/          # Contracts, events, DTOs
├── app/             # Next.js frontend
├── docs/            # Documentation
└── scripts/         # Development & deployment scripts
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, React Query
- **Backend**: NestJS microservices architecture
- **Databases**: PostgreSQL, Redis, MongoDB, Elasticsearch
- **Infrastructure**: Docker, Kafka, Kong API Gateway
- **Authentication**: Keycloak SSO, JWT
- **Monitoring**: OpenTelemetry, Prometheus, Grafana

## 📊 Current Status

See [docs/STATUS.md](docs/STATUS.md) for detailed service status and readiness.

## 📖 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md) - System design and patterns
- [Development Guide](docs/DEVELOPMENT.md) - Setup and development workflow
- [Testing Guide](docs/TESTING.md) - Testing strategies and standards
- [API Reference](docs/API.md) - Service endpoints and contracts
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Security Guide](docs/SECURITY.md) - Security implementation
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Claude AI Guide](CLAUDE.md) - AI assistant instructions

## 🔧 Development

### Prerequisites
- Node.js 20+ 
- Docker Desktop
- PostgreSQL 15
- Redis 7
- 16GB RAM minimum

### Essential Commands

```bash
# Build & Setup
npm run build:shared         # Build shared packages
docker-compose build         # Build Docker images

# Testing
npm test                     # Run all tests
npm run test:integration     # Integration tests
npm run test:e2e            # End-to-end tests

# Development
npm run dev                  # Start frontend
npm run dev:all             # Start everything
npm run lint:fix            # Fix linting issues
npm run type-check          # Check TypeScript

# Infrastructure
docker-compose up -d         # Start services
docker-compose down          # Stop services
docker-compose logs -f       # View logs
```

## 🏗️ Services

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Frontend | 3000 | Next.js web application | ✅ Operational |
| Auth | 3001 | Authentication & authorization | ✅ Operational |
| Client | 3002 | Organization management | ✅ Operational |
| Policy | 3003 | Compliance policies | ✅ Operational |
| Control | 3004 | Control frameworks | ✅ Operational |
| Evidence | 3005 | Evidence collection | ⚠️ In progress |
| Workflow | 3006 | Process automation | ⚠️ In progress |
| Reporting | 3007 | Report generation | ⚠️ In progress |
| Audit | 3008 | Audit trails | ⚠️ In progress |
| Integration | 3009 | External integrations | ⚠️ In progress |
| Notification | 3010 | Alerts & notifications | ⚠️ In progress |
| AI | 3011 | AI-powered features | ⚠️ In progress |

## 🤝 Contributing

Please read our contributing guidelines before submitting PRs.

## 📄 License

[License information]

## 🔗 Links

- [Documentation](docs/README.md)
- [API Reference](docs/API.md)
- [Issue Tracker](https://github.com/your-org/soc-compliance-platform/issues)