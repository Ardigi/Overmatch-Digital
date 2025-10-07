#!/usr/bin/env node
/**
 * Test Verification Script
 * 
 * Provides OBJECTIVE verification of Jest test execution status.
 * Returns PASS/FAIL with exact pass/fail counts - NO subjective interpretation allowed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function verifyTests() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('🧪 Test Verification Script');
  console.log('===========================');
  console.log(`Timestamp: ${timestamp}`);
  console.log('Running: npm test');
  console.log('');

  try {
    // Run tests with Jest
    const output = execSync('npm test', { 
      encoding: 'utf8',
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' } // Ensure non-interactive mode
    });
    
    const duration = Date.now() - startTime;
    
    // Parse Jest output for test results
    const testResults = parseJestOutput(output);
    
    const success = testResults.failed === 0 && testResults.passed > 0;
    
    console.log(`${success ? '✅ PASS' : '❌ FAIL'}: Test execution completed`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Tests passed: ${testResults.passed}`);
    console.log(`Tests failed: ${testResults.failed}`);
    console.log(`Test suites passed: ${testResults.suitesPassed}`);
    console.log(`Test suites failed: ${testResults.suitesFailed}`);
    console.log(`Total tests: ${testResults.total}`);
    console.log('');
    
    if (testResults.failedTests.length > 0) {
      console.log('FAILED TESTS:');
      console.log('=============');
      testResults.failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test}`);
      });
      console.log('');
    }
    
    // Log to verification file
    const verificationLog = {
      timestamp,
      status: success ? 'PASS' : 'FAIL',
      duration: duration,
      command: 'npm test',
      testResults: testResults,
      output: output
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'test-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: success,
      passed: testResults.passed,
      failed: testResults.failed,
      total: testResults.total,
      message: success 
        ? `All ${testResults.passed} tests passed` 
        : `${testResults.failed} tests failed out of ${testResults.total}`,
      failedTests: testResults.failedTests
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorOutput = error.stdout || error.stderr || error.message || 'Unknown error';
    
    // Try to parse test results even from error output
    const testResults = parseJestOutput(errorOutput);
    
    console.log('❌ FAIL: Test execution failed');
    console.log(`Duration: ${duration}ms`);
    console.log(`Tests passed: ${testResults.passed}`);
    console.log(`Tests failed: ${testResults.failed}`);
    console.log(`Total tests: ${testResults.total}`);
    console.log('');
    console.log('ERROR DETAILS:');
    console.log('==============');
    console.log(errorOutput);
    console.log('');
    
    // Log to verification file
    const verificationLog = {
      timestamp,
      status: 'FAIL',
      duration: duration,
      command: 'npm test',
      testResults: testResults,
      output: errorOutput,
      error: true
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'test-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: false,
      passed: testResults.passed,
      failed: testResults.failed,
      total: testResults.total,
      message: `Test execution failed: ${testResults.failed} failed, ${testResults.passed} passed`,
      failedTests: testResults.failedTests,
      error: true
    };
  }
}

function parseJestOutput(output) {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    suitesPassed: 0,
    suitesFailed: 0,
    failedTests: []
  };
  
  // Parse Jest summary lines
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Look for test suite results
    if (line.includes('Test Suites:')) {
      const match = line.match(/(\d+)\s+failed.*?(\d+)\s+passed/);
      if (match) {
        results.suitesFailed = parseInt(match[1]);
        results.suitesPassed = parseInt(match[2]);
      } else {
        const passMatch = line.match(/(\d+)\s+passed/);
        if (passMatch) {
          results.suitesPassed = parseInt(passMatch[1]);
        }
      }
    }
    
    // Look for individual test results
    if (line.includes('Tests:')) {
      const match = line.match(/(\d+)\s+failed.*?(\d+)\s+passed/);
      if (match) {
        results.failed = parseInt(match[1]);
        results.passed = parseInt(match[2]);
      } else {
        const passMatch = line.match(/(\d+)\s+passed/);
        if (passMatch) {
          results.passed = parseInt(passMatch[1]);
        }
        const failMatch = line.match(/(\d+)\s+failed/);
        if (failMatch) {
          results.failed = parseInt(failMatch[1]);
        }
      }
    }
    
    // Look for failed test names
    if (line.includes('✕') || line.includes('FAIL')) {
      const testMatch = line.match(/✕\s+(.+)|FAIL\s+(.+)/);
      if (testMatch) {
        const testName = testMatch[1] || testMatch[2];
        if (testName && !results.failedTests.includes(testName.trim())) {
          results.failedTests.push(testName.trim());
        }
      }
    }
  }
  
  results.total = results.passed + results.failed;
  
  return results;
}

// Run verification if called directly
if (require.main === module) {
  const result = verifyTests();
  
  console.log('VERIFICATION RESULT:');
  console.log(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
  console.log(`Tests Passed: ${result.passed}`);
  console.log(`Tests Failed: ${result.failed}`);
  console.log(`Total Tests: ${result.total}`);
  console.log(`Message: ${result.message}`);
  
  // Exit with error code if verification failed
  process.exit(result.success ? 0 : 1);
}

module.exports = verifyTests;