# Policy Service E2E Tests

This directory contains end-to-end tests for the Policy Service, focusing on comprehensive policy management, OPA integration, compliance mapping, and SOC 2 compliance requirements.

## Test Structure

- `policy.e2e-spec.ts` - Main E2E test suite for policy CRUD operations
- `opa-integration.e2e-spec.ts` - OPA (Open Policy Agent) integration tests
- `compliance-mapping.e2e-spec.ts` - Tests for framework and control mapping
- `policy-workflow.e2e-spec.ts` - Policy lifecycle and approval workflow tests
- `jest-e2e.json` - Jest configuration for E2E tests
- `setup.ts` - Test setup utilities and helpers
- `test.env` - Test environment variables

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- policy.e2e-spec.ts

# Run with coverage
npm run test:e2e -- --coverage

# Watch mode for development
npm run test:e2e:watch
```

## Test Coverage

The E2E tests cover:

### Policy Management
- Create, read, update, delete policies
- Policy versioning and history tracking
- Policy templates and cloning
- Bulk operations
- Search and filtering with Elasticsearch

### OPA Integration
- Policy evaluation with Open Policy Agent
- Rego policy compilation and validation
- Dynamic policy enforcement
- Policy decision logging
- Performance testing for policy evaluation

### Compliance Mapping
- Framework mapping (SOC 2, ISO 27001, NIST, etc.)
- Control mapping and coverage analysis
- Compliance scoring and gap analysis
- Automated compliance assessments
- Evidence linking

### Workflow Management
- Draft → Review → Approval → Publication workflow
- Role-based access control
- Approval chains and delegation
- Exception management
- Expiration and review reminders

### Security Testing
- Authentication and authorization
- Input validation and sanitization
- XSS and injection prevention
- Rate limiting
- Audit logging

### Integration Testing
- Kafka event publishing
- Cross-service communication
- Database transactions
- Cache invalidation
- Error handling and recovery

## Test Data

The tests use:
- Seeded test policies
- Mock OPA policies
- Test compliance frameworks
- Sample user roles and permissions

## Best Practices

1. **Isolation**: Each test suite creates its own test data and cleans up after
2. **Idempotency**: Tests can be run multiple times without side effects
3. **Performance**: Tests include performance benchmarks for critical operations
4. **SOC Compliance**: Tests verify compliance controls are properly implemented
5. **Real Scenarios**: Tests simulate real-world policy management workflows

## SOC 2 Compliance Testing

The E2E tests specifically validate:
- CC6.1: Logical access controls for policy management
- CC6.6: Role-based policy permissions
- CC7.1: Comprehensive audit logging
- CC7.2: Monitoring of policy changes
- PI1.1: Processing integrity for policy evaluations

## Troubleshooting

Common issues:
- **OPA Connection**: Ensure OPA is running on port 8181
- **Database**: Check PostgreSQL connection and `soc_policies` database exists
- **Kafka**: Verify Kafka is running for event tests
- **Elasticsearch**: Required for search functionality tests