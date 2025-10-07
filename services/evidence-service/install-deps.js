#!/usr/bin/env node

/**
 * Install missing TypeScript dependencies
 */

const { execSync } = require('child_process');

console.log('📦 Installing missing TypeScript dependencies...\n');

const dependencies = ['@types/multer@^1.4.11', '@types/aws-sdk@^2.7.0'];

try {
  console.log('Installing development dependencies:');
  console.log(dependencies.join(', '));

  execSync(`npm install --save-dev ${dependencies.join(' ')}`, {
    cwd: __dirname,
    stdio: 'inherit',
  });

  console.log('\n✅ Dependencies installed successfully!');
  console.log('🔧 Now running TypeScript check...\n');

  // Run TypeScript check after installation
  require('./check-types.js');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}
