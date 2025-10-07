#!/usr/bin/env node

/**
 * TypeScript compilation checker
 * This script runs TypeScript compilation and outputs any errors
 */

const { execSync } = require('child_process');
const _path = require('path');

console.log('🔍 Running TypeScript compilation check...\n');

try {
  const output = execSync('npx tsc --noEmit --skipLibCheck', {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (output.trim()) {
    console.log('❌ TypeScript compilation errors found:\n');
    console.log(output);
    process.exit(1);
  } else {
    console.log('✅ No TypeScript compilation errors found!');
    console.log('🎉 All types are correct!');
    process.exit(0);
  }
} catch (error) {
  if (error.stdout) {
    console.log('❌ TypeScript compilation errors found:\n');
    console.log(error.stdout);
  }
  if (error.stderr) {
    console.log('❌ Additional errors:\n');
    console.log(error.stderr);
  }
  process.exit(1);
}
