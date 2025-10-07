#!/usr/bin/env node

// Set environment variable to skip database connections
process.env.SKIP_DB_CONNECTION = 'true';

// Run the dev command
const { spawn } = require('child_process');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npm, ['run', 'dev:services'], {
  stdio: 'inherit',
  env: { ...process.env, SKIP_DB_CONNECTION: 'true' },
});

child.on('close', (code) => {
  process.exit(code);
});
