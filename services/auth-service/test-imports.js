const { execSync } = require('child_process');

console.log('Testing TypeScript compilation...');

try {
  const result = execSync('npx tsc --noEmit', {
    cwd: __dirname,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log('✅ TypeScript compilation successful - no circular dependencies detected!');
  console.log(result);
} catch (error) {
  console.log('❌ TypeScript compilation failed:');
  console.log(error.stdout);
  console.log(error.stderr);
  process.exit(1);
}
