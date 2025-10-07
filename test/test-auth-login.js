const axios = require('axios');

const AUTH_SERVICE_URL = 'http://localhost:3001';
const API_GATEWAY_URL = 'http://localhost:8000/api/auth';

async function runTests() {
  console.log('🧪 Running Auth Service Integration Tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Check if Auth Service is running
  console.log('Test 1: Auth Service Health Check');
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/health`);
    if (response.status === 200) {
      console.log('✅ PASSED: Auth Service is running');
      passed++;
    }
  } catch (error) {
    console.log('❌ FAILED: Auth Service is not running');
    console.log(`   Error: ${error.message}`);
    failed++;
    console.log('\n⚠️  Make sure Auth Service is running: docker-compose up -d auth-service');
    process.exit(1);
  }

  // Test 2: Invalid login should fail
  console.log('\nTest 2: Invalid Login Attempt');
  try {
    await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    });
    console.log('❌ FAILED: Should have thrown 401 error');
    failed++;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ PASSED: Invalid login returns 401');
      passed++;
    } else {
      console.log('❌ FAILED: Unexpected error:', error.message);
      failed++;
    }
  }

  // Test 3: Admin login should succeed
  console.log('\nTest 3: Admin Login');
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
      email: 'admin@overmatch.digital',
      password: 'Welcome123!',
    });

    if (response.data.accessToken && response.data.refreshToken) {
      console.log('✅ PASSED: Admin login successful');
      console.log(`   Access Token: ${response.data.accessToken.substring(0, 20)}...`);
      passed++;

      // Store token for next test
      global.authToken = response.data.accessToken;
    } else {
      console.log('❌ FAILED: Missing tokens in response');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED: Admin login error');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    failed++;
  }

  // Test 4: Use token to access protected endpoint
  if (global.authToken) {
    console.log('\nTest 4: Access Protected Endpoint with Token');
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${global.authToken}`,
        },
      });

      if (response.data.email === 'admin@overmatch.digital') {
        console.log('✅ PASSED: Protected endpoint accessible with token');
        passed++;
      } else {
        console.log('❌ FAILED: Unexpected response from protected endpoint');
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED: Could not access protected endpoint');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      failed++;
    }
  }

  // Test 5: Kong Gateway login
  console.log('\nTest 5: Login through Kong API Gateway');
  try {
    const response = await axios.post(`${API_GATEWAY_URL}/auth/login`, {
      email: 'admin@overmatch.digital',
      password: 'Welcome123!',
    });

    if (response.data.accessToken) {
      console.log('✅ PASSED: Kong Gateway login successful');
      passed++;
    } else {
      console.log('❌ FAILED: Missing token from Kong');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAILED: Kong Gateway login error');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('   ⚠️  Make sure Kong is running: docker-compose up -d kong');
    }
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Fix the issues and run again.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
