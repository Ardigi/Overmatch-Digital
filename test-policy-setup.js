const { exec } = require('child_process');
const path = require('path');

const policyServicePath = path.join(__dirname, 'services', 'policy-service');

console.log('Testing Policy Service E2E setup...');
console.log('Working directory:', policyServicePath);

// Run the E2E test setup
const testCommand = `cd "${policyServicePath}" && npm test -- --testNamePattern="should create a new policy" --maxWorkers=1 --runInBand`;

console.log('Executing:', testCommand);

const child = exec(testCommand, {
  cwd: policyServicePath,
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

child.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

child.on('close', (code) => {
  console.log(`Test process exited with code ${code}`);
  process.exit(code);
});
