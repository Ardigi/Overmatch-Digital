#!/usr/bin/env node

/**
 * Evidence Service Test Script
 *
 * This script tests all Evidence Service endpoints including:
 * - Evidence CRUD operations
 * - Evidence-Control linking
 * - Evidence approval/rejection workflows
 * - Bulk operations
 * - Querying and filtering
 *
 * Prerequisites:
 * - Evidence Service running on port 3005
 * - Valid JWT token (from auth service)
 * - Test control created in Control Service
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3005';
const AUTH_URL = 'http://localhost:3001';

// Test data
let authToken = '';
let userId = '';
let organizationId = '';
let testEvidenceId = '';
let testControlId = '';

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null, isFormData = false) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Kong-Consumer-Id': userId,
        'X-Kong-Consumer-Custom-Id': userId,
        'X-Kong-Consumer-Username': 'testuser',
      },
    };

    if (data) {
      if (isFormData) {
        config.data = data;
        config.headers = { ...config.headers, ...data.getHeaders() };
      } else {
        config.data = data;
        config.headers['Content-Type'] = 'application/json';
      }
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
}

// Test functions
async function getAuthToken() {
  console.log('\n🔐 Getting auth token...');
  try {
    const response = await axios.post(`${AUTH_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'Admin123!@#',
    });

    authToken = response.data.accessToken;
    userId = response.data.user.id;
    organizationId = response.data.user.organization.id;

    console.log('✅ Auth token obtained');
    console.log(`   User ID: ${userId}`);
    console.log(`   Organization ID: ${organizationId}`);
  } catch (error) {
    console.error('❌ Failed to get auth token:', error.message);
    throw error;
  }
}

async function createTestControl() {
  console.log('\n🎯 Creating test control...');
  try {
    // First, get a control from Control Service
    const controlResponse = await axios.get('http://localhost:3004/controls', {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Kong-Consumer-Id': userId,
        'X-Kong-Consumer-Custom-Id': userId,
        'X-Kong-Consumer-Username': 'testuser',
      },
    });

    if (controlResponse.data.data && controlResponse.data.data.length > 0) {
      testControlId = controlResponse.data.data[0].id;
      console.log(`✅ Using existing control: ${testControlId}`);
    } else {
      console.log('⚠️  No controls found, will create evidence without control');
    }
  } catch (_error) {
    console.log('⚠️  Could not get control, continuing without it');
  }
}

async function testCreateEvidence() {
  console.log('\n📄 Testing evidence creation...');

  const evidenceData = {
    title: 'Security Policy Document',
    description: 'Annual security policy review and update for 2024',
    type: 'POLICY',
    source: 'MANUAL_UPLOAD',
    confidentialityLevel: 'CONFIDENTIAL',
    clientId: organizationId,
    controlId: testControlId || null,
    effectiveDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    tags: ['security', 'policy', '2024'],
    keywords: ['information security', 'access control', 'data protection'],
    metadata: {
      fileName: 'security_policy_2024.pdf',
      fileSize: 1024000,
      mimeType: 'application/pdf',
      customFields: {
        department: 'IT Security',
        reviewer: 'John Doe',
        version: '2.0',
      },
    },
  };

  try {
    const result = await makeRequest('POST', '/evidence', evidenceData);
    testEvidenceId = result.id;
    console.log('✅ Evidence created:', result.id);
    console.log(`   Title: ${result.title}`);
    console.log(`   Status: ${result.status}`);
  } catch (error) {
    console.error('❌ Failed to create evidence:', error.message);
    throw error;
  }
}

async function testUploadEvidence() {
  console.log('\n📤 Testing evidence upload with file...');

  // Create a test file
  const testFilePath = path.join(__dirname, 'test-evidence.txt');
  fs.writeFileSync(testFilePath, 'This is a test evidence file for SOC compliance.');

  const form = new FormData();
  form.append('file', fs.createReadStream(testFilePath));
  form.append('title', 'Test Evidence Upload');
  form.append('description', 'Evidence uploaded via test script');
  form.append('type', 'DOCUMENT');
  form.append('source', 'MANUAL_UPLOAD');
  form.append('clientId', organizationId);

  try {
    const result = await makeRequest('POST', '/evidence/upload', form, true);
    console.log('✅ Evidence uploaded:', result.id);
    console.log(`   File: ${result.metadata?.fileName}`);
    console.log(`   Size: ${result.metadata?.fileSize} bytes`);

    // Clean up test file
    fs.unlinkSync(testFilePath);
  } catch (error) {
    console.error('❌ Failed to upload evidence:', error.message);
    // Clean up test file on error
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

async function testGetEvidence() {
  console.log('\n🔍 Testing get evidence...');

  try {
    const result = await makeRequest('GET', `/evidence/${testEvidenceId}`);
    console.log('✅ Evidence retrieved:', result.id);
    console.log(`   Title: ${result.title}`);
    console.log(`   View Count: ${result.viewCount}`);
    console.log(`   Completion: ${result.completionPercentage}%`);
  } catch (error) {
    console.error('❌ Failed to get evidence:', error.message);
  }
}

async function testQueryEvidence() {
  console.log('\n🔎 Testing evidence queries...');

  const queries = [
    { name: 'All evidence', params: '' },
    { name: 'By type', params: '?type=POLICY' },
    { name: 'By status', params: '?status=DRAFT' },
    { name: 'Expiring soon', params: '?expiringSoon=true' },
    { name: 'With search', params: '?search=security' },
    { name: 'With metrics', params: '?includeMetrics=true' },
  ];

  for (const query of queries) {
    try {
      const result = await makeRequest('GET', `/evidence${query.params}`);
      console.log(`✅ Query "${query.name}": ${result.data.length} results`);
      if (result.meta?.metrics) {
        console.log(`   Metrics:`, JSON.stringify(result.meta.metrics, null, 2));
      }
    } catch (error) {
      console.error(`❌ Query "${query.name}" failed:`, error.message);
    }
  }
}

async function testLinkToControl() {
  console.log('\n🔗 Testing evidence-control linking...');

  if (!testControlId) {
    console.log('⚠️  No test control available, skipping');
    return;
  }

  const linkData = {
    controlId: testControlId,
    organizationId: organizationId,
    framework: 'SOC2',
    controlCode: 'CC1.1',
    metadata: {
      mappingType: 'primary',
      relevanceScore: 0.95,
      notes: 'Primary evidence for control environment',
    },
  };

  try {
    const _result = await makeRequest('POST', `/evidence/${testEvidenceId}/link-control`, linkData);
    console.log('✅ Evidence linked to control');
    console.log(`   Control ID: ${linkData.controlId}`);
    console.log(`   Framework: ${linkData.framework}`);
    console.log(`   Mapping Type: ${linkData.metadata.mappingType}`);
  } catch (error) {
    console.error('❌ Failed to link evidence to control:', error.message);
  }
}

async function testBulkLinkToControl() {
  console.log('\n🔗 Testing bulk evidence-control linking...');

  if (!testControlId) {
    console.log('⚠️  No test control available, skipping');
    return;
  }

  // Create additional evidence items for bulk linking
  const evidenceIds = [testEvidenceId];

  for (let i = 0; i < 2; i++) {
    try {
      const evidence = await makeRequest('POST', '/evidence', {
        title: `Bulk Evidence ${i + 1}`,
        description: 'Evidence for bulk linking test',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        clientId: organizationId,
      });
      evidenceIds.push(evidence.id);
    } catch (_error) {
      console.error(`Failed to create bulk evidence ${i + 1}`);
    }
  }

  const bulkLinkData = {
    evidenceIds: evidenceIds,
    controlId: testControlId,
    organizationId: organizationId,
    framework: 'ISO27001',
  };

  try {
    const result = await makeRequest('POST', '/evidence/bulk/link-control', bulkLinkData);
    console.log('✅ Bulk link completed');
    console.log(`   Linked: ${result.linked}`);
    console.log(`   Failed: ${result.failed.length}`);
  } catch (error) {
    console.error('❌ Failed bulk link:', error.message);
  }
}

async function testGetEvidenceByControl() {
  console.log('\n🎯 Testing get evidence by control...');

  if (!testControlId) {
    console.log('⚠️  No test control available, skipping');
    return;
  }

  try {
    // Test simple get by control
    const result1 = await makeRequest('GET', `/evidence/control/${testControlId}`);
    console.log(`✅ Evidence by control: ${result1.length} items`);

    // Test filtered search
    const searchData = {
      controlId: testControlId,
      organizationId: organizationId,
      includeArchived: false,
      includeExpired: false,
      status: 'DRAFT',
    };

    const result2 = await makeRequest('POST', '/evidence/control/search', searchData);
    console.log(`✅ Filtered evidence: ${result2.length} items`);

    // Test control summary
    const summary = await makeRequest(
      'GET',
      `/evidence/control/${testControlId}/summary?organizationId=${organizationId}`
    );
    console.log('✅ Control evidence summary:');
    console.log(`   Total: ${summary.total}`);
    console.log(`   Approved: ${summary.approved}`);
    console.log(`   Coverage: ${summary.coverage.toFixed(2)}%`);
  } catch (error) {
    console.error('❌ Failed to get evidence by control:', error.message);
  }
}

async function testUpdateEvidence() {
  console.log('\n✏️  Testing evidence update...');

  const updateData = {
    description: 'Updated security policy with new requirements',
    status: 'PENDING_REVIEW',
    tags: ['security', 'policy', '2024', 'updated'],
    metadata: {
      fileName: 'security_policy_2024_v2.pdf',
      fileSize: 1124000,
      mimeType: 'application/pdf',
      customFields: {
        department: 'IT Security',
        reviewer: 'Jane Smith',
        version: '2.1',
        changeLog: 'Added cloud security section',
      },
    },
  };

  try {
    const result = await makeRequest('PATCH', `/evidence/${testEvidenceId}`, updateData);
    console.log('✅ Evidence updated');
    console.log(`   Status: ${result.status}`);
    console.log(`   Version: ${result.metadata?.customFields?.version}`);
  } catch (error) {
    console.error('❌ Failed to update evidence:', error.message);
  }
}

async function testApproveEvidence() {
  console.log('\n✅ Testing evidence approval...');

  try {
    const result = await makeRequest('POST', `/evidence/${testEvidenceId}/approve`, {
      comments: 'Evidence meets all requirements and has been verified',
    });
    console.log('✅ Evidence approved');
    console.log(`   Status: ${result.status}`);
    console.log(`   Approved by: ${result.approvedBy}`);
    console.log(`   Approved date: ${result.approvedDate}`);
  } catch (error) {
    console.error('❌ Failed to approve evidence:', error.message);
  }
}

async function testRejectEvidence() {
  console.log('\n❌ Testing evidence rejection...');

  // Create a new evidence to reject
  try {
    const evidence = await makeRequest('POST', '/evidence', {
      title: 'Evidence to Reject',
      description: 'This evidence will be rejected',
      type: 'DOCUMENT',
      source: 'MANUAL_UPLOAD',
      clientId: organizationId,
      status: 'PENDING_REVIEW',
    });

    // Update to pending review
    await makeRequest('PATCH', `/evidence/${evidence.id}`, {
      status: 'PENDING_REVIEW',
    });

    const result = await makeRequest('POST', `/evidence/${evidence.id}/reject`, {
      reason: 'Document is outdated and missing required sections',
    });
    console.log('✅ Evidence rejected');
    console.log(`   Status: ${result.status}`);
    console.log(`   Review comments: ${result.reviewComments?.length}`);
  } catch (error) {
    console.error('❌ Failed to reject evidence:', error.message);
  }
}

async function testVersionHistory() {
  console.log('\n📚 Testing version history...');

  try {
    // Create a new version
    const newVersionData = {
      title: 'Security Policy Document (Version 2)',
      description: 'Updated security policy with cloud requirements',
      type: 'POLICY',
      source: 'MANUAL_UPLOAD',
      clientId: organizationId,
      controlId: testControlId || null,
    };

    const newVersion = await makeRequest(
      'POST',
      `/evidence/${testEvidenceId}/new-version`,
      newVersionData
    );
    console.log('✅ New version created:', newVersion.id);
    console.log(`   Version: ${newVersion.version}`);

    // Get version history
    const history = await makeRequest('GET', `/evidence/${testEvidenceId}/versions`);
    console.log(`✅ Version history: ${history.length} versions`);
    history.forEach(v => {
      console.log(`   - Version ${v.version}: ${v.title} (Latest: ${v.isLatestVersion})`);
    });
  } catch (error) {
    console.error('❌ Failed to test version history:', error.message);
  }
}

async function testBulkOperations() {
  console.log('\n📦 Testing bulk operations...');

  // Create evidence for bulk operations
  const bulkEvidenceIds = [];
  for (let i = 0; i < 3; i++) {
    try {
      const evidence = await makeRequest('POST', '/evidence', {
        title: `Bulk Operation Evidence ${i + 1}`,
        description: 'Evidence for bulk operations test',
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        clientId: organizationId,
      });
      bulkEvidenceIds.push(evidence.id);
    } catch (_error) {
      console.error(`Failed to create bulk evidence ${i + 1}`);
    }
  }

  // Test bulk update
  try {
    const bulkUpdateResult = await makeRequest('POST', '/evidence/bulk/update', {
      evidenceIds: bulkEvidenceIds,
      status: 'COLLECTED',
      tags: ['bulk-updated', 'test'],
    });
    console.log('✅ Bulk update completed');
    console.log(`   Updated: ${bulkUpdateResult.updated}`);
    console.log(`   Failed: ${bulkUpdateResult.failed.length}`);
  } catch (error) {
    console.error('❌ Failed bulk update:', error.message);
  }

  // Test bulk delete
  try {
    const bulkDeleteResult = await makeRequest('POST', '/evidence/bulk/delete', {
      evidenceIds: bulkEvidenceIds.slice(0, 2),
      reason: 'Test cleanup',
    });
    console.log('✅ Bulk delete completed');
    console.log(`   Deleted: ${bulkDeleteResult.deleted}`);
    console.log(`   Failed: ${bulkDeleteResult.failed.length}`);
  } catch (error) {
    console.error('❌ Failed bulk delete:', error.message);
  }
}

async function testExpiringEvidence() {
  console.log('\n⏰ Testing expiring evidence...');

  try {
    const result = await makeRequest('GET', '/evidence/expiring?daysAhead=30');
    console.log(`✅ Expiring evidence (30 days): ${result.length} items`);

    if (result.length > 0) {
      result.slice(0, 3).forEach(e => {
        console.log(
          `   - ${e.title} expires on ${new Date(e.expirationDate).toLocaleDateString()}`
        );
      });
    }
  } catch (error) {
    console.error('❌ Failed to get expiring evidence:', error.message);
  }
}

async function testUnlinkFromControl() {
  console.log('\n🔓 Testing evidence-control unlinking...');

  if (!testControlId || !testEvidenceId) {
    console.log('⚠️  No test data available, skipping');
    return;
  }

  try {
    const result = await makeRequest('DELETE', `/evidence/${testEvidenceId}/unlink-control`, {
      controlId: testControlId,
      removeFromFramework: true,
    });
    console.log('✅ Evidence unlinked from control');
    console.log(`   Control ID removed: ${!result.controlId}`);
  } catch (error) {
    console.error('❌ Failed to unlink evidence:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Evidence Service Test Suite');
  console.log('================================');

  try {
    // Setup
    await getAuthToken();
    await createTestControl();

    // Test CRUD operations
    await testCreateEvidence();
    await testUploadEvidence();
    await testGetEvidence();
    await testQueryEvidence();
    await testUpdateEvidence();

    // Test control linking
    await testLinkToControl();
    await testBulkLinkToControl();
    await testGetEvidenceByControl();

    // Test workflows
    await testApproveEvidence();
    await testRejectEvidence();
    await testVersionHistory();

    // Test bulk operations
    await testBulkOperations();

    // Test queries
    await testExpiringEvidence();

    // Test unlinking
    await testUnlinkFromControl();

    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
