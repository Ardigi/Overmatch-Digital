const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Checking TypeScript compilation for monitoring package...');

try {
  const result = execSync('npx tsc --noEmit', {
    cwd: __dirname,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  console.log('✅ TypeScript compilation successful!');
  if (result.trim()) {
    console.log('📋 Output:', result);
  }
} catch (error) {
  console.error('❌ TypeScript compilation failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}

try {
  console.log('🔨 Building package...');
  const buildResult = execSync('npm run build', {
    cwd: __dirname,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  console.log('✅ Package build successful!');
  if (buildResult.trim()) {
    console.log('📋 Build output:', buildResult);
  }
} catch (error) {
  console.error('❌ Package build failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}

console.log('🎉 All compilation checks passed!');
