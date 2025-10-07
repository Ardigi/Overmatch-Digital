// Test NextAuth authorize function directly
const http = require('http');

async function testNextAuthAuthorize() {
  console.log('Testing NextAuth authorize function...\n');
  
  // Simulate what NextAuth does
  const credentials = {
    email: 'test1755462979403@example.com',
    password: 'SuperSecure123!@#$'
  };

  // 1. First verify the backend works
  console.log('1. Testing backend directly:');
  const backendRes = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const backendData = await backendRes.json();
  console.log('Backend success:', backendData.success);
  console.log('Has user:', !!backendData.data?.user);
  console.log('Has tokens:', !!backendData.data?.accessToken);
  
  // 2. Test NextAuth endpoint
  console.log('\n2. Testing NextAuth callback:');
  const nextAuthRes = await fetch('http://127.0.0.1:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': 'authjs.csrf-token=test'
    },
    body: JSON.stringify({
      ...credentials,
      csrfToken: 'test',
      json: true
    })
  });
  
  console.log('NextAuth status:', nextAuthRes.status);
  console.log('NextAuth headers:', nextAuthRes.headers.raw());
  
  if (nextAuthRes.status !== 200) {
    const text = await nextAuthRes.text();
    console.log('NextAuth response:', text.substring(0, 200));
  } else {
    const data = await nextAuthRes.json();
    console.log('NextAuth data:', data);
  }
}

testNextAuthAuthorize().catch(console.error);