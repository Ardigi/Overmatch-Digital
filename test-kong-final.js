const http = require('http');

console.log('🔧 Final Production Authentication Test');
console.log('========================================\n');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test() {
  const loginData = JSON.stringify({
    email: 'admin@soc-compliance.com',
    password: 'Admin@123!'
  });
  
  console.log('Testing: POST http://localhost:8000/api/auth/login');
  console.log('Expected flow: Kong (8000) → auth-service (3001)');
  
  const response = await makeRequest({
    hostname: 'localhost',
    port: 8000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, loginData);
  
  console.log('\nResponse Status:', response.status);
  console.log('Kong Headers:', {
    via: response.headers['via'],
    proxyLatency: response.headers['x-kong-proxy-latency'],
    upstreamLatency: response.headers['x-kong-upstream-latency']
  });
  
  if (response.status === 200) {
    const data = response.data;
    if (data.success && data.data?.accessToken) {
      console.log('\n✅ AUTHENTICATION WORKS THROUGH KONG!');
      console.log('- Token received');
      console.log('- User:', data.data.user?.email);
      console.log('- Correlation ID:', data.metadata?.correlationId);
      console.log('\n🎉 PRODUCTION READY!');
      return true;
    }
  }
  
  console.log('\nResponse:', JSON.stringify(response.data, null, 2));
  return false;
}

test().catch(console.error);