// Start auth service directly
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Auth Service directly...');

const authProcess = spawn('node', [path.join(__dirname, 'dist', 'src', 'main.js')], {
  stdio: 'inherit',
  env: { ...process.env },
});

authProcess.on('error', (err) => {
  console.error('Failed to start auth service:', err);
});

authProcess.on('exit', (code) => {
  console.log(`Auth service exited with code ${code}`);
});
