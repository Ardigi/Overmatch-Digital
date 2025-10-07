#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * Comprehensive Test Runner
 * Runs all tests in the correct order and generates a full report
 */
class TestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      },
    };
  }

  async run() {
    console.log(chalk.bold.blue('🧪 SOC Compliance Platform - Comprehensive Test Suite\n'));

    try {
      // 1. Infrastructure tests
      await this.runTest(
        'Infrastructure Connectivity',
        'node test/integration/service-connectivity.test.js'
      );

      // 2. Service-specific unit tests
      await this.runServiceTests();

      // 3. Integration tests
      await this.runIntegrationTests();

      // 4. E2E tests
      await this.runTest('End-to-End Platform Test', 'node test/e2e/full-platform.test.js');

      // 5. Performance tests
      await this.runPerformanceTests();

      // 6. Security tests
      await this.runSecurityTests();

      // Generate final report
      await this.generateReport();
    } catch (error) {
      console.error(chalk.red('Test runner failed:'), error);
      process.exit(1);
    }
  }

  async runTest(name, command, options = {}) {
    console.log(chalk.yellow(`\n📋 Running: ${name}`));
    console.log(chalk.gray('─'.repeat(60)));

    const startTime = Date.now();
    const result = {
      name,
      command,
      startTime: new Date().toISOString(),
      status: 'running',
    };

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        env: { ...process.env, ...options.env },
      });

      result.status = 'passed';
      result.duration = Date.now() - startTime;
      result.output = options.silent ? output : null;

      console.log(chalk.green(`✅ ${name} passed (${result.duration}ms)`));
      this.results.summary.passed++;
    } catch (error) {
      result.status = 'failed';
      result.duration = Date.now() - startTime;
      result.error = error.message;
      result.output = error.stdout || error.output?.toString();

      console.log(chalk.red(`❌ ${name} failed (${result.duration}ms)`));
      console.log(chalk.red(error.message));
      this.results.summary.failed++;
    }

    this.results.tests.push(result);
    this.results.summary.total++;

    return result;
  }

  async runServiceTests() {
    console.log(chalk.bold.cyan('\n🔧 Running Service Unit Tests'));

    const services = [
      'auth-service',
      'client-service',
      'policy-service',
      'control-service',
      'evidence-service',
      'workflow-service',
      'reporting-service',
      'audit-service',
      'integration-service',
      'notification-service',
      'ai-service',
    ];

    for (const service of services) {
      const testPath = `services/${service}/package.json`;

      try {
        const packageJson = JSON.parse(await fs.readFile(testPath, 'utf8'));

        if (packageJson.scripts?.test) {
          await this.runTest(`${service} unit tests`, `cd services/${service} && npm test`, {
            silent: true,
          });
        } else {
          console.log(chalk.gray(`⏭️  Skipping ${service} - no tests defined`));
          this.results.summary.skipped++;
        }
      } catch (error) {
        console.log(chalk.gray(`⏭️  Skipping ${service} - service not found`));
        this.results.summary.skipped++;
      }
    }
  }

  async runIntegrationTests() {
    console.log(chalk.bold.cyan('\n🔗 Running Integration Tests'));

    const integrationTests = [
      { name: 'Auth Flow Integration', file: 'test/integration/auth-flow.test.js' },
      { name: 'Client Management Integration', file: 'test/integration/client-management.test.js' },
      { name: 'Policy Compliance Integration', file: 'test/integration/policy-compliance.test.js' },
      { name: 'Audit Trail Integration', file: 'test/integration/audit-trail.test.js' },
      { name: 'Kafka Events Integration', file: 'test/integration/kafka-events.test.js' },
    ];

    for (const test of integrationTests) {
      try {
        await fs.access(test.file);
        await this.runTest(test.name, `node ${test.file}`);
      } catch {
        console.log(chalk.gray(`⏭️  Skipping ${test.name} - test not found`));
        this.results.summary.skipped++;
      }
    }
  }

  async runPerformanceTests() {
    console.log(chalk.bold.cyan('\n⚡ Running Performance Tests'));

    // Create a simple performance test
    const perfTest = `
const axios = require('axios');

async function testEndpointPerformance(name, url, expectedMs = 200) {
  const times = [];
  
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      await axios.get(url, { timeout: 5000 });
      times.push(Date.now() - start);
    } catch (error) {
      console.log('Request failed:', error.message);
      return false;
    }
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);
  const min = Math.min(...times);
  
  console.log(\`\${name}: avg=\${avg.toFixed(0)}ms, min=\${min}ms, max=\${max}ms\`);
  
  return avg < expectedMs;
}

async function run() {
  const tests = [
    { name: 'Auth Health', url: 'http://localhost:3001/health' },
    { name: 'Kong Admin', url: 'http://localhost:8001' },
    { name: 'Auth via Kong', url: 'http://localhost:8000/api/auth/health' }
  ];
  
  let passed = 0;
  for (const test of tests) {
    if (await testEndpointPerformance(test.name, test.url)) {
      passed++;
    }
  }
  
  console.log(\`\\nPerformance tests: \${passed}/\${tests.length} passed\`);
  process.exit(passed === tests.length ? 0 : 1);
}

run();
    `;

    await fs.writeFile('test/performance/basic-perf.js', perfTest);
    await this.runTest('Basic Performance Test', 'node test/performance/basic-perf.js');
  }

  async runSecurityTests() {
    console.log(chalk.bold.cyan('\n🔒 Running Security Tests'));

    // Create security validation tests
    const securityTests = [
      {
        name: 'JWT Token Validation',
        test: async () => {
          // Test that endpoints require valid JWT
          try {
            const response = await require('axios').get(
              'http://localhost:8000/api/clients/health',
              {
                validateStatus: () => true,
              }
            );
            return response.status === 401; // Should be unauthorized
          } catch {
            return false;
          }
        },
      },
      {
        name: 'Rate Limiting',
        test: async () => {
          // Test rate limiting on login endpoint
          const axios = require('axios');
          const requests = [];

          for (let i = 0; i < 10; i++) {
            requests.push(
              axios.post(
                'http://localhost:3001/auth/login',
                { email: 'test@test.com', password: 'wrong' },
                { validateStatus: () => true }
              )
            );
          }

          const responses = await Promise.all(requests);
          const rateLimited = responses.filter((r) => r.status === 429);

          return rateLimited.length > 0; // Should trigger rate limit
        },
      },
    ];

    for (const test of securityTests) {
      const result = await test.test();
      if (result) {
        console.log(chalk.green(`✅ ${test.name} passed`));
        this.results.summary.passed++;
      } else {
        console.log(chalk.red(`❌ ${test.name} failed`));
        this.results.summary.failed++;
      }
      this.results.summary.total++;
    }
  }

  async generateReport() {
    console.log(chalk.bold.blue('\n📊 Test Results Summary'));
    console.log(chalk.gray('═'.repeat(60)));

    const { total, passed, failed, skipped } = this.results.summary;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    console.log(`Total Tests: ${total}`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.gray(`Skipped: ${skipped}`));
    console.log(`\nPass Rate: ${this.getPassRateBar(passRate)} ${passRate}%`);

    // Save detailed report
    const reportPath = path.join(__dirname, '..', 'reports', 'test-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

    console.log(`\nDetailed report saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }

  getPassRateBar(percentage) {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    if (percentage >= 80) return chalk.green(bar);
    if (percentage >= 50) return chalk.yellow(bar);
    return chalk.red(bar);
  }
}

// Ensure required modules are installed
try {
  require('chalk');
} catch {
  console.log('Installing required dependencies...');
  execSync('npm install chalk', { stdio: 'inherit' });
}

// Run the test suite
const runner = new TestRunner();
runner.run();
