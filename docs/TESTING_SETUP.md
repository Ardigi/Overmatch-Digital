# Testing Setup Guide

**Last Updated**: October 6, 2025
**Status**: Active - Reflects current verified state

---

## 🎯 Overview

This guide documents the testing infrastructure setup, common issues discovered during comprehensive analysis, and TDD-compliant solutions.

**Related Documents**:
- [TEST_EXECUTION_REPORT.md](../TEST_EXECUTION_REPORT.md) - Detailed test results
- [STATUS.md](STATUS.md) - Overall platform status
- [TESTING.md](TESTING.md) - Testing strategies

---

## 📊 Current Test Status

**Last Verified**: October 6, 2025

### Summary
- ✅ **Auth Service**: 72% passing (13/18 suites) - Jest config blocks 5, database blocks 12 tests
- ✅ **Policy Service**: 100% passing (3/3 unit test suites)
- ⚠️ **Client Service**: Not yet tested
- ⚠️ **9 Other Services**: Not yet tested
- 🔧 **Build System**: All shared packages building successfully

### Test Breakdown

| Service | Unit Tests | Integration Tests | E2E Tests | Overall Status |
|---------|-----------|-------------------|-----------|----------------|
| Auth | 13/13 (100%) | 0/5 (0%) | Not run | ⚠️ Blocked |
| Policy | 3/3 (100%) | Not run | Not run | ✅ Unit OK |
| Client | Not tested | Not tested | Not tested | ❓ Unknown |
| Control | Not tested | Not tested | Not tested | ❓ Unknown |
| Evidence | Not tested | Not tested | Not tested | ❓ Unknown |
| Workflow | Not tested | Not tested | Not tested | ❓ Unknown |
| Reporting | Not tested | Not tested | Not tested | ❓ Unknown |
| Audit | Not tested | Not tested | Not tested | ❓ Unknown |
| Integration | Not tested | Not tested | Not tested | ❓ Unknown |
| Notification | Not tested | Not tested | Not tested | ❓ Unknown |
| AI | Not tested | Not tested | Not tested | ❓ Unknown |

---

## 🚨 Known Issues & Solutions

### Issue #1: Jest ES Module Transformation ⭐ **CRITICAL**

**Affected Services**: Auth (confirmed), likely all services using `jwks-rsa` or `jose`

**Symptoms**:
```
Test suite failed to run
SyntaxError: Unexpected token 'export'
export { compactDecrypt } from './jwe/compact/decrypt.js';
```

**Root Cause**:
- `jwks-rsa` and `jose` libraries use ES modules
- Jest not configured to transform ES modules in `node_modules`
- Affects any service using Keycloak/SSO integration

**Affected Test Files** (Auth Service):
- `auth.service.spec.ts`
- `auth.controller.spec.ts`
- `auth.session.integration.spec.ts`
- `service-communication.integration.spec.ts`
- `auth.controller.owasp.spec.ts`

**Solution** (TDD Approach):

1. **Write verification test**:
```typescript
// test/module-imports.spec.ts
import { JwksClient } from 'jwks-rsa';

describe('Module Imports', () => {
  it('should import jwks-rsa without errors', () => {
    expect(JwksClient).toBeDefined();
  });
});
```

2. **Run test** → Should FAIL with ES module error

3. **Fix jest.config.js**:
```javascript
module.exports = {
  // ... existing config ...

  // Add this to transform ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(jwks-rsa|jose)/)'
  ],

  // Also ensure you have:
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
```

4. **Run test** → Should PASS

5. **Run all tests** → 5 previously failing suites should now pass

**Verification Commands**:
```bash
cd services/auth-service
npm test
# Expected: 18/18 suites passing (was 13/18)
```

**Apply to Other Services**:
- Check if service uses `jwks-rsa` or `jose`
- If yes, apply same fix to `jest.config.js`
- Run tests to verify

---

### Issue #2: Database Integration Test Setup ⭐ **CRITICAL**

**Affected**: Auth Service (confirmed), likely all services with database integration tests

**Symptoms**:
- Query runner creation fails: `dataSource.createQueryRunner()` returns undefined
- Test entities undefined in `beforeEach` hooks
- 12 tests failing in `database.integration.spec.ts`

**Root Cause**:
- Test database connection not properly initialized
- Test data source configuration incomplete
- Missing test database setup/teardown

**Failed Tests**:
```
✗ Should require active database connection
✗ Should have all required tables and columns
✗ Should enforce database constraints
✗ Should create, authenticate, and manage user lifecycle
✗ Should handle MFA setup and validation
✗ Should handle password reset flow
✗ Should perform complex user analytics queries
✗ Should handle login analytics with date ranges
✗ Should test full-text search on user profiles
✗ Should handle concurrent user authentication
✗ Should handle hierarchical organization structure
✗ Should handle role-based access control
```

**Solution** (TDD Approach):

1. **Write test for database connection**:
```typescript
// test/integration/database-setup.spec.ts
import { DataSource } from 'typeorm';

describe('Test Database Setup', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: 'soc_auth_test',  // Dedicated test database
      entities: ['src/**/*.entity.ts'],
      synchronize: true,  // Auto-create schema in tests
      dropSchema: true,   // Clean start for each test run
      logging: false,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('should establish database connection', async () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should create query runner', async () => {
    const queryRunner = dataSource.createQueryRunner();
    expect(queryRunner).toBeDefined();
    await queryRunner.release();
  });
});
```

2. **Run test** → Should FAIL (test DB doesn't exist)

3. **Create test database**:
```bash
# Windows PowerShell
docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE soc_auth_test;"
```

4. **Run test** → Should PASS

5. **Create test setup helper**:
```typescript
// test/integration/setup-test-db.ts
import { DataSource } from 'typeorm';

let testDataSource: DataSource;

export async function setupTestDatabase() {
  if (testDataSource?.isInitialized) {
    return testDataSource;
  }

  testDataSource = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    username: 'soc_user',
    password: 'soc_pass',
    database: 'soc_auth_test',
    entities: ['src/**/*.entity.ts'],
    synchronize: true,
    dropSchema: true,
    logging: false,
  });

  await testDataSource.initialize();
  return testDataSource;
}

export async function teardownTestDatabase() {
  if (testDataSource?.isInitialized) {
    await testDataSource.destroy();
  }
}

export function getTestDataSource() {
  return testDataSource;
}
```

6. **Update integration tests**:
```typescript
import { setupTestDatabase, teardownTestDatabase } from './setup-test-db';

describe('Database Integration Tests', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // Now tests can use dataSource reliably
});
```

7. **Run integration tests** → Should PASS

**Environment Setup**:
```bash
# .env.test file
NODE_ENV=test
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=soc_user
DB_PASSWORD=soc_pass
DB_NAME=soc_auth_test
```

---

### Issue #3: Policy Service Error Logging (Not a Bug)

**Status**: ✅ Working as intended

**What You'll See**:
```
[ERROR] Failed to index policy policy-123
[ERROR] Bulk indexing errors
[ERROR] Error setting cache key test-key
```

**Explanation**:
These are **negative test cases** verifying proper error handling:
- Elasticsearch unavailable → Service handles gracefully
- Circular JSON structure → Error caught and logged
- Cache failures → Proper error recovery

**All tests PASS** - error logging is intentional and correct.

---

## 🔧 Test Environment Setup

### Prerequisites

1. **Infrastructure Running**:
```bash
# Start all required infrastructure
.\start-docker-services.ps1

# Verify infrastructure
docker ps | findstr "postgres redis kafka"
```

2. **Shared Packages Built**:
```bash
# ALWAYS run this first in new sessions
npm run build:shared
```

3. **Test Databases Created**:
```bash
# Create test databases for each service
docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE soc_auth_test;"
docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE soc_clients_test;"
docker exec overmatch-digital-postgres-1 psql -U soc_user -c "CREATE DATABASE soc_policies_test;"
# ... repeat for all services
```

### Running Tests

**Unit Tests Only** (fastest, no infrastructure required):
```bash
cd services/[service-name]
npm test

# Or with specific pattern
npm test -- --testNamePattern="specific test"

# Clear cache if behavior is strange
npm test -- --clearCache
```

**Integration Tests** (requires infrastructure):
```bash
# Verify infrastructure first
npm run test:integration:verify

# Run integration tests for specific service
npm run test:integration:auth
npm run test:integration:client
npm run test:integration:notification

# Run all integration tests
npm run test:integration:all
```

**E2E Tests** (requires all services running):
```bash
# Run E2E for specific service
npm run test:e2e:auth

# Run all E2E tests
npm run test:e2e:all
```

### Test Execution Best Practices

1. **Always build shared packages first**:
```bash
npm run build:shared
```

2. **Run in order of dependency**:
   - Unit tests (no dependencies)
   - Integration tests (need infrastructure)
   - E2E tests (need everything)

3. **Check for hanging tests**:
```bash
npm test -- --detectOpenHandles --runInBand
```

4. **Use test database naming convention**:
   - Production: `soc_auth`
   - Test: `soc_auth_test`

---

## 📋 Testing Checklist

Before marking tests as "passing":

- [ ] All shared packages built successfully
- [ ] Infrastructure running (if integration/E2E)
- [ ] Test databases created (if integration)
- [ ] Unit tests: 100% passing
- [ ] Integration tests: 100% passing (if applicable)
- [ ] E2E tests: 100% passing (if applicable)
- [ ] No test modifications to make tests pass
- [ ] Test coverage meets 80% threshold
- [ ] Tests documented in TEST_EXECUTION_REPORT.md

**NEVER DO**:
- ❌ Modify tests to make them pass
- ❌ Skip or disable failing tests
- ❌ Use `.only` or `.skip` in committed code
- ❌ Commit tests with hardcoded values
- ❌ Share test databases between services

**ALWAYS DO**:
- ✅ Write test first (Red)
- ✅ Make test pass (Green)
- ✅ Refactor code (Refactor)
- ✅ Use dedicated test databases
- ✅ Clean up test data in `afterEach`/`afterAll`

---

## 🎯 TDD Best Practices

### The TDD Cycle

1. **RED**: Write a failing test
```typescript
it('should create user with valid data', async () => {
  const user = await service.createUser({ email: 'test@example.com' });
  expect(user).toBeDefined();
  expect(user.email).toBe('test@example.com');
});
```

2. **GREEN**: Make the test pass (minimal code)
```typescript
async createUser(data) {
  return { email: data.email };
}
```

3. **REFACTOR**: Improve the code
```typescript
async createUser(data: CreateUserDto): Promise<User> {
  const user = this.userRepository.create(data);
  return this.userRepository.save(user);
}
```

### Test Structure

**AAA Pattern** (Arrange-Act-Assert):
```typescript
it('should hash password before saving', async () => {
  // Arrange
  const plainPassword = 'password123';
  const userData = { email: 'test@example.com', password: plainPassword };

  // Act
  const user = await service.createUser(userData);

  // Assert
  expect(user.password).not.toBe(plainPassword);
  expect(await bcrypt.compare(plainPassword, user.password)).toBe(true);
});
```

### Test Naming

**Good**:
- `should return user when valid email provided`
- `should throw UnauthorizedException when password is incorrect`
- `should hash password before saving to database`

**Bad**:
- `test user creation`
- `it works`
- `getUserTest`

### Mocking Strategy

**Mock external dependencies, not business logic**:

```typescript
// ✅ Good - Mock external dependency
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

// ❌ Bad - Mocking business logic
const mockUserService = {
  createUser: jest.fn().mockResolvedValue({ id: 1 }),
};
```

---

## 📊 Service-Specific Notes

### Auth Service

**Status**: 13/18 suites passing (72%)

**Issues**:
1. Jest ES module config - blocks 5 suites
2. Database integration setup - blocks 12 tests

**Fix Priority**: HIGHEST - blocks SSO/Keycloak functionality

**Test Files**:
- ✅ Unit tests: All passing (13/13)
  - email-verification.service.unit.spec.ts
  - permission.service.spec.ts
  - password-policy.service.spec.ts
  - refresh-token.service.spec.ts
  - mfa.spec.ts
  - soc2-security-controls.spec.ts
  - jwt-security.spec.ts
  - anomaly-detection.spec.ts
  - forgot-password.service.spec.ts

- ❌ Integration tests: All failing (0/5)
  - auth.service.spec.ts (Jest config)
  - auth.controller.spec.ts (Jest config)
  - auth.session.integration.spec.ts (Jest config)
  - service-communication.integration.spec.ts (Jest config)
  - database.integration.spec.ts (12 tests - DB setup)

**Next Steps**:
1. Fix jest.config.js (30 min)
2. Fix database integration setup (2-3 hours)
3. Verify all 18 suites passing

### Policy Service

**Status**: 3/3 suites passing (100%)

**Strengths**:
- ✅ Clean unit test suite
- ✅ Proper error handling tests
- ✅ Negative test cases working

**Test Files**:
- ✅ policies.service.mock.spec.ts
- ✅ search.service.spec.ts (includes error scenarios)
- ✅ cache.service.spec.ts (includes error scenarios)

**Next Steps**:
1. Run integration tests
2. Run E2E tests
3. Verify API versioning

### Client Service

**Status**: Not yet tested

**Known Issues**:
- Dockerfile fixed (missing .js extension)
- API versioning needed

**Next Steps**:
1. Run unit tests
2. Document results
3. Fix any issues found

### Other Services (9 remaining)

**Status**: Not yet tested

**Next Steps**:
1. Run unit tests for each
2. Check for Jest config issues
3. Document results
4. Apply fixes systematically

---

## 🔄 Test Execution Workflow

### For New/Changed Code

1. **Write test first**:
```bash
# Create test file
touch src/modules/feature/feature.spec.ts
```

2. **Write failing test**:
```typescript
it('should do something', () => {
  expect(true).toBe(false); // Will fail
});
```

3. **Run test** → RED (fails):
```bash
npm test -- feature.spec.ts
```

4. **Implement feature** → Make it pass

5. **Run test** → GREEN (passes):
```bash
npm test -- feature.spec.ts
```

6. **Refactor** → Improve code quality

7. **Run test** → Still GREEN

8. **Commit**:
```bash
git add .
git commit -m "feat: add feature with tests"
```

### For Fixing Failing Tests

**NEVER modify the test expectations!**

1. **Identify root cause** - Why is implementation failing?
2. **Fix the implementation** - Not the test
3. **Verify test passes** - Run the specific test
4. **Run full suite** - Ensure no regressions
5. **Document the fix** - Update TEST_EXECUTION_REPORT.md

---

## 🆘 Troubleshooting

### Tests Hanging

**Problem**: Tests run forever, never complete

**Solution**:
```bash
npm test -- --detectOpenHandles --runInBand
```

This shows what's keeping Node process alive.

**Common Causes**:
- Database connections not closed
- Redis connections not closed
- setTimeout/setInterval not cleared
- Event listeners not removed

**Fix Pattern**:
```typescript
afterEach(async () => {
  await connection.close();
  await redisClient.quit();
  clearAllTimers();
});
```

### Module Not Found

**Problem**: `Cannot find module '@soc-compliance/shared-events'`

**Solution**:
```bash
npm run build:shared
```

**Always** build shared packages before running tests.

### Strange Test Behavior

**Problem**: Tests pass individually but fail in suite, or vice versa

**Solution**:
```bash
# Clear Jest cache
npm test -- --clearCache

# Run in band (one at a time)
npm test -- --runInBand
```

**Cause**: Usually test pollution - one test affecting another

**Fix**: Ensure proper cleanup in `afterEach`/`afterAll`

### Database Connection Errors

**Problem**: `ECONNREFUSED` or `Connection terminated`

**Check**:
```bash
# Is postgres running?
docker ps | findstr postgres

# Can you connect?
docker exec overmatch-digital-postgres-1 psql -U soc_user -c "SELECT 1"
```

**Fix**:
```bash
# Restart infrastructure
.\start-docker-services.ps1
```

---

## 📈 Coverage Requirements

### Targets

- **Unit Tests**: 80% minimum coverage
- **Integration Tests**: All critical paths
- **E2E Tests**: All user workflows

### Checking Coverage

```bash
npm test -- --coverage

# Generate HTML report
npm test -- --coverage --coverageReporters=html
```

### What to Cover

**Must Cover**:
- ✅ Business logic
- ✅ Error handling
- ✅ Security controls
- ✅ Data validation
- ✅ State transitions

**Don't Need to Cover**:
- Configuration files
- Type definitions
- Auto-generated code
- Simple getters/setters

---

## 🔗 Related Resources

- [TEST_EXECUTION_REPORT.md](../TEST_EXECUTION_REPORT.md) - Detailed test results
- [STATUS.md](STATUS.md) - Platform status
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues

---

**Last Updated**: October 6, 2025
**Next Review**: After fixing Auth Jest config and database setup
**Maintainer**: Development Team
