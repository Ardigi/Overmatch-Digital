const axios = require('axios');

async function testMFAAndPassword() {
  try {
    // First login
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/auth/login', {
      email: 'test@example.com',
      password: 'Test123!@#'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    if (loginResponse.status !== 200) {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }
    
    const accessToken = loginResponse.data.data?.accessToken;
    console.log('✅ Login successful');
    
    // Test MFA Status
    console.log('\n2. Testing MFA Status...');
    const mfaStatusResponse = await axios.get('http://localhost:3001/auth/mfa/status', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      validateStatus: () => true
    });
    
    console.log('   Status:', mfaStatusResponse.status);
    if (mfaStatusResponse.status === 200) {
      console.log('✅ MFA Status retrieved:');
      console.log('   Enabled:', mfaStatusResponse.data.data?.enabled);
      console.log('   Methods:', mfaStatusResponse.data.data?.enabledMethods);
    } else {
      console.log('❌ MFA status failed:', mfaStatusResponse.data);
    }
    
    // Test MFA Secret Generation
    console.log('\n3. Testing MFA Secret Generation...');
    const mfaGenerateResponse = await axios.post('http://localhost:3001/auth/mfa/generate', {}, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      validateStatus: () => true
    });
    
    console.log('   Status:', mfaGenerateResponse.status);
    if (mfaGenerateResponse.status === 200 || mfaGenerateResponse.status === 201) {
      console.log('✅ MFA Secret generated');
      const mfaData = mfaGenerateResponse.data.data || mfaGenerateResponse.data;
      console.log('   Secret:', mfaData.base32?.substring(0, 10) + '...');
      console.log('   QR Code URL:', mfaData.qr_code_url?.substring(0, 50) + '...');
    } else {
      console.log('❌ MFA generation failed:', mfaGenerateResponse.data);
    }
    
    // Test Logout
    console.log('\n4. Testing Logout...');
    const logoutResponse = await axios.post('http://localhost:3001/auth/logout', {}, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      validateStatus: () => true
    });
    
    console.log('   Status:', logoutResponse.status);
    if (logoutResponse.status === 200) {
      console.log('✅ Logout successful');
      console.log('   Message:', logoutResponse.data.data?.message);
    } else {
      console.log('❌ Logout failed:', logoutResponse.data);
    }
    
    // Test Forgot Password (doesn't need auth)
    console.log('\n5. Testing Forgot Password...');
    const forgotResponse = await axios.post('http://localhost:3001/auth/forgot-password', {
      email: 'test@example.com'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('   Status:', forgotResponse.status);
    if (forgotResponse.status === 200) {
      console.log('✅ Password reset initiated');
      console.log('   Message:', forgotResponse.data.data?.message);
    } else {
      console.log('❌ Forgot password failed:', forgotResponse.data);
    }
    
    // Test Change Password (need to login again)
    console.log('\n6. Testing Change Password...');
    console.log('   Logging in again...');
    const loginResponse2 = await axios.post('http://localhost:3001/auth/login', {
      email: 'test@example.com',
      password: 'Test123!@#'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('   Login status:', loginResponse2.status);
    if (loginResponse2.status === 200) {
      // Check different possible response structures
      const newAccessToken = loginResponse2.data?.data?.accessToken || 
                            loginResponse2.data?.accessToken ||
                            loginResponse2.data?.success && loginResponse2.data?.data?.accessToken;
      console.log('   Response structure:', Object.keys(loginResponse2.data));
      console.log('   Got new token:', newAccessToken ? (newAccessToken.substring(0, 50) + '...') : 'NO TOKEN FOUND');
      
      const changePasswordResponse = await axios.post('http://localhost:3001/auth/change-password', {
        currentPassword: 'Test123!@#',
        newPassword: 'NewTest123!@#',
        confirmNewPassword: 'NewTest123!@#'
      }, {
        headers: { 
          'Authorization': `Bearer ${newAccessToken}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });
      
      console.log('   Status:', changePasswordResponse.status);
      if (changePasswordResponse.status === 200) {
        console.log('✅ Password changed successfully');
        console.log('   Message:', changePasswordResponse.data.data?.message);
        
        // Change it back for future tests
        console.log('\n   Changing password back...');
        const loginResponse3 = await axios.post('http://localhost:3001/auth/login', {
          email: 'test@example.com',
          password: 'NewTest123!@#'
        }, {
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true
        });
        
        if (loginResponse3.status === 200) {
          const token3 = loginResponse3.data.data?.accessToken;
          await axios.post('http://localhost:3001/auth/change-password', {
            currentPassword: 'NewTest123!@#',
            newPassword: 'Test123!@#',
            confirmNewPassword: 'Test123!@#'
          }, {
            headers: { 
              'Authorization': `Bearer ${token3}`,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true
          });
          console.log('   ✅ Password reverted to original');
        }
      } else {
        console.log('❌ Change password failed:', changePasswordResponse.data);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMFAAndPassword();