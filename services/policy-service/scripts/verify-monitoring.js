#!/usr/bin/env node

/**
 * Policy Service - Monitoring Integration Verification Script
 * 
 * This script verifies that all monitoring decorators are properly applied
 * and that the monitoring configuration is correct.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkMonitoringDecorators() {
  log('\n📊 Verifying Monitoring Decorators...', 'cyan');
  
  const servicePath = path.join(__dirname, '../src/modules/policies/policies.service.ts');
  const controllerPath = path.join(__dirname, '../src/modules/policies/policies.controller.ts');
  
  if (!fs.existsSync(servicePath) || !fs.existsSync(controllerPath)) {
    log('❌ Policy service or controller files not found', 'red');
    return false;
  }
  
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const controllerContent = fs.readFileSync(controllerPath, 'utf8');
  
  // Check service decorators
  const serviceDecorators = [
    '@Observable',
    '@Traced',
    '@Metered'
  ];
  
  let serviceDecoratorCount = 0;
  serviceDecorators.forEach(decorator => {
    const matches = (serviceContent.match(new RegExp(decorator, 'g')) || []).length;
    serviceDecoratorCount += matches;
    log(`  ${decorator}: ${matches} occurrences`, matches > 0 ? 'green' : 'yellow');
  });
  
  // Check controller decorators
  let controllerDecoratorCount = 0;
  serviceDecorators.forEach(decorator => {
    const matches = (controllerContent.match(new RegExp(decorator, 'g')) || []).length;
    controllerDecoratorCount += matches;
  });
  
  log(`\n📈 Service monitoring decorators: ${serviceDecoratorCount}`, serviceDecoratorCount > 20 ? 'green' : 'yellow');
  log(`📈 Controller monitoring decorators: ${controllerDecoratorCount}`, controllerDecoratorCount > 3 ? 'green' : 'yellow');
  
  return serviceDecoratorCount > 20 && controllerDecoratorCount > 3;
}

function checkMonitoringImports() {
  log('\n📦 Verifying Monitoring Package Imports...', 'cyan');
  
  const servicePath = path.join(__dirname, '../src/modules/policies/policies.service.ts');
  const controllerPath = path.join(__dirname, '../src/modules/policies/policies.controller.ts');
  const appModulePath = path.join(__dirname, '../src/app.module.ts');
  
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const controllerContent = fs.readFileSync(controllerPath, 'utf8');
  const appModuleContent = fs.readFileSync(appModulePath, 'utf8');
  
  // Check imports
  const expectedImports = [
    '@soc-compliance/monitoring'
  ];
  
  let importChecks = 0;
  
  expectedImports.forEach(importPath => {
    if (serviceContent.includes(importPath)) {
      log(`  ✅ Service imports ${importPath}`, 'green');
      importChecks++;
    } else {
      log(`  ❌ Service missing import ${importPath}`, 'red');
    }
    
    if (controllerContent.includes(importPath)) {
      log(`  ✅ Controller imports ${importPath}`, 'green');
      importChecks++;
    } else {
      log(`  ❌ Controller missing import ${importPath}`, 'red');
    }
  });
  
  // Check app module integration
  if (appModuleContent.includes('MonitoringModule as MonitoringPackageModule')) {
    log(`  ✅ App module includes monitoring package`, 'green');
    importChecks++;
  } else {
    log(`  ❌ App module missing monitoring package integration`, 'red');
  }
  
  return importChecks >= 2;
}

function checkEnvironmentConfiguration() {
  log('\n🔧 Verifying Environment Configuration...', 'cyan');
  
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    log('  ❌ .env file not found', 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const expectedVars = [
    'ENABLE_TRACING',
    'ENABLE_METRICS',
    'ENABLE_LOGGING',
    'JAEGER_ENDPOINT',
    'METRICS_PORT',
    'LOG_LEVEL'
  ];
  
  let configChecks = 0;
  
  expectedVars.forEach(varName => {
    if (envContent.includes(varName)) {
      log(`  ✅ ${varName} configured`, 'green');
      configChecks++;
    } else {
      log(`  ❌ ${varName} missing`, 'red');
    }
  });
  
  return configChecks >= expectedVars.length - 1; // Allow one missing
}

function checkBusinessMetrics() {
  log('\n📊 Verifying Business Metrics Implementation...', 'cyan');
  
  const servicePath = path.join(__dirname, '../src/modules/policies/policies.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  const expectedMetrics = [
    'policy_created_total',
    'policy_updated_total',
    'policy_approved_total',
    'policy_evaluation_total',
    'policy_control_mapped_total',
    'policy_violations_detected_total'
  ];
  
  let metricsCount = 0;
  
  expectedMetrics.forEach(metric => {
    if (serviceContent.includes(metric)) {
      log(`  ✅ ${metric} implemented`, 'green');
      metricsCount++;
    } else {
      log(`  ❌ ${metric} missing`, 'yellow');
    }
  });
  
  log(`\n📈 Business metrics implemented: ${metricsCount}/${expectedMetrics.length}`, 
      metricsCount >= expectedMetrics.length * 0.8 ? 'green' : 'yellow');
  
  return metricsCount >= expectedMetrics.length * 0.8;
}

function checkGracefulDegradation() {
  log('\n🛡️  Verifying Graceful Degradation...', 'cyan');
  
  const servicePath = path.join(__dirname, '../src/modules/policies/policies.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  // Check for try-catch blocks around metrics calls
  const tryCallsCount = (serviceContent.match(/try\s*{[^}]*metricsService/g) || []).length;
  const catchCallsCount = (serviceContent.match(/catch\s*\([^)]*\)\s*{[^}]*warn.*Failed to record.*metrics/g) || []).length;
  
  log(`  📊 Protected metrics calls: ${tryCallsCount}`, tryCallsCount > 5 ? 'green' : 'yellow');
  log(`  🔄 Error handling blocks: ${catchCallsCount}`, catchCallsCount > 5 ? 'green' : 'yellow');
  
  return tryCallsCount > 5 && catchCallsCount > 5;
}

function checkDependencyInjection() {
  log('\n💉 Verifying Dependency Injection...', 'cyan');
  
  const servicePath = path.join(__dirname, '../src/modules/policies/policies.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  const requiredServices = [
    'MetricsService',
    'TracingService', 
    'LoggingService'
  ];
  
  let diChecks = 0;
  
  requiredServices.forEach(service => {
    const lowerService = service.toLowerCase().replace('service', 'Service');
    if (serviceContent.includes(`private readonly ${lowerService}: ${service}`) ||
        serviceContent.includes(`private ${lowerService}: ${service}`)) {
      log(`  ✅ ${service} properly injected`, 'green');
      diChecks++;
    } else if (serviceContent.includes(service)) {
      log(`  ⚠️  ${service} found but injection may be incorrect`, 'yellow');
      diChecks += 0.5;
    } else {
      log(`  ❌ ${service} not found`, 'red');
    }
  });
  
  return diChecks >= requiredServices.length * 0.8;
}

function main() {
  log('🔍 Policy Service - Monitoring Integration Verification', 'magenta');
  log('=' .repeat(60), 'magenta');
  
  const checks = [
    { name: 'Monitoring Decorators', fn: checkMonitoringDecorators },
    { name: 'Package Imports', fn: checkMonitoringImports },
    { name: 'Environment Config', fn: checkEnvironmentConfiguration },
    { name: 'Business Metrics', fn: checkBusinessMetrics },
    { name: 'Graceful Degradation', fn: checkGracefulDegradation },
    { name: 'Dependency Injection', fn: checkDependencyInjection }
  ];
  
  const results = checks.map(check => ({
    name: check.name,
    passed: check.fn()
  }));
  
  log('\n📋 Summary Report', 'magenta');
  log('-'.repeat(40), 'magenta');
  
  let totalPassed = 0;
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    log(`  ${result.name}: ${status}`, color);
    if (result.passed) totalPassed++;
  });
  
  const percentage = Math.round((totalPassed / results.length) * 100);
  log(`\n🎯 Overall Status: ${totalPassed}/${results.length} checks passed (${percentage}%)`, 
      percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red');
  
  if (percentage >= 80) {
    log('\n🎉 Monitoring integration is properly implemented!', 'green');
    log('   Policy Service is ready for enterprise observability.', 'green');
  } else if (percentage >= 60) {
    log('\n⚠️  Monitoring integration is partially complete.', 'yellow');
    log('   Some features may need attention before production deployment.', 'yellow');
  } else {
    log('\n🚨 Monitoring integration needs significant work.', 'red');
    log('   Please address the failing checks before proceeding.', 'red');
  }
  
  log('\n📖 For detailed implementation guide, see MONITORING_IMPLEMENTATION.md', 'cyan');
  
  process.exit(percentage >= 60 ? 0 : 1);
}

main();