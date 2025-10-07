// Test complete auth flow including NextAuth
const fetch = require('node-fetch');

async function testFullAuthFlow() {
  console.log('Testing Complete Authentication Flow...\n');
  
  try {
    // Step 1: Login to get tokens
    console.log('Step 1: Authenticate with backend to get tokens...');
    const loginResponse = await fetch('http://127.0.0.1:3001/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify({
        email: 'admin@soc-compliance.com',
        password: 'Admin@123!'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Got tokens from backend');
    console.log('   Access Token:', loginData.data.accessToken.substring(0, 50) + '...');
    console.log('   User:', loginData.data.user.email);
    
    // Step 2: Test NextAuth endpoint
    console.log('\nStep 2: Testing NextAuth credentials provider...');
    const nextAuthResponse = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'admin@soc-compliance.com',
        password: 'Admin@123!',
        csrfToken: 'test', // This would normally come from NextAuth
        json: 'true'
      })
    });
    
    console.log('NextAuth Response Status:', nextAuthResponse.status);
    const nextAuthData = await nextAuthResponse.text();
    console.log('NextAuth Response:', nextAuthData.substring(0, 200));
    
    // Step 3: Check session endpoint
    console.log('\nStep 3: Checking session endpoint...');
    const sessionResponse = await fetch('http://localhost:3000/api/auth/session');
    const sessionData = await sessionResponse.json();
    console.log('Session Data:', sessionData);
    
  } catch (error) {
    console.error('❌ Error in auth flow:', error.message);
    console.error(error.stack);
  }
}

testFullAuthFlow();