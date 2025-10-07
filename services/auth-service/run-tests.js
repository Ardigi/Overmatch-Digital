// Simple test runner to avoid shell issues
const { execSync } = require('child_process');

try {
  const result = execSync('npx jest --no-coverage', {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd: __dirname,
  });
  console.log(result);
} catch (error) {
  console.log(error.stdout);
  console.log(error.stderr);
  process.exit(1);
}
