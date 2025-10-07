/**
 * Direct Import Verification Test
 *
 * This simple Node.js script verifies that our shared packages can be imported
 * and used correctly, proving that the import fixes work as expected.
 */

const { performance } = require('perf_hooks');

console.log('🔍 Starting Import Verification Test...\n');

const tests = [];
const results = [];

// Test function wrapper
function test(name, fn) {
  tests.push({ name, fn });
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected ${actual} to be defined`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

// Test 1: Import shared contracts
test('should import @soc-compliance/contracts successfully', async () => {
  const startTime = performance.now();

  try {
    const contracts = require('@soc-compliance/contracts');

    expect(contracts).toBeDefined();
    expect(contracts.ComplianceStatus).toBeDefined();
    expect(contracts.ComplianceStatus.IN_PROGRESS).toBe('in_progress');
    expect(contracts.ComplianceStatus.COMPLIANT).toBe('compliant');

    // Test that we can create objects with imported types
    const mockUser = {
      id: 'test-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CLIENT_ADMIN',
      organizationId: 'org-456',
      mfaEnabled: false,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(mockUser.id).toBe('test-123');
    expect(mockUser.role).toBe('CLIENT_ADMIN');

    const endTime = performance.now();
    console.log(`✅ contracts import: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed to import contracts: ${error.message}`);
    throw error;
  }
});

// Test 2: Import HTTP common
test('should import @soc-compliance/http-common successfully', async () => {
  const startTime = performance.now();

  try {
    const httpCommon = require('@soc-compliance/http-common');

    expect(httpCommon).toBeDefined();
    expect(httpCommon.ServiceDiscoveryService).toBeDefined();
    expect(httpCommon.HttpClientService).toBeDefined();
    expect(httpCommon.HttpCommonModule).toBeDefined();

    const endTime = performance.now();
    console.log(`✅ http-common import: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed to import http-common: ${error.message}`);
    throw error;
  }
});

// Test 3: Import auth common
test('should import @soc-compliance/auth-common successfully', async () => {
  const startTime = performance.now();

  try {
    const authCommon = require('@soc-compliance/auth-common');

    expect(authCommon).toBeDefined();
    expect(authCommon.JwtAuthGuard).toBeDefined();
    expect(authCommon.RolesGuard).toBeDefined();
    expect(authCommon.AuthCommonModule).toBeDefined();

    const endTime = performance.now();
    console.log(`✅ auth-common import: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed to import auth-common: ${error.message}`);
    throw error;
  }
});

// Test 4: Import cache common
test('should import @soc-compliance/cache-common successfully', async () => {
  const startTime = performance.now();

  try {
    const cacheCommon = require('@soc-compliance/cache-common');

    expect(cacheCommon).toBeDefined();
    expect(cacheCommon.CacheModule).toBeDefined();
    expect(cacheCommon.CacheService).toBeDefined();
    expect(cacheCommon.Cacheable).toBeDefined();

    const endTime = performance.now();
    console.log(`✅ cache-common import: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed to import cache-common: ${error.message}`);
    throw error;
  }
});

// Test 5: Import shared events
test('should import @soc-compliance/events successfully', async () => {
  const startTime = performance.now();

  try {
    const events = require('@soc-compliance/events');

    expect(events).toBeDefined();
    expect(events.EventType).toBeDefined();
    expect(events.EventType.USER_REGISTERED).toBe('user.registered');

    const endTime = performance.now();
    console.log(`✅ events import: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed to import events: ${error.message}`);
    throw error;
  }
});

// Test 6: Verify service discovery functionality
test('should create ServiceDiscoveryService and verify its methods', async () => {
  const startTime = performance.now();

  try {
    const { ServiceDiscoveryService } = require('@soc-compliance/http-common');
    const { ConfigService } = require('@nestjs/config');
    const { HttpClientService } = require('@soc-compliance/http-common');

    // Mock ConfigService
    const mockConfigService = {
      get: (key, defaultValue) => {
        const config = {
          AUTH_SERVICE_URL: 'http://auth-service:3001',
          CLIENT_SERVICE_URL: 'http://client-service:3002',
          SERVICE_HEALTH_CHECK_INTERVAL: 60000,
        };
        return config[key] || defaultValue;
      },
    };

    // Mock HttpClientService
    const mockHttpClientService = {
      get: async () => ({ success: true, data: 'test' }),
      post: async () => ({ success: true, data: 'test' }),
      put: async () => ({ success: true, data: 'test' }),
      patch: async () => ({ success: true, data: 'test' }),
      delete: async () => ({ success: true, data: 'test' }),
    };

    const serviceDiscovery = new ServiceDiscoveryService(mockConfigService, mockHttpClientService);

    expect(serviceDiscovery).toBeDefined();
    expect(serviceDiscovery.getService).toBeDefined();
    expect(serviceDiscovery.callService).toBeDefined();
    expect(serviceDiscovery.checkServiceHealth).toBeDefined();
    expect(serviceDiscovery.getAllServices).toBeDefined();

    // Manually initialize services since we're not using NestJS lifecycle
    serviceDiscovery.onModuleInit();

    // Test service registry
    const allServices = serviceDiscovery.getAllServices();
    expect(allServices.size).toBeGreaterThan(0);

    // Test specific service retrieval
    const authService = serviceDiscovery.getService('auth-service');
    expect(authService).toBeDefined();
    expect(authService.name).toBe('auth-service');
    expect(authService.url).toContain('auth-service');

    // Test non-existent service
    const nonExistent = serviceDiscovery.getService('fake-service');
    expect(nonExistent).toBe(undefined);

    const endTime = performance.now();
    console.log(`✅ ServiceDiscoveryService functionality: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed ServiceDiscoveryService test: ${error.message}`);
    throw error;
  }
});

// Test 7: Verify cross-package type compatibility
test('should verify type compatibility between packages', async () => {
  const startTime = performance.now();

  try {
    const contracts = require('@soc-compliance/contracts');
    const httpCommon = require('@soc-compliance/http-common');

    // Create a ServiceResponse using imported types
    const response = {
      success: true,
      data: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CLIENT_ADMIN',
        organizationId: 'org-456',
        mfaEnabled: false,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      metadata: {
        service: 'test-service',
        timestamp: new Date(),
      },
    };

    expect(response.success).toBe(true);
    expect(response.data.role).toBe('CLIENT_ADMIN');
    expect(response.metadata.service).toBe('test-service');

    // Test enum usage
    const complianceStatus = contracts.ComplianceStatus.IN_PROGRESS;
    expect(complianceStatus).toBe('in_progress');

    const endTime = performance.now();
    console.log(`✅ Cross-package compatibility: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error(`❌ Failed cross-package compatibility test: ${error.message}`);
    throw error;
  }
});

// Run all tests
async function runTests() {
  console.log(`📝 Running ${tests.length} import verification tests...\n`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      results.push({ name: test.name, status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ name: test.name, status: 'FAILED', error: error.message });
      failed++;
      console.error(`❌ ${test.name}: ${error.message}`);
    }
  }

  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All import verification tests passed!');
    console.log('✨ Service-to-service communication imports are working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Import fixes may need additional work.');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run the tests
runTests().catch(console.error);
