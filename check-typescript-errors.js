const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const services = [
  'client-service',
  'control-service', 
  'evidence-service',
  'policy-service'
];

function checkService(service) {
  const serviceDir = path.join(__dirname, 'services', service);
  if (!fs.existsSync(serviceDir)) {
    console.log(`❌ Service directory not found: ${service}`);
    return false;
  }

  try {
    console.log(`\n🔍 Checking TypeScript errors in ${service}...`);
    const result = execSync('npx tsc --noEmit --skipLibCheck', {
      cwd: serviceDir,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`✅ ${service}: No TypeScript errors`);
    return true;
  } catch (error) {
    console.log(`❌ ${service}: TypeScript errors found:`);
    console.log(error.stdout || error.stderr);
    return false;
  }
}

console.log('🚀 Checking TypeScript errors across services...');

let allPassed = true;
for (const service of services) {
  const passed = checkService(service);
  allPassed = allPassed && passed;
}

console.log('\n📊 Summary:');
console.log(allPassed ? '✅ All services passed TypeScript check' : '❌ Some services have TypeScript errors');

process.exit(allPassed ? 0 : 1);