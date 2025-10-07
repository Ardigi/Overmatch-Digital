# Testing Guide - SOC Compliance Platform

## Overview

Comprehensive testing guide for the SOC Compliance Platform, covering unit, integration, and end-to-end testing strategies.

---

## 🎯 Testing Philosophy

### Core Principles
1. **Test-Driven Development (TDD)**: Tests define the specification
2. **Never modify tests to pass**: Fix the implementation instead
3. **Tests are the source of truth**: Implementation must match test expectations
4. **Type safety in tests**: Use proper TypeScript patterns, avoid `as any` in production code

---

## 🧪 Test Types

### Unit Tests
- **Coverage Target**: 80% minimum
- **Location**: `[service]/test/unit/`
- **Framework**: Jest
- **Pattern**: Manual instantiation for TypeORM entities

### Integration Tests
- **Coverage**: All service interactions
- **Location**: `[service]/test/integration/`
- **Requirements**: Infrastructure running (PostgreSQL, Redis, Kafka)
- **Framework**: Jest + Supertest

### E2E Tests
- **Coverage**: Critical user flows
- **Location**: `e2e/` and `[service]/test/e2e/`
- **Framework**: Jest + Puppeteer/Playwright
- **Requirements**: All services running

---

## 🚀 Quick Start

### Running Tests

```bash
# Unit tests
cd services/[service] && npm test
npm test -- --coverage                      # With coverage
npm test -- --testNamePattern="specific"    # Specific test
npm test -- src/path/to/test.spec.ts       # Specific file

# Integration tests
npm run test:integration:verify            # Check infrastructure
npm run test:integration                   # Run all
npm run test:integration:auth              # Specific service
npm run test:integration:redis             # Category tests

# E2E tests
npm run test:e2e                          # All services
npm run test:e2e:auth                     # Specific service
npm run e2e:cleanup                       # Clean test data

# Fix common issues
npm test -- --clearCache                   # Clear Jest cache
npm test -- --detectOpenHandles --runInBand # Fix hanging tests
```

---

## 💡 Testing Patterns

### Manual Instantiation Pattern (TypeORM/Jest)

```typescript
// ✅ CORRECT - Manual instantiation for TypeORM
describe('ServiceWithTypeORM', () => {
  let service: ServiceWithTypeORM;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      find: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    
    service = new ServiceWithTypeORM(mockRepository);
  });

  it('should find all entities', async () => {
    const expected = [{ id: 1, name: 'test' }];
    mockRepository.find.mockResolvedValue(expected);
    
    const result = await service.findAll();
    
    expect(result).toEqual(expected);
    expect(mockRepository.find).toHaveBeenCalledWith();
  });
});

// ❌ WRONG - Fails with TypeORM entities
const module = await Test.createTestingModule({
  providers: [ServiceWithTypeORM],
}).compile();
```

### Type-Safe Test Patterns

```typescript
// ✅ TEST CODE - Mock injection acceptable
describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockJwtService = { sign: jest.fn(), verify: jest.fn() };
    mockConfigService = { get: jest.fn() };
    
    // Partial mocks OK in tests
    service = new AuthService(
      mockJwtService as any,
      mockConfigService as any,
    );
  });
});

// ❌ PRODUCTION CODE - Never use 'as any'
// This should be in implementation, not tests
const result = (value as any).property; // Fix the actual type
```

### Error Testing Pattern

```typescript
// ✅ CORRECT - Type-safe error testing
it('should reject invalid input', async () => {
  const invalidDto = {
    ...validDto,
    email: 'invalid' as unknown as string, // Proper casting for invalid data
  };
  
  await expect(service.create(invalidDto))
    .rejects
    .toThrow(ValidationException);
});
```

---

## 📊 Test Coverage Standards

### Service-Specific Requirements

| Service | Unit Coverage | Integration | E2E | Status |
|---------|---------------|-------------|-----|--------|
| Auth | 80%+ | Required | Required | ✅ 100% tests pass |
| Client | 80%+ | Required | Required | ✅ 90% tests pass |
| Policy | 80%+ | Required | Required | ⚠️ 58% tests pass |
| Control | 80%+ | Required | Required | ✅ 100% tests pass |
| Evidence | 80%+ | Required | Optional | ✅ 100% tests pass |
| Others | 70%+ | Optional | Optional | ⚠️ Pending |

---

## 🔧 Jest Configuration

### Base Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'typeorm': '<rootDir>/src/__mocks__/typeorm.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
};
```

### Windows-Specific Configuration

```javascript
// For Windows environments
module.exports = {
  ...baseConfig,
  testTimeout: 30000, // Longer timeout for Windows
  maxWorkers: '50%', // Limit parallel execution
};
```

---

## 🐛 Common Issues & Solutions

### Tests Hanging

```bash
# Solution 1: Clear cache
npm test -- --clearCache

# Solution 2: Run in band
npm test -- --detectOpenHandles --runInBand

# Solution 3: Increase timeout
npm test -- --testTimeout=30000
```

### TypeORM Test Failures

```typescript
// Problem: Test.createTestingModule fails with TypeORM
// Solution: Use manual instantiation pattern (see above)
```

### Database Connection Issues

```typescript
// Windows: Use 127.0.0.1 instead of localhost
const testConfig = {
  host: process.platform === 'win32' ? '127.0.0.1' : 'localhost',
  port: 5432,
  database: 'soc_test',
};
```

### Mock TypeORM Repository

```typescript
// Create reusable mock factory
export const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  })),
});
```

---

## 🎯 Integration Testing

### Setup Infrastructure

```bash
# Start required services
docker-compose up -d postgres redis kafka

# Verify infrastructure
npm run test:integration:verify

# Run integration tests
npm run test:integration
```

### Integration Test Pattern

```typescript
describe('Service Integration', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = module.createNestApplication();
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('should handle cross-service communication', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(201);
      
    expect(response.body).toHaveProperty('id');
  });
});
```

---

## 🌐 E2E Testing

### E2E Test Structure

```typescript
describe('User Flow E2E', () => {
  let browser: Browser;
  let page: Page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  it('should complete user registration flow', async () => {
    await page.goto('http://localhost:3000');
    await page.click('[data-testid="register-button"]');
    await page.type('[name="email"]', 'test@example.com');
    await page.type('[name="password"]', 'Test123!');
    await page.click('[type="submit"]');
    
    await page.waitForSelector('[data-testid="dashboard"]');
    const url = page.url();
    expect(url).toContain('/dashboard');
  });
});
```

### E2E Data Management

```bash
# Seed test data
npm run e2e:seed

# Run E2E tests
npm run test:e2e

# Clean up test data
npm run e2e:cleanup
```

---

## 📈 Monitoring Test Quality

### Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Test Performance

```bash
# Profile test performance
npm test -- --logHeapUsage

# Find slow tests
npm test -- --verbose
```

---

## ✅ Testing Checklist

### Before Committing
- [ ] All unit tests pass
- [ ] Coverage meets minimum (80%)
- [ ] No `as any` in production code
- [ ] Integration tests pass (if applicable)
- [ ] No console.log statements
- [ ] Type checking passes (`npx tsc --noEmit`)

### Before Release
- [ ] All E2E tests pass
- [ ] Performance tests pass
- [ ] Security tests pass
- [ ] Load tests complete
- [ ] Cross-browser testing done

---

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Supertest](https://github.com/visionmedia/supertest)
- [Puppeteer](https://pptr.dev/)

---

## 🔍 Service-Specific Testing Notes

### Auth Service
- 401 unit tests, 100% passing
- Requires Redis for session tests
- JWT token generation/validation tests critical

### Control Service
- 303 unit tests, 100% passing
- Encryption tests require MASTER_ENCRYPTION_KEY
- Multi-tenant isolation tests important

### Policy Service
- 609 total tests, 58% passing
- Complex business logic requires thorough testing
- Event emission tests for Kafka integration

### Evidence Service
- Type safety issues need resolution
- File upload tests require mock S3
- Metadata extraction tests important