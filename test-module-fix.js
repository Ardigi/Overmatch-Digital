// Test script to verify the WeakMap error fix
const { spawn } = require('child_process');
const path = require('path');

const policyServicePath = path.join(__dirname, 'services', 'policy-service');

console.log('\n=== Testing Policy Service E2E Module Fix ===\n');
console.log('Working directory:', policyServicePath);

// Test just the basic module creation
const testCommand = 'npm';
const testArgs = [
  'test',
  '--',
  '--testNamePattern="should create a new policy with valid data"',
  '--maxWorkers=1',
  '--runInBand',
  '--verbose',
];

console.log('Executing:', testCommand, testArgs.join(' '));

const child = spawn(testCommand, testArgs, {
  cwd: policyServicePath,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    FORCE_COLOR: '1',
  },
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => {
  console.log(`\n=== Test process completed with exit code: ${code} ===\n`);
  if (code === 0) {
    console.log('✅ SUCCESS: WeakMap error appears to be fixed!');
  } else {
    console.log('❌ FAILED: Tests still failing, may need additional fixes');
  }
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start test process:', err);
  process.exit(1);
});
