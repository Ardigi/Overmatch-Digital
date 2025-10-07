# Service Test Patterns Documentation

This document outlines the testing patterns used across all services in the SOC Compliance Platform monorepo.

## Overview

Due to a known TypeORM/Jest compatibility issue, we use specific patterns for testing services that depend on their TypeORM usage.

## Test File Organization

- **Unit Tests**: `*.spec.ts` or `*.unit.spec.ts` - Mock all external dependencies
- **Integration Tests**: `*.integration.spec.ts` - Test with real database
- **E2E Tests**: `test/e2e/*.e2e-spec.ts` - Test complete API flows

## Pattern 1: Controller Tests (Consistent Pattern)

Controllers should mock all services they depend on. This pattern works consistently across all controllers.

```typescript
describe('ExampleController', () => {
  let controller: ExampleController;
  let service: ExampleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExampleController],
      providers: [
        {
          provide: ExampleService,
          useValue: {
            method1: jest.fn(),
            method2: jest.fn(),
            // Mock all methods used by the controller
          },
        },
      ],
    }).compile();

    controller = module.get<ExampleController>(ExampleController);
    service = module.get<ExampleService>(ExampleService);
  });

  // Test cases...
});
```

## Pattern 2: Service Tests with TypeORM (Direct Instantiation)

For services that use TypeORM repositories directly, use direct instantiation to avoid import issues:

```typescript
describe('ServiceWithTypeORM', () => {
  let service: ServiceWithTypeORM;
  let repository: Repository<Entity>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      // Mock all repository methods used
    } as any;

    service = new ServiceWithTypeORM(repository);
  });

  // Test cases...
});
```

## Pattern 3: Service Tests with TestingModule (No TypeORM)

For services that don't use TypeORM directly, you can use TestingModule:

```typescript
describe('ServiceWithoutTypeORM', () => {
  let service: ServiceWithoutTypeORM;
  let dependencyService: DependencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceWithoutTypeORM,
        {
          provide: DependencyService,
          useValue: {
            method1: jest.fn(),
            method2: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ServiceWithoutTypeORM>(ServiceWithoutTypeORM);
    dependencyService = module.get<DependencyService>(DependencyService);
  });

  // Test cases...
});
```

## Pattern 4: Service Tests with getRepositoryToken (Requires TypeORM Mock)

If you need to use TestingModule with TypeORM, ensure your service has TypeORM mocks configured:

1. Create `src/__mocks__/typeorm.ts` with all TypeORM exports
2. Configure Jest to use the mock in `jest.config.js`:

```javascript
module.exports = {
  // ... other config
  moduleNameMapper: {
    '^typeorm$': '<rootDir>/__mocks__/typeorm.ts',
    '^@nestjs/typeorm$': '<rootDir>/__mocks__/typeorm.ts',
  },
};
```

Then test with:

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';

describe('ServiceWithTypeORM', () => {
  let service: ServiceWithTypeORM;
  let repository: Repository<Entity>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceWithTypeORM,
        {
          provide: getRepositoryToken(Entity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            // Mock repository methods
          },
        },
      ],
    }).compile();

    service = module.get<ServiceWithTypeORM>(ServiceWithTypeORM);
    repository = module.get<Repository<Entity>>(getRepositoryToken(Entity));
  });

  // Test cases...
});
```

## Important Guidelines

### 1. NEVER Mock the Service Being Tested
The test should instantiate the actual service and test its real implementation:

```typescript
// ❌ WRONG - Don't do this
providers: [
  {
    provide: PoliciesService,
    useValue: { /* mocked service */ }
  }
]

// ✅ CORRECT - Test the actual service
providers: [
  PoliciesService, // Real service
  {
    provide: getRepositoryToken(Policy),
    useValue: { /* mocked repository */ }
  }
]
```

### 2. Mock All External Dependencies
- Repositories (TypeORM)
- Other services
- Event emitters
- Kafka producers
- External APIs

### 3. TypeORM Mock Requirements
Services using TypeORM need:
- `src/__mocks__/typeorm.ts` file
- Jest configuration with moduleNameMapper
- All TypeORM decorators and operators exported

### 4. Test Real Business Logic
- Don't simplify tests to make them pass
- Test both success and failure scenarios
- Include edge cases and validation

## Services with TypeORM Mocks Configured

- ✅ auth-service
- ✅ client-service  
- ✅ control-service
- ✅ policy-service
- ✅ audit-service

## Services without TypeORM (No Mock Needed)

- evidence-service (uses MongoDB)

## Example: Properly Testing a Service

Here's a complete example from policies.service.spec.ts:

```typescript
describe('PoliciesService', () => {
  let service: PoliciesService;
  let policyRepository: Repository<Policy>;
  let versionRepository: Repository<PolicyVersion>;
  let eventEmitter: EventEmitter2;

  const mockPolicyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesService, // Real service being tested
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(PolicyVersion),
          useValue: mockVersionRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<PoliciesService>(PoliciesService);
    // ... get other dependencies
  });

  it('should create a policy', async () => {
    const createPolicyDto = { /* ... */ };
    const mockPolicy = { /* ... */ };
    
    mockPolicyRepository.create.mockReturnValue(mockPolicy);
    mockPolicyRepository.save.mockResolvedValue(mockPolicy);

    const result = await service.create(createPolicyDto);

    expect(mockPolicyRepository.create).toHaveBeenCalledWith(createPolicyDto);
    expect(mockPolicyRepository.save).toHaveBeenCalledWith(mockPolicy);
    expect(result).toEqual(mockPolicy);
  });
});
```

## Troubleshooting

### "Class extends value undefined" Error
This indicates TypeORM is being imported without the mock. Check:
1. TypeORM mock file exists at `src/__mocks__/typeorm.ts`
2. Jest config has moduleNameMapper configured
3. The mock exports all required TypeORM components

### Service Not Found in TestingModule
Ensure you're providing the actual service class, not a mock, when testing that service.

### Repository Methods Not Mocked
Add all repository methods used by your service to the mock object.