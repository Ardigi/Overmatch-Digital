const { spawn } = require('child_process');
const http = require('http');

console.log('Starting client-service...');

// Start the service
const service = spawn('npm', ['run', 'start:dev'], {
  shell: true,
  stdio: 'pipe',
});

let output = '';

service.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);

  // Check if service is ready
  if (text.includes('Nest application successfully started')) {
    console.log('\nService started! Testing health endpoint...');
    testHealth();
  }
});

service.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
});

service.on('error', (error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});

service.on('close', (code) => {
  console.log(`Service exited with code ${code}`);
  if (code !== 0 && !output.includes('successfully started')) {
    console.error('\nStartup failed. Last output:');
    console.error(output.slice(-1000));
  }
});

function testHealth() {
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/health',
    method: 'GET',
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Health check response:', data);
      console.log('\n✅ Service is running successfully!');
      // Kill the service
      service.kill();
    });
  });

  req.on('error', (error) => {
    console.error('Health check failed:', error.message);
    service.kill();
  });

  req.end();
}

// Safety timeout
setTimeout(() => {
  console.error('\nTimeout: Service did not start within 30 seconds');
  service.kill();
  process.exit(1);
}, 30000);
