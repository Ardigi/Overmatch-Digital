const fs = require('fs');
const path = require('path');

// NestJS v11 packages and their correct versions
const nestjsPackages = {
  "@nestjs/common": "^11.1.6",
  "@nestjs/core": "^11.1.6",
  "@nestjs/platform-express": "^11.1.6",
  "@nestjs/microservices": "^11.1.6",
  "@nestjs/config": "^3.3.0",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/typeorm": "^10.0.2",
  "@nestjs/swagger": "^8.0.5",
  "@nestjs/axios": "^3.1.2",
  "@nestjs/bull": "^10.2.1",
  "@nestjs/schedule": "^4.1.1",
  "@nestjs/event-emitter": "^2.0.4",
  "@nestjs/terminus": "^10.2.3",
  "@nestjs/throttler": "^6.2.1",
  "@nestjs/cache-manager": "^2.3.0",
  "@nestjs/elasticsearch": "^10.0.1",
  "@nestjs/mapped-types": "^2.0.6"
};

// DevDependencies to update
const devDependencies = {
  "@nestjs/cli": "^10.0.0",
  "@nestjs/schematics": "^10.0.0",
  "@nestjs/testing": "^11.1.6"
};

// Packages directories to update
const packagesDir = path.join(__dirname, 'packages');
const packages = fs.readdirSync(packagesDir).filter(dir => {
  const packagePath = path.join(packagesDir, dir, 'package.json');
  return fs.existsSync(packagePath);
});

console.log('📦 Upgrading packages to NestJS v11...\n');

packages.forEach(packageName => {
  const packageJsonPath = path.join(packagesDir, packageName, 'package.json');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    let updated = false;
    
    // Update dependencies
    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach(dep => {
        if (nestjsPackages[dep]) {
          packageJson.dependencies[dep] = nestjsPackages[dep];
          updated = true;
        }
      });
    }
    
    // Update devDependencies
    if (packageJson.devDependencies) {
      Object.keys(packageJson.devDependencies).forEach(dep => {
        if (devDependencies[dep]) {
          packageJson.devDependencies[dep] = devDependencies[dep];
          updated = true;
        }
      });
    }
    
    if (updated) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`✅ Updated ${packageName}`);
    } else {
      console.log(`⏭️  Skipped ${packageName} (no NestJS dependencies)`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${packageName}: ${error.message}`);
  }
});

console.log('\n✨ Package upgrade complete!');
console.log('\n📝 Next steps:');
console.log('1. Run: cd packages/http-common && npm install');
console.log('2. Run: cd packages/monitoring && npm install');
console.log('3. Run: cd packages/auth-common && npm install');
console.log('4. Run: cd packages/cache-common && npm install');
console.log('5. Run: cd packages/secrets && npm install');
console.log('6. Run: npm run build:shared (from root)');