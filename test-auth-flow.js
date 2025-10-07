const fetch = require('node-fetch');

async function testAuthFlow() {
  console.log('Testing Auth Service Login Flow...\n');
  
  try {
    // Test 1: Direct Auth Service
    console.log('1. Testing direct Auth Service at http://127.0.0.1:3001/auth/login');
    const authResponse = await fetch('http://127.0.0.1:3001/auth/login', {
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
    
    const authData = await authResponse.json();
    console.log('Auth Service Response:', {
      status: authResponse.status,
      success: authData.success,
      hasAccessToken: !!authData.data?.accessToken,
      hasRefreshToken: !!authData.data?.refreshToken,
      user: authData.data?.user?.email
    });
    
    if (authData.success) {
      console.log('\n✅ Backend authentication is working!');
      console.log('Access token (first 50 chars):', authData.data.accessToken.substring(0, 50) + '...');
    }
    
    // Test 2: Check CORS headers
    console.log('\n2. Checking CORS configuration...');
    const corsHeaders = {
      'Access-Control-Allow-Origin': authResponse.headers.get('access-control-allow-origin'),
      'Access-Control-Allow-Credentials': authResponse.headers.get('access-control-allow-credentials')
    };
    console.log('CORS Headers:', corsHeaders);
    
    if (corsHeaders['Access-Control-Allow-Origin'] === 'http://localhost:3000') {
      console.log('✅ CORS is properly configured for frontend');
    } else {
      console.log('❌ CORS issue detected');
    }
    
  } catch (error) {
    console.error('❌ Error testing auth flow:', error.message);
  }
}

testAuthFlow();