#!/usr/bin/env node

/**
 * Control Service API Test Script
 *
 * This script tests the Control Service API endpoints including:
 * - Framework management
 * - Control CRUD operations
 * - Control assignments to organizations
 * - Control testing workflows
 * - Implementation tracking
 *
 * Usage: node test-control-service.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3004';
const AUTH_SERVICE_URL = 'http://localhost:3001';

// Test data
let authToken = '';
let testOrganizationId = '';
let testUserId = '';
let testControlId = '';
const testImplementationId = '';

// Helper function to make authenticated requests
const makeRequest = async (method, url, data = null) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

// Test setup - authenticate
async function authenticate() {
  console.log('\n🔐 Authenticating...');
  try {
    // First try to login with existing admin user
    const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
      email: 'admin@overmatch.com',
      password: 'Admin123!@#',
    });

    authToken = loginResponse.data.accessToken;
    testUserId = loginResponse.data.user.id;
    testOrganizationId = loginResponse.data.user.organization.id;

    console.log('✅ Authentication successful');
    console.log('   User ID:', testUserId);
    console.log('   Organization ID:', testOrganizationId);
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    console.log('\n💡 Tip: Make sure to run the auth service setup first');
    console.log('   Run: node test-auth.js');
    process.exit(1);
  }
}

// Test 1: Get all frameworks
async function testGetFrameworks() {
  console.log('\n📋 Test 1: Get all frameworks');
  try {
    const frameworks = await makeRequest('GET', '/frameworks');
    console.log('✅ Retrieved frameworks:', frameworks.length);
    frameworks.forEach((fw) => {
      console.log(`   - ${fw.displayName}: ${fw.totalControls} controls`);
    });
  } catch (error) {
    console.error('❌ Failed to get frameworks');
  }
}

// Test 2: Get framework requirements
async function testGetFrameworkRequirements() {
  console.log('\n📋 Test 2: Get SOC2 framework requirements');
  try {
    const requirements = await makeRequest('GET', '/frameworks/SOC2/requirements');
    console.log('✅ Retrieved SOC2 requirements');
    console.log('   Total categories:', requirements.requirements.length);
    requirements.requirements.forEach((cat) => {
      console.log(`   - ${cat.category}: ${cat.controls.length} controls`);
    });
  } catch (error) {
    console.error('❌ Failed to get framework requirements');
  }
}

// Test 3: Create a custom control
async function testCreateControl() {
  console.log('\n📋 Test 3: Create a custom control');
  try {
    const controlData = {
      controlCode: 'CUSTOM-001',
      name: 'Custom Security Control',
      description: 'Test custom control for API testing',
      category: 'Security',
      frameworks: ['CUSTOM'],
      type: 'PREVENTIVE',
      priority: 'HIGH',
      isActive: true,
      testProcedures: {
        steps: [
          {
            order: 1,
            description: 'Verify control implementation',
            expectedResult: 'Control is properly implemented',
          },
          {
            order: 2,
            description: 'Test control effectiveness',
            expectedResult: 'Control prevents unauthorized access',
          },
        ],
      },
      automationConfig: {
        isAutomated: false,
        automationType: 'MANUAL',
      },
    };

    const control = await makeRequest('POST', '/controls', controlData);
    testControlId = control.id;
    console.log('✅ Created control:', control.controlCode);
    console.log('   Control ID:', control.id);
  } catch (error) {
    console.error('❌ Failed to create control');
  }
}

// Test 4: Get all controls
async function testGetControls() {
  console.log('\n📋 Test 4: Get all controls');
  try {
    const controls = await makeRequest('GET', '/controls');
    console.log('✅ Retrieved controls:', controls.length);
    console.log('   Sample controls:');
    controls.slice(0, 5).forEach((ctrl) => {
      console.log(`   - ${ctrl.controlCode}: ${ctrl.name}`);
    });
  } catch (error) {
    console.error('❌ Failed to get controls');
  }
}

// Test 5: Get controls by framework
async function testGetControlsByFramework() {
  console.log('\n📋 Test 5: Get SOC2 controls');
  try {
    const controls = await makeRequest('GET', '/controls/framework/SOC2');
    console.log('✅ Retrieved SOC2 controls:', controls.length);
    console.log('   Categories:', [...new Set(controls.map((c) => c.category))].join(', '));
  } catch (error) {
    console.error('❌ Failed to get controls by framework');
  }
}

// Test 6: Assign framework to organization
async function testAssignFramework() {
  console.log('\n📋 Test 6: Assign SOC2 framework to organization');
  try {
    const assignment = await makeRequest('POST', '/controls/assign-framework', {
      organizationId: testOrganizationId,
      framework: 'SOC2',
      skipImplemented: true,
      onlyRequired: false,
    });
    console.log('✅ Assigned framework successfully');
    console.log('   Controls assigned:', assignment.assigned);
    console.log('   Controls skipped:', assignment.skipped);
  } catch (error) {
    console.error('❌ Failed to assign framework');
  }
}

// Test 7: Get organization controls
async function testGetOrganizationControls() {
  console.log('\n📋 Test 7: Get organization controls');
  try {
    const controls = await makeRequest('GET', `/controls/organization/${testOrganizationId}`);
    console.log('✅ Retrieved organization controls:', controls.length);

    // Count by status
    const statusCounts = {};
    controls.forEach((ctrl) => {
      const status = ctrl.implementation?.status || 'NOT_STARTED';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('   Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
  } catch (error) {
    console.error('❌ Failed to get organization controls');
  }
}

// Test 8: Update control implementation
async function testUpdateImplementation() {
  console.log('\n📋 Test 8: Update control implementation status');
  try {
    // Get a control to update
    const controls = await makeRequest(
      'GET',
      `/controls/organization/${testOrganizationId}?framework=SOC2`
    );
    if (controls.length === 0) {
      console.log('⚠️  No controls found to update');
      return;
    }

    const controlToUpdate = controls[0];
    const update = await makeRequest(
      'PUT',
      `/controls/organization/${testOrganizationId}/implementation/${controlToUpdate.id}`,
      {
        status: 'IN_PROGRESS',
        description: 'Started implementing this control',
        effectiveness: {
          score: 75,
          assessmentMethod: 'Initial assessment',
          strengths: ['Good documentation', 'Clear procedures'],
          weaknesses: ['Needs automation'],
          improvements: ['Implement automated testing'],
        },
      }
    );

    console.log('✅ Updated implementation status');
    console.log('   Control:', controlToUpdate.controlCode);
    console.log('   New status:', update.status);
  } catch (error) {
    console.error('❌ Failed to update implementation');
  }
}

// Test 9: Create control test
async function testCreateControlTest() {
  console.log('\n📋 Test 9: Create control test');
  try {
    // Get a control to test
    const controls = await makeRequest(
      'GET',
      `/controls/organization/${testOrganizationId}?framework=SOC2`
    );
    if (controls.length === 0) {
      console.log('⚠️  No controls found to test');
      return;
    }

    const controlToTest = controls[0];
    const testData = {
      controlId: controlToTest.id,
      organizationId: testOrganizationId,
      scheduledDate: new Date().toISOString(),
      method: 'MANUAL',
      frequency: 'QUARTERLY',
      testProcedures: {
        steps: [
          {
            order: 1,
            description: 'Review control documentation',
            expectedResult: 'Documentation is complete and up to date',
          },
          {
            order: 2,
            description: 'Test control effectiveness',
            expectedResult: 'Control operates as designed',
          },
        ],
      },
    };

    const test = await makeRequest('POST', '/control-tests', testData);
    console.log('✅ Created control test');
    console.log('   Test ID:', test.id);
    console.log('   Control:', controlToTest.controlCode);
    console.log('   Status:', test.status);
  } catch (error) {
    console.error('❌ Failed to create control test');
  }
}

// Test 10: Get control coverage metrics
async function testGetControlCoverage() {
  console.log('\n📋 Test 10: Get control coverage metrics');
  try {
    const coverage = await makeRequest('GET', `/controls/coverage/${testOrganizationId}`);
    console.log('✅ Retrieved coverage metrics');
    console.log('   Total controls:', coverage.totalControls);
    console.log('   Implemented:', coverage.implemented);
    console.log('   In progress:', coverage.inProgress);
    console.log('   Not started:', coverage.notStarted);
    console.log('   Coverage %:', coverage.coveragePercentage?.toFixed(2) + '%');
  } catch (error) {
    console.error('❌ Failed to get coverage metrics');
  }
}

// Test 11: Bulk update implementations
async function testBulkUpdateImplementations() {
  console.log('\n📋 Test 11: Bulk update control implementations');
  try {
    // Get multiple controls
    const controls = await makeRequest(
      'GET',
      `/controls/organization/${testOrganizationId}?framework=SOC2`
    );
    if (controls.length < 2) {
      console.log('⚠️  Not enough controls for bulk update');
      return;
    }

    const updates = controls.slice(0, 3).map((ctrl) => ({
      controlId: ctrl.id,
      status: 'IMPLEMENTED',
      description: 'Bulk update - control implemented',
    }));

    const result = await makeRequest(
      'PUT',
      `/controls/organization/${testOrganizationId}/implementations/bulk`,
      updates
    );

    console.log('✅ Bulk updated implementations');
    console.log('   Updated count:', result.updated);
  } catch (error) {
    console.error('❌ Failed to bulk update implementations');
  }
}

// Test 12: Get framework controls with implementation status
async function testGetFrameworkImplementationStatus() {
  console.log('\n📋 Test 12: Get SOC2 controls with implementation status');
  try {
    const controls = await makeRequest(
      'GET',
      `/controls/organization/${testOrganizationId}/framework/SOC2`
    );
    console.log('✅ Retrieved framework implementation status');
    console.log('   Total controls:', controls.length);

    // Show sample
    console.log('   Sample controls:');
    controls.slice(0, 3).forEach((ctrl) => {
      console.log(`   - ${ctrl.controlCode}: ${ctrl.implementationStatus || 'NOT_STARTED'}`);
    });
  } catch (error) {
    console.error('❌ Failed to get framework implementation status');
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Control Service API Tests');
  console.log('============================');

  try {
    // Authenticate first
    await authenticate();

    // Run all tests
    await testGetFrameworks();
    await testGetFrameworkRequirements();
    await testCreateControl();
    await testGetControls();
    await testGetControlsByFramework();
    await testAssignFramework();
    await testGetOrganizationControls();
    await testUpdateImplementation();
    await testCreateControlTest();
    await testGetControlCoverage();
    await testBulkUpdateImplementations();
    await testGetFrameworkImplementationStatus();

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
