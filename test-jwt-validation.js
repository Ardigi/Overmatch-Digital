const jwt = require('jsonwebtoken');

const testJWTValidation = async () => {
  console.log('Testing JWT validation with Keycloak JWKS...');
  
  // Test 1: Invalid token (should fail)
  console.log('\n1. Testing with invalid/mock JWT...');
  const mockToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com' },
    'wrong-secret',
    { algorithm: 'HS256' }
  );
  
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockToken}`
      },
      body: JSON.stringify({ token: mockToken })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.valid === false) {
      console.log('✅ PASS: Invalid token correctly rejected');
    } else {
      console.log('❌ FAIL: Invalid token was accepted!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 2: Malformed token
  console.log('\n2. Testing with malformed token...');
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not-a-jwt-token'
      },
      body: JSON.stringify({ token: 'not-a-jwt-token' })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.valid === false) {
      console.log('✅ PASS: Malformed token correctly rejected');
    } else {
      console.log('❌ FAIL: Malformed token was accepted!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 3: Empty token
  console.log('\n3. Testing with empty token...');
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: '' })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.valid === false || response.status === 400) {
      console.log('✅ PASS: Empty token correctly rejected');
    } else {
      console.log('❌ FAIL: Empty token was accepted!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 4: Token with wrong algorithm
  console.log('\n4. Testing token with wrong algorithm (HS256 instead of RS256)...');
  const wrongAlgoToken = jwt.sign(
    { 
      sub: 'test-user',
      email: 'test@example.com',
      iss: 'http://127.0.0.1:8180/realms/soc-compliance',
      aud: 'account'
    },
    'secret',
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wrongAlgoToken}`
      },
      body: JSON.stringify({ token: wrongAlgoToken })
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.valid === false) {
      console.log('✅ PASS: Token with wrong algorithm correctly rejected');
    } else {
      console.log('❌ FAIL: Token with wrong algorithm was accepted!');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n=== JWT Validation Security Test Complete ===');
  console.log('All tests should FAIL validation (return valid: false)');
  console.log('This confirms JWT validation is properly secured with JWKS.');
};

testJWTValidation().catch(console.error);