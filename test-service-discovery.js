/**
 * Test Service Discovery Integration
 * This script tests if all services can be discovered and their health endpoints work
 */

const axios = require('axios');

// Service configuration matching the service discovery
const services = {
  'auth-service': 3001,
  'client-service': 3002,
  'policy-service': 3003,
  'control-service': 3004,
  'evidence-service': 3005,
  'workflow-service': 3006,
  'reporting-service': 3007,
  'audit-service': 3008,
  'integration-service': 3009,
  'notification-service': 3010,
  'ai-service': 3011,
};

const healthEndpoints = ['/api/v1/health', '/health', '/health/check', '/api/health'];

async function testServiceConnectivity() {
  console.log('🔍 Testing Service Discovery and Health Endpoints...\n');

  const results = {};

  for (const [serviceName, port] of Object.entries(services)) {
    console.log(`Testing ${serviceName} on port ${port}...`);

    const serviceUrl = `http://localhost:${port}`;
    const serviceResult = {
      serviceName,
      port,
      baseUrl: serviceUrl,
      reachable: false,
      healthEndpoint: null,
      error: null,
    };

    // Test basic connectivity first
    try {
      const response = await axios.get(serviceUrl, {
        timeout: 3000,
        validateStatus: (status) => status < 500, // Allow 404, 401, etc.
      });
      serviceResult.reachable = true;
      console.log(`  ✅ Service is reachable (status: ${response.status})`);
    } catch (error) {
      if (error.response && error.response.status < 500) {
        serviceResult.reachable = true;
        console.log(`  ✅ Service is reachable (status: ${error.response.status})`);
      } else {
        console.log(`  ❌ Service not reachable: ${error.message}`);
        serviceResult.error = error.message;
        results[serviceName] = serviceResult;
        continue;
      }
    }

    // Test health endpoints
    let healthFound = false;
    for (const endpoint of healthEndpoints) {
      try {
        const healthUrl = `${serviceUrl}${endpoint}`;
        const response = await axios.get(healthUrl, { timeout: 5000 });

        if (response.status === 200) {
          serviceResult.healthEndpoint = endpoint;
          console.log(`  ✅ Health endpoint found: ${endpoint}`);
          console.log(`  📊 Health status:`, response.data.status || 'ok');
          healthFound = true;
          break;
        }
      } catch (error) {
        // Continue to next endpoint
      }
    }

    if (!healthFound) {
      console.log(`  ⚠️  No health endpoint found`);
    }

    results[serviceName] = serviceResult;
    console.log();
  }

  // Print summary
  console.log('📋 SERVICE DISCOVERY TEST SUMMARY');
  console.log('='.repeat(50));

  const reachableServices = Object.values(results).filter((r) => r.reachable);
  const servicesWithHealth = Object.values(results).filter((r) => r.healthEndpoint);

  console.log(`Total services: ${Object.keys(services).length}`);
  console.log(`Reachable services: ${reachableServices.length}`);
  console.log(`Services with health endpoints: ${servicesWithHealth.length}`);
  console.log();

  // List problematic services
  const unreachableServices = Object.values(results).filter((r) => !r.reachable);
  if (unreachableServices.length > 0) {
    console.log('❌ UNREACHABLE SERVICES:');
    unreachableServices.forEach((service) => {
      console.log(`  - ${service.serviceName} (${service.baseUrl}): ${service.error}`);
    });
    console.log();
  }

  const servicesWithoutHealth = Object.values(results).filter(
    (r) => r.reachable && !r.healthEndpoint
  );
  if (servicesWithoutHealth.length > 0) {
    console.log('⚠️  SERVICES WITHOUT HEALTH ENDPOINTS:');
    servicesWithoutHealth.forEach((service) => {
      console.log(`  - ${service.serviceName} (${service.baseUrl})`);
    });
    console.log();
  }

  // Success summary
  if (servicesWithHealth.length > 0) {
    console.log('✅ HEALTHY SERVICES:');
    servicesWithHealth.forEach((service) => {
      console.log(`  - ${service.serviceName} (${service.baseUrl}${service.healthEndpoint})`);
    });
  }

  return results;
}

// Run the test
testServiceConnectivity()
  .then((results) => {
    const allHealthy = Object.values(results).every((r) => r.reachable && r.healthEndpoint);
    process.exit(allHealthy ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
