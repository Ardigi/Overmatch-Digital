/**
 * Service Integration Test Script
 * Tests inter-service communication after fixing missing endpoints
 */

const axios = require('axios');

// Service configuration
const services = {
  'auth-service': { port: 3001, baseUrl: 'http://localhost:3001/api/v1' },
  'client-service': { port: 3002, baseUrl: 'http://localhost:3002/api/v1' },
  'policy-service': { port: 3003, baseUrl: 'http://localhost:3003/api/v1' },
  'control-service': { port: 3004, baseUrl: 'http://localhost:3004/api/v1' },
  'evidence-service': { port: 3005, baseUrl: 'http://localhost:3005/api/v1' },
  'workflow-service': { port: 3006, baseUrl: 'http://localhost:3006/api/v1' },
  'reporting-service': { port: 3007, baseUrl: 'http://localhost:3007/api/v1' },
  'audit-service': { port: 3008, baseUrl: 'http://localhost:3008/api/v1' },
  'integration-service': { port: 3009, baseUrl: 'http://localhost:3009/api/v1' },
  'notification-service': { port: 3010, baseUrl: 'http://localhost:3010/api/v1' },
  'ai-service': { port: 3011, baseUrl: 'http://localhost:3011/api/v1' },
};

// Test cases for inter-service communication
const testCases = [
  {
    name: 'Integration Service → Evidence Service (Get Insights)',
    from: 'integration-service',
    to: 'evidence-service',
    request: {
      method: 'GET',
      path: '/evidence/insights/test-org-123?integrationId=int-456',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'integration-service',
        'X-Organization-Id': 'test-org-123',
      },
    },
    expect: {
      status: 200,
      hasData: true,
      fields: ['organizationId', 'statistics', 'collectionTrends'],
    },
  },
  {
    name: 'Multiple Services → Audit Service (Log Events)',
    from: 'workflow-service',
    to: 'audit-service',
    request: {
      method: 'POST',
      path: '/events',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'workflow-service',
      },
      data: {
        action: 'workflow.started',
        resource: 'workflow',
        resourceId: 'wf-123',
        userId: 'user-456',
        organizationId: 'org-789',
        details: {
          workflowName: 'Evidence Collection',
          triggerType: 'manual',
        },
      },
    },
    expect: {
      status: 201,
      hasData: true,
      fields: ['success', 'data'],
    },
  },
  {
    name: 'AI Service → Audit Service (Get Finding)',
    from: 'ai-service',
    to: 'audit-service',
    request: {
      method: 'GET',
      path: '/findings/finding-123',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'ai-service',
      },
    },
    expect: {
      status: 200,
      hasData: true,
      fields: ['id', 'controlId', 'severity', 'status'],
    },
  },
  {
    name: 'Integration Service → Workflow Service (Trigger Workflow)',
    from: 'integration-service',
    to: 'workflow-service',
    request: {
      method: 'POST',
      path: '/workflows/trigger',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'integration-service',
      },
      data: {
        workflowName: 'Evidence Processing',
        workflowType: 'automated',
        triggerType: 'webhook',
        sourceService: 'integration-service',
        organizationId: 'org-123',
        clientId: 'client-456',
        data: {
          webhookId: 'webhook-789',
          payload: { test: true },
        },
      },
    },
    expect: {
      status: 201,
      hasData: true,
      fields: ['success', 'data'],
    },
  },
  {
    name: 'Integration Service → Workflow Service (Get Insights)',
    from: 'integration-service',
    to: 'workflow-service',
    request: {
      method: 'GET',
      path: '/workflows/insights/org-123?integrationId=int-456',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'integration-service',
      },
    },
    expect: {
      status: 200,
      hasData: true,
      fields: ['organizationId', 'statistics', 'executionTrends'],
    },
  },
  {
    name: 'Evidence Service → Control Service (Get Requirements)',
    from: 'evidence-service',
    to: 'control-service',
    request: {
      method: 'GET',
      path: '/controls/control-123/requirements?organizationId=org-456',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'evidence-service',
      },
    },
    expect: {
      status: 200,
      hasData: true,
      fields: ['controlId', 'evidenceRequirements', 'collectionGuidance'],
    },
  },
  {
    name: 'Integration Service → Notification Service (Send Notification)',
    from: 'integration-service',
    to: 'notification-service',
    request: {
      method: 'POST',
      path: '/notifications',
      headers: {
        'X-Internal-Request': 'true',
        'X-Service-Name': 'integration-service',
      },
      data: {
        type: 'webhook_received',
        title: 'Webhook Processed',
        message: 'Integration webhook has been processed successfully',
        recipientId: 'user-123',
        organizationId: 'org-456',
        priority: 'medium',
        channel: 'in-app',
      },
    },
    expect: {
      status: 201,
      hasData: true,
    },
  },
];

// Helper function to test a single endpoint
async function testEndpoint(testCase) {
  const { from, to, request, expect: expected } = testCase;
  const toService = services[to];

  console.log(`\n📋 Testing: ${testCase.name}`);
  console.log(`   From: ${from} → To: ${to}`);
  console.log(`   ${request.method} ${toService.baseUrl}${request.path}`);

  try {
    const config = {
      method: request.method,
      url: `${toService.baseUrl}${request.path}`,
      headers: request.headers || {},
      data: request.data,
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    };

    const response = await axios(config);

    // Check status
    const statusOk = response.status === expected.status;
    console.log(
      `   Status: ${response.status} ${statusOk ? '✅' : '❌'} (expected ${expected.status})`
    );

    // Check response data
    if (expected.hasData) {
      const hasData = response.data && Object.keys(response.data).length > 0;
      console.log(`   Has Data: ${hasData ? '✅' : '❌'}`);

      // Check specific fields
      if (expected.fields && response.data) {
        for (const field of expected.fields) {
          const hasField = field.includes('.')
            ? field.split('.').reduce((obj, key) => obj && obj[key], response.data) !== undefined
            : response.data[field] !== undefined;
          console.log(`   Field '${field}': ${hasField ? '✅' : '❌'}`);
        }
      }
    }

    return {
      success: statusOk,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 SOC Compliance Platform - Service Integration Tests');
  console.log('='.repeat(60));
  console.log('Testing inter-service communication with fixed endpoints...\n');

  // First, check if services are running
  console.log('🔍 Checking service availability...');
  const availableServices = [];

  for (const [name, service] of Object.entries(services)) {
    try {
      await axios.get(`${service.baseUrl}/health`, {
        timeout: 2000,
        validateStatus: () => true,
      });
      availableServices.push(name);
      console.log(`   ${name}: ✅ Available`);
    } catch (error) {
      console.log(`   ${name}: ❌ Not reachable`);
    }
  }

  if (availableServices.length === 0) {
    console.log('\n❌ No services are running! Please start the services first.');
    console.log('Run: .\\start-docker-services.ps1');
    return;
  }

  console.log(
    `\n📊 ${availableServices.length}/${Object.keys(services).length} services available`
  );

  // Run test cases
  console.log('\n🧪 Running Integration Tests...');
  console.log('='.repeat(60));

  const results = [];
  for (const testCase of testCases) {
    // Only run test if both services are available
    if (availableServices.includes(testCase.from) && availableServices.includes(testCase.to)) {
      const result = await testEndpoint(testCase);
      results.push({ ...testCase, result });
    } else {
      console.log(`\n⏭️  Skipping: ${testCase.name}`);
      console.log(`   Required services not available`);
    }
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter((r) => r.result.success).length;
  const failed = results.filter((r) => !r.result.success).length;
  const skipped = testCases.length - results.length;

  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Executed: ${results.length}`);
  console.log(`Successful: ${successful} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Skipped: ${skipped} ⏭️`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter((r) => !r.result.success)
      .forEach((r) => {
        console.log(`   - ${r.name}`);
        if (r.result.error) {
          console.log(`     Error: ${r.result.error}`);
        }
      });
  }

  console.log('\n✨ Integration test completed!');

  // Return success if all executed tests passed
  return failed === 0;
}

// Run the tests
runIntegrationTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
