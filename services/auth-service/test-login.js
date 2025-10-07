const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login...');
    const response = await axios.post('http://localhost:3001/auth/login', {
      email: 'test@example.com',
      password: 'Test123!@#'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('Status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ Login successful!');
      console.log('Access Token:', response.data.data?.accessToken?.substring(0, 50) + '...');
      console.log('User:', response.data.data?.user);
      
      // Test profile access
      if (response.data.data?.accessToken) {
        console.log('\nTesting profile access...');
        const profileResponse = await axios.get('http://localhost:3001/auth/profile', {
          headers: {
            'Authorization': `Bearer ${response.data.data.accessToken}`
          },
          validateStatus: () => true
        });
        
        console.log('Profile Status:', profileResponse.status);
        if (profileResponse.status === 200) {
          console.log('✅ Profile accessed:', profileResponse.data);
        } else {
          console.log('❌ Profile access failed:', profileResponse.data);
        }
      }
    } else {
      console.log('❌ Login failed:', response.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();