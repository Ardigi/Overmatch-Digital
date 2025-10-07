const fs = require('fs');
const path = require('path');

const services = [
  'ai-service',
  'audit-service',
  'control-service',
  'evidence-service',
  'integration-service',
  'notification-service',
  'policy-service',
  'reporting-service',
  'workflow-service'
];

const nestjsPackages = {
  "@nestjs/axios": "^3.1.2",
  "@nestjs/bull": "^10.2.1",
  "@nestjs/common": "^11.1.6",
  "@nestjs/config": "^3.3.0",
  "@nestjs/core": "^11.1.6",
  "@nestjs/event-emitter": "^2.0.4",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/mapped-types": "^2.0.6",
  "@nestjs/microservices": "^11.1.6",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/platform-express": "^11.1.6",
  "@nestjs/schedule": "^4.1.1",
  "@nestjs/swagger": "^8.0.5",
  "@nestjs/terminus": "^10.2.3",
  "@nestjs/typeorm": "^10.0.2",
  "@nestjs/websockets": "^11.1.6",
  "@nestjs/platform-socket.io": "^11.1.6",
  "@nestjs/serve-static": "^4.0.2",
  "@nestjs/throttler": "^6.2.1"
};

services.forEach(service => {
  const packagePath = path.join('services', service, 'package.json');
  
  if (fs.existsSync(packagePath)) {
    console.log(`Updating ${service}...`);
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Update dependencies
    Object.keys(nestjsPackages).forEach(pkg => {
      if (packageJson.dependencies && packageJson.dependencies[pkg]) {
        console.log(`  - Updating ${pkg} from ${packageJson.dependencies[pkg]} to ${nestjsPackages[pkg]}`);
        packageJson.dependencies[pkg] = nestjsPackages[pkg];
      }
    });
    
    // Update devDependencies
    Object.keys(nestjsPackages).forEach(pkg => {
      if (packageJson.devDependencies && packageJson.devDependencies[pkg]) {
        console.log(`  - Updating ${pkg} from ${packageJson.devDependencies[pkg]} to ${nestjsPackages[pkg]}`);
        packageJson.devDependencies[pkg] = nestjsPackages[pkg];
      }
    });
    
    // Update related packages
    if (packageJson.dependencies) {
      // Update Swagger API package
      if (packageJson.dependencies['swagger-ui-express']) {
        packageJson.dependencies['swagger-ui-express'] = "^5.0.1";
      }
      
      // Update class-validator and class-transformer
      if (packageJson.dependencies['class-validator']) {
        packageJson.dependencies['class-validator'] = "^0.14.1";
      }
      if (packageJson.dependencies['class-transformer']) {
        packageJson.dependencies['class-transformer'] = "^0.5.1";
      }
    }
    
    // Write back the updated package.json
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ ${service} updated successfully\n`);
  } else {
    console.log(`❌ ${service} package.json not found\n`);
  }
});

console.log('All services updated! Now run:');
console.log('1. npm install (in root)');
console.log('2. npm run build:shared');
console.log('3. cd services/control-service && npm install');