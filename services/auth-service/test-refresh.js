const axios = require('axios');

async function testRefreshToken() {
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
    const refreshToken = loginResponse.data.data?.refreshToken;
    
    console.log('✅ Login successful');
    console.log('   Access Token:', accessToken?.substring(0, 50) + '...');
    console.log('   Refresh Token:', refreshToken?.substring(0, 20) + '...');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test refresh
    console.log('\n2. Testing token refresh...');
    const refreshResponse = await axios.post('http://localhost:3001/auth/refresh', {
      refresh_token: refreshToken
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('   Status:', refreshResponse.status);
    
    if (refreshResponse.status === 200) {
      const newAccessToken = refreshResponse.data.data?.accessToken;
      const newRefreshToken = refreshResponse.data.data?.refreshToken;
      
      console.log('✅ Token refreshed successfully');
      console.log('   New Access Token:', newAccessToken?.substring(0, 50) + '...');
      console.log('   New Refresh Token:', newRefreshToken?.substring(0, 20) + '...');
      
      // Test if new access token works
      console.log('\n3. Testing new access token...');
      const profileResponse = await axios.get('http://localhost:3001/auth/profile', {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`
        },
        validateStatus: () => true
      });
      
      console.log('   Status:', profileResponse.status);
      if (profileResponse.status === 200) {
        console.log('✅ New access token works!');
        console.log('   User ID:', profileResponse.data.data?.id);
        console.log('   Email:', profileResponse.data.data?.email);
      } else {
        console.log('❌ New access token failed:', profileResponse.data);
      }
    } else {
      console.log('❌ Refresh failed:', refreshResponse.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRefreshToken();