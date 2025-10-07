# SOC Compliance Platform Documentation

Welcome to the comprehensive documentation for the SOC Compliance Platform.

## 📚 Documentation Structure

### Core Documentation

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [STATUS.md](STATUS.md) | **Current platform status and readiness** | Nov 2024 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, patterns, and service details | Aug 2024 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup guide and development workflow | Nov 2024 |
| [TESTING.md](TESTING.md) | Testing strategies, patterns, and standards | Nov 2024 |
| [API.md](API.md) | Service endpoints and API documentation | Aug 2024 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment and DevOps | Aug 2024 |
| [SECURITY.md](SECURITY.md) | Security implementation and best practices | Aug 2024 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions | Aug 2024 |

### Specialized Guides

| Document | Purpose |
|----------|---------|
| [MONITORING.md](MONITORING.md) | Observability, metrics, and logging |
| [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) | Secrets and configuration management |
| [INTER_SERVICE_COMMUNICATION.md](INTER_SERVICE_COMMUNICATION.md) | Kafka events and service patterns |
| [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) | TypeORM migrations guide |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance optimization |
| [REDIS_CACHING.md](REDIS_CACHING.md) | Caching strategies |

### AI Assistant

| Document | Purpose |
|----------|---------|
| [../CLAUDE.md](../CLAUDE.md) | Instructions for Claude AI assistant |

## 🚀 Quick Start Guides

### For Developers
1. Start with [DEVELOPMENT.md](DEVELOPMENT.md) for environment setup
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
3. Check [STATUS.md](STATUS.md) for current service status
4. Follow [TESTING.md](TESTING.md) for testing guidelines

### For DevOps
1. Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
2. Check [MONITORING.md](MONITORING.md) for observability
3. Review [SECURITY.md](SECURITY.md) for security configuration
4. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues

### For Contributors
1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for local setup
2. Follow code standards in [DEVELOPMENT.md#code-standards](DEVELOPMENT.md#code-standards)
3. Review [TESTING.md](TESTING.md) for test requirements
4. Check [STATUS.md](STATUS.md) for areas needing work

## 📊 Platform Overview

### Technology Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: NestJS microservices (12 services)
- **Databases**: PostgreSQL, Redis, MongoDB, Elasticsearch
- **Infrastructure**: Docker, Kafka, Kong API Gateway
- **Authentication**: Keycloak SSO, JWT
- **Monitoring**: OpenTelemetry, Prometheus, Grafana

### Current Status
See [STATUS.md](STATUS.md) for detailed service status:
- **Platform Readiness**: ~40% Production Ready
- **Operational Services**: 5 of 12
- **Infrastructure**: 100% Running

## 🔍 Finding Information

### By Topic

**Setup & Development**
- Local setup → [DEVELOPMENT.md](DEVELOPMENT.md)
- Docker setup → [DEVELOPMENT.md#docker-development](DEVELOPMENT.md#docker-development)
- Environment variables → [DEVELOPMENT.md#environment-configuration](DEVELOPMENT.md#environment-configuration)

**Architecture & Design**
- System overview → [ARCHITECTURE.md](ARCHITECTURE.md)
- Service details → [ARCHITECTURE.md#services](ARCHITECTURE.md#services)
- Database design → [ARCHITECTURE.md#database-design](ARCHITECTURE.md#database-design)

**Testing**
- Unit testing → [TESTING.md#unit-tests](TESTING.md#unit-tests)
- Integration testing → [TESTING.md#integration-testing](TESTING.md#integration-testing)
- E2E testing → [TESTING.md#e2e-testing](TESTING.md#e2e-testing)

**Deployment & Operations**
- Production deployment → [DEPLOYMENT.md](DEPLOYMENT.md)
- Monitoring setup → [MONITORING.md](MONITORING.md)
- Security configuration → [SECURITY.md](SECURITY.md)

**Troubleshooting**
- Common issues → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Windows issues → [DEVELOPMENT.md#windows-specific-issues](DEVELOPMENT.md#windows-specific-issues)
- Docker issues → [TROUBLESHOOTING.md#docker-issues](TROUBLESHOOTING.md#docker-issues)

## 📝 Documentation Standards

### Updating Documentation
- Keep [STATUS.md](STATUS.md) current with weekly updates
- Update relevant docs when making significant changes
- Use clear headings and consistent formatting
- Include code examples where helpful
- Add timestamps to status updates

### Documentation Principles
- **Single Source of Truth**: Each topic has one authoritative document
- **No Duplication**: Information appears in one place
- **Clear Navigation**: Easy to find information
- **Up-to-Date**: Regular updates, especially STATUS.md
- **Actionable**: Focus on what developers need to do

## 🔗 External Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeORM Documentation](https://typeorm.io)
- [Docker Documentation](https://docs.docker.com)
- [Kafka Documentation](https://kafka.apache.org/documentation)

## 📞 Support

For questions or issues:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [STATUS.md](STATUS.md) for known issues
3. Consult [CLAUDE.md](../CLAUDE.md) for AI assistance
4. Create an issue in the repository