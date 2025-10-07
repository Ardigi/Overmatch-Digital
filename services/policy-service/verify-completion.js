#!/usr/bin/env node
/**
 * Combined Verification Script
 * 
 * Provides OBJECTIVE verification of complete Policy Service type safety.
 * Runs ALL verification checks and requires ALL to pass for success.
 * NO SUCCESS until ALL verifications pass - prevents false completion claims.
 */

const verifyTypeScript = require('./verify-typescript');
const verifyTests = require('./verify-tests');
const verifyNoBypasses = require('./verify-no-bypasses');
const fs = require('fs');
const path = require('path');

function verifyCompletion() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('🎯 Policy Service Completion Verification');
  console.log('==========================================');
  console.log(`Timestamp: ${timestamp}`);
  console.log('Running ALL verification checks...');
  console.log('');
  console.log('SUCCESS CRITERIA:');
  console.log('- TypeScript compilation: 0 errors');
  console.log('- Unit tests: All passing');
  console.log('- Type bypasses: 0 found in production code');
  console.log('');

  const results = {
    typescript: null,
    tests: null,
    bypasses: null,
    overall: {
      success: false,
      startTime: timestamp,
      duration: 0,
      message: ''
    }
  };

  try {
    console.log('🔄 Step 1/3: TypeScript Compilation Check');
    console.log('==========================================');
    results.typescript = verifyTypeScript();
    console.log('');

    console.log('🔄 Step 2/3: Unit Test Execution');
    console.log('================================');
    results.tests = verifyTests();
    console.log('');

    console.log('🔄 Step 3/3: Type Bypass Detection');
    console.log('===================================');
    results.bypasses = verifyNoBypasses();
    console.log('');

  } catch (error) {
    console.log('❌ CRITICAL ERROR during verification');
    console.log('Error:', error.message);
    
    results.overall.success = false;
    results.overall.message = `Critical error during verification: ${error.message}`;
    results.overall.duration = Date.now() - startTime;
    
    logResults(results);
    return results;
  }

  // Calculate overall success
  const allPassed = results.typescript.success && 
                   results.tests.success && 
                   results.bypasses.success;

  results.overall.success = allPassed;
  results.overall.duration = Date.now() - startTime;

  // Generate detailed summary
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=======================');
  console.log(`Overall Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Total Duration: ${results.overall.duration}ms`);
  console.log('');

  console.log('Individual Check Results:');
  console.log(`1. TypeScript: ${results.typescript.success ? '✅ PASS' : '❌ FAIL'} (${results.typescript.errorCount} errors)`);
  console.log(`2. Tests: ${results.tests.success ? '✅ PASS' : '❌ FAIL'} (${results.tests.passed} passed, ${results.tests.failed} failed)`);
  console.log(`3. Bypasses: ${results.bypasses.success ? '✅ PASS' : '❌ FAIL'} (${results.bypasses.bypassCount} bypasses found)`);
  console.log('');

  if (allPassed) {
    results.overall.message = '🎉 ALL VERIFICATIONS PASSED - Policy Service is complete!';
    console.log('🎉 SUCCESS: ALL VERIFICATIONS PASSED');
    console.log('====================================');
    console.log('Policy Service has achieved complete type safety:');
    console.log(`✅ TypeScript compilation: 0 errors`);
    console.log(`✅ Unit tests: ${results.tests.passed}/${results.tests.total} passing`);
    console.log(`✅ Type bypasses: 0 found in production code`);
    console.log('');
    console.log('🏆 POLICY SERVICE IS ENTERPRISE READY! 🏆');
  } else {
    results.overall.message = '❌ VERIFICATION FAILED - Policy Service is NOT complete';
    console.log('❌ FAILURE: NOT ALL VERIFICATIONS PASSED');
    console.log('==========================================');
    console.log('Policy Service has NOT achieved complete type safety:');
    
    if (!results.typescript.success) {
      console.log(`❌ TypeScript compilation: ${results.typescript.errorCount} errors`);
    } else {
      console.log(`✅ TypeScript compilation: 0 errors`);
    }
    
    if (!results.tests.success) {
      console.log(`❌ Unit tests: ${results.tests.failed} failed, ${results.tests.passed} passed`);
    } else {
      console.log(`✅ Unit tests: ${results.tests.passed}/${results.tests.total} passing`);
    }
    
    if (!results.bypasses.success) {
      console.log(`❌ Type bypasses: ${results.bypasses.bypassCount} found in production code`);
    } else {
      console.log(`✅ Type bypasses: 0 found in production code`);
    }
    
    console.log('');
    console.log('🚨 POLICY SERVICE IS NOT COMPLETE - FIX ISSUES ABOVE 🚨');
  }

  console.log('');
  logResults(results);
  
  return results;
}

function logResults(results) {
  const verificationLog = {
    ...results,
    completionCriteria: {
      typescriptErrors: results.typescript?.errorCount || 'unknown',
      testsPassing: results.tests ? `${results.tests.passed}/${results.tests.total}` : 'unknown',
      typeBypassesFound: results.bypasses?.bypassCount || 'unknown'
    },
    recommendations: generateRecommendations(results)
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'completion-verification.json'), 
    JSON.stringify(verificationLog, null, 2)
  );
  
  // Also create a simple status file for quick checking
  const statusFile = {
    completed: results.overall.success,
    timestamp: results.overall.startTime,
    summary: results.overall.message
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'completion-status.json'), 
    JSON.stringify(statusFile, null, 2)
  );
}

function generateRecommendations(results) {
  const recommendations = [];
  
  if (results.typescript && !results.typescript.success) {
    recommendations.push({
      area: 'TypeScript',
      issue: `${results.typescript.errorCount} compilation errors`,
      action: 'Run `node verify-typescript.js` for detailed error list and fix each error'
    });
  }
  
  if (results.tests && !results.tests.success) {
    recommendations.push({
      area: 'Tests',
      issue: `${results.tests.failed} failing tests`,
      action: 'Run `node verify-tests.js` for detailed failure list and fix failing tests'
    });
  }
  
  if (results.bypasses && !results.bypasses.success) {
    recommendations.push({
      area: 'Type Safety',
      issue: `${results.bypasses.bypassCount} type bypasses found`,
      action: 'Run `node verify-no-bypasses.js` for detailed bypass list and eliminate all type bypasses'
    });
  }
  
  if (results.overall.success) {
    recommendations.push({
      area: 'Success',
      issue: 'All verifications passed',
      action: 'Policy Service is complete and ready for production!'
    });
  }
  
  return recommendations;
}

// Run verification if called directly
if (require.main === module) {
  console.log('Starting comprehensive Policy Service verification...\n');
  
  const result = verifyCompletion();
  
  console.log('\n=== FINAL VERIFICATION RESULT ===');
  console.log(`Status: ${result.overall.success ? 'COMPLETE' : 'INCOMPLETE'}`);
  console.log(`Message: ${result.overall.message}`);
  console.log('================================\n');
  
  // Exit with error code if verification failed
  process.exit(result.overall.success ? 0 : 1);
}

module.exports = verifyCompletion;