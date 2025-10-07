const axios = require('axios');

async function testValidationPipe() {
  console.log('🔍 Testing ValidationPipe DTO Transformation\n');

  const testPayload = {
    email: 'test@example.com',
    password: 'Test123!@#'
  };

  try {
    // Test 1: Raw body endpoint (no DTO transformation)
    console.log('1️⃣ Testing raw body endpoint...');
    const rawResponse = await axios.post('http://localhost:3001/test/raw', testPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('Raw endpoint status:', rawResponse.status);
    console.log('Raw endpoint response:', JSON.stringify(rawResponse.data, null, 2));

    // Test 2: DTO validation endpoint (with ValidationPipe transformation)
    console.log('\n2️⃣ Testing DTO validation endpoint...');
    const validationResponse = await axios.post('http://localhost:3001/test/validation', testPayload, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('Validation endpoint status:', validationResponse.status);
    console.log('Validation endpoint response:', JSON.stringify(validationResponse.data, null, 2));

    // Test 3: Invalid data to see validation errors
    console.log('\n3️⃣ Testing invalid data...');
    const invalidResponse = await axios.post('http://localhost:3001/test/validation', {
      email: 'not-an-email', // Invalid email
      // Missing password
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });
    
    console.log('Invalid data status:', invalidResponse.status);
    console.log('Invalid data response:', JSON.stringify(invalidResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testValidationPipe();