import fetch from 'node-fetch';

// Test the auth API directly
async function testAuth() {
  try {
    console.log('Testing auth API directly...');
    
    // First test the backend directly
    const backendResponse = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test1755462979403@example.com',
        password: 'SuperSecure123!@#$'
      })
    });
    
    const backendData = await backendResponse.json();
    console.log('Backend response:', JSON.stringify(backendData, null, 2));
    
    // Now test what the auth.ts mapping does
    if (backendData.success && backendData.data) {
      const mapped = {
        access_token: backendData.data.accessToken,
        refresh_token: backendData.data.refreshToken,
        token_type: backendData.data.tokenType || 'Bearer',
        expires_in: backendData.data.expiresIn || 1800,
        user: backendData.data.user,
        requiresMfa: backendData.data.requiresMfa,
        mfaSessionToken: backendData.data.mfaSessionToken,
      };
      console.log('\nMapped for NextAuth:', JSON.stringify(mapped, null, 2));
      
      // Check what NextAuth expects
      const userObj = {
        id: mapped.user.id,
        email: mapped.user.email,
        name: mapped.user.fullName || `${mapped.user.firstName} ${mapped.user.lastName}`,
        accessToken: mapped.access_token,
        refreshToken: mapped.refresh_token,
        roles: mapped.user.roles || [],
        permissions: mapped.user.permissions || [],
        organization: mapped.user.organization || null,
        firstName: mapped.user.firstName,
        lastName: mapped.user.lastName,
      };
      console.log('\nFinal user object for NextAuth:', JSON.stringify(userObj, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuth();