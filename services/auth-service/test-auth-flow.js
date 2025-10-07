const axios = require('axios');

const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  organizationName: 'Test Organization'
};

let accessToken = null;
let refreshToken = null;
let userId = null;

async function testAuthFlow() {
  console.log('🔍 Testing Complete Authentication Flow\n');
  console.log('================================\n');

  // 1. Test Registration
  console.log('1️⃣ Testing Registration...');
  try {
    const registerResponse = await axios.post(`${API_URL}/auth/register`, TEST_USER, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${registerResponse.status}`);
    if (registerResponse.status === 201 || registerResponse.status === 200) {
      console.log(`   ✅ User registered: ${registerResponse.data.data?.user?.email || registerResponse.data.user?.email}`);
      userId = registerResponse.data.data?.user?.id || registerResponse.data.user?.id;
      console.log(`   User ID: ${userId}`);
    } else {
      console.log(`   ❌ Registration failed:`, registerResponse.data);
      return;
    }
  } catch (error) {
    console.error('   ❌ Registration error:', error.message);
    return;
  }

  // 2. Test Login
  console.log('\n2️⃣ Testing Login...');
  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${loginResponse.status}`);
    if (loginResponse.status === 200) {
      accessToken = loginResponse.data.data?.accessToken || loginResponse.data.accessToken;
      refreshToken = loginResponse.data.data?.refreshToken || loginResponse.data.refreshToken;
      console.log(`   ✅ Login successful`);
      console.log(`   Access Token: ${accessToken?.substring(0, 50)}...`);
      console.log(`   Refresh Token: ${refreshToken?.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ Login failed:`, loginResponse.data);
      return;
    }
  } catch (error) {
    console.error('   ❌ Login error:', error.message);
    return;
  }

  // 3. Test Profile Access
  console.log('\n3️⃣ Testing Profile Access...');
  try {
    const profileResponse = await axios.get(`${API_URL}/auth/profile`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${profileResponse.status}`);
    if (profileResponse.status === 200) {
      console.log(`   ✅ Profile accessed:`, {
        email: profileResponse.data.email,
        name: `${profileResponse.data.firstName} ${profileResponse.data.lastName}`,
        roles: profileResponse.data.roles
      });
    } else {
      console.log(`   ❌ Profile access failed:`, profileResponse.data);
    }
  } catch (error) {
    console.error('   ❌ Profile error:', error.message);
  }

  // 4. Test Token Refresh
  console.log('\n4️⃣ Testing Token Refresh...');
  try {
    const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${refreshResponse.status}`);
    if (refreshResponse.status === 200) {
      const newAccessToken = refreshResponse.data.data?.accessToken || refreshResponse.data.accessToken;
      console.log(`   ✅ Token refreshed`);
      console.log(`   New Access Token: ${newAccessToken?.substring(0, 50)}...`);
      accessToken = newAccessToken; // Update for further tests
    } else {
      console.log(`   ❌ Refresh failed:`, refreshResponse.data);
    }
  } catch (error) {
    console.error('   ❌ Refresh error:', error.message);
  }

  // 5. Test MFA Status
  console.log('\n5️⃣ Testing MFA Status...');
  try {
    const mfaStatusResponse = await axios.get(`${API_URL}/auth/mfa/status`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${mfaStatusResponse.status}`);
    if (mfaStatusResponse.status === 200) {
      console.log(`   ✅ MFA Status:`, mfaStatusResponse.data);
    } else {
      console.log(`   ❌ MFA status failed:`, mfaStatusResponse.data);
    }
  } catch (error) {
    console.error('   ❌ MFA status error:', error.message);
  }

  // 6. Test MFA Secret Generation
  console.log('\n6️⃣ Testing MFA Secret Generation...');
  try {
    const mfaGenerateResponse = await axios.post(`${API_URL}/auth/mfa/generate`, {}, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${mfaGenerateResponse.status}`);
    if (mfaGenerateResponse.status === 200 || mfaGenerateResponse.status === 201) {
      console.log(`   ✅ MFA Secret generated`);
      console.log(`   QR Code URL:`, mfaGenerateResponse.data.qrCodeUrl?.substring(0, 50) + '...');
    } else {
      console.log(`   ❌ MFA generation failed:`, mfaGenerateResponse.data);
    }
  } catch (error) {
    console.error('   ❌ MFA generation error:', error.message);
  }

  // 7. Test Logout
  console.log('\n7️⃣ Testing Logout...');
  try {
    const logoutResponse = await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${logoutResponse.status}`);
    if (logoutResponse.status === 200) {
      console.log(`   ✅ Logout successful`);
    } else {
      console.log(`   ❌ Logout failed:`, logoutResponse.data);
    }
  } catch (error) {
    console.error('   ❌ Logout error:', error.message);
  }

  // 8. Test Forgot Password
  console.log('\n8️⃣ Testing Forgot Password...');
  try {
    const forgotResponse = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: TEST_USER.email
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log(`   Status: ${forgotResponse.status}`);
    if (forgotResponse.status === 200) {
      console.log(`   ✅ Password reset initiated:`, forgotResponse.data.message);
    } else {
      console.log(`   ❌ Forgot password failed:`, forgotResponse.data);
    }
  } catch (error) {
    console.error('   ❌ Forgot password error:', error.message);
  }

  console.log('\n================================');
  console.log('✅ Authentication Flow Test Complete\n');
}

// Run the test
testAuthFlow().catch(console.error);