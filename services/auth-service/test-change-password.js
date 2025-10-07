const axios = require('axios');

async function testChangePassword() {
  try {
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/auth/login', {
      email: 'test@example.com',
      password: 'Test123!@#'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('   Status:', loginResponse.status);
    
    if (loginResponse.status === 429) {
      console.log('❌ Rate limited. Waiting 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Try again
      const retryResponse = await axios.post('http://localhost:3001/auth/login', {
        email: 'test@example.com',
        password: 'Test123!@#'
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });
      
      if (retryResponse.status === 200) {
        loginResponse.status = 200;
        loginResponse.data = retryResponse.data;
      }
    }
    
    if (loginResponse.status !== 200) {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }
    
    console.log('✅ Login successful');
    console.log('   Full response:', JSON.stringify(loginResponse.data, null, 2));
    
    const accessToken = loginResponse.data?.data?.accessToken || 
                       loginResponse.data?.accessToken;
    
    if (!accessToken) {
      console.log('❌ No access token in response');
      return;
    }
    
    console.log('   Access Token:', accessToken.substring(0, 50) + '...');
    
    // Test change password
    console.log('\n2. Testing Change Password...');
    const changePasswordResponse = await axios.post('http://localhost:3001/auth/change-password', {
      currentPassword: 'Test123!@#',
      newPassword: 'NewTest123!@#',
      confirmNewPassword: 'NewTest123!@#'
    }, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    console.log('   Status:', changePasswordResponse.status);
    
    if (changePasswordResponse.status === 200) {
      console.log('✅ Password changed successfully');
      console.log('   Response:', changePasswordResponse.data);
      
      // Try to login with new password
      console.log('\n3. Testing login with new password...');
      const newLoginResponse = await axios.post('http://localhost:3001/auth/login', {
        email: 'test@example.com',
        password: 'NewTest123!@#'
      }, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true
      });
      
      if (newLoginResponse.status === 200) {
        console.log('✅ Login with new password successful');
        
        // Change back to original
        const revertToken = newLoginResponse.data?.data?.accessToken || newLoginResponse.data?.accessToken;
        console.log('\n4. Reverting password to original...');
        const revertResponse = await axios.post('http://localhost:3001/auth/change-password', {
          currentPassword: 'NewTest123!@#',
          newPassword: 'Test123!@#',
          confirmNewPassword: 'Test123!@#'
        }, {
          headers: { 
            'Authorization': `Bearer ${revertToken}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
        
        if (revertResponse.status === 200) {
          console.log('✅ Password reverted to original');
        }
      } else {
        console.log('❌ Login with new password failed:', newLoginResponse.data);
      }
    } else {
      console.log('❌ Change password failed:', changePasswordResponse.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testChangePassword();