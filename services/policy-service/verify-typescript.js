#!/usr/bin/env node
/**
 * TypeScript Verification Script
 * 
 * Provides OBJECTIVE verification of TypeScript compilation status.
 * Returns PASS/FAIL with exact error counts - NO subjective interpretation allowed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function verifyTypeScript() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('🔍 TypeScript Verification Script');
  console.log('==================================');
  console.log(`Timestamp: ${timestamp}`);
  console.log('Running: npx tsc --noEmit');
  console.log('');

  try {
    // Run TypeScript compilation check
    const output = execSync('npx tsc --noEmit', { 
      encoding: 'utf8',
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // If we get here, compilation succeeded
    const duration = Date.now() - startTime;
    
    console.log('✅ PASS: TypeScript compilation successful');
    console.log(`Duration: ${duration}ms`);
    console.log('Error count: 0');
    console.log('');
    
    // Log to verification file
    const verificationLog = {
      timestamp,
      status: 'PASS',
      errorCount: 0,
      duration: duration,
      command: 'npx tsc --noEmit',
      output: 'Compilation successful - no errors'
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'typescript-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: true,
      errorCount: 0,
      message: 'TypeScript compilation successful'
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorOutput = error.stdout || error.message || 'Unknown error';
    
    // Count TypeScript errors by counting lines that contain error patterns
    const errorLines = errorOutput.split('\n').filter(line => {
      return line.includes('error TS') || 
             line.match(/:\s*error\s*TS\d+:/) ||
             line.includes(') : error TS');
    });
    
    const errorCount = errorLines.length;
    
    console.log('❌ FAIL: TypeScript compilation failed');
    console.log(`Duration: ${duration}ms`);
    console.log(`Error count: ${errorCount}`);
    console.log('');
    console.log('ERROR DETAILS:');
    console.log('==============');
    console.log(errorOutput);
    console.log('');
    
    // Extract unique error types for analysis
    const errorTypes = new Set();
    errorLines.forEach(line => {
      const match = line.match(/error (TS\d+):/);
      if (match) {
        errorTypes.add(match[1]);
      }
    });
    
    console.log('ERROR SUMMARY:');
    console.log(`Total errors: ${errorCount}`);
    console.log(`Unique error types: ${Array.from(errorTypes).join(', ')}`);
    console.log('');
    
    // Log to verification file
    const verificationLog = {
      timestamp,
      status: 'FAIL',
      errorCount: errorCount,
      duration: duration,
      command: 'npx tsc --noEmit',
      errorTypes: Array.from(errorTypes),
      output: errorOutput,
      errorLines: errorLines
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'typescript-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: false,
      errorCount: errorCount,
      message: `TypeScript compilation failed with ${errorCount} errors`,
      errors: errorLines
    };
  }
}

// Run verification if called directly
if (require.main === module) {
  const result = verifyTypeScript();
  
  console.log('VERIFICATION RESULT:');
  console.log(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
  console.log(`Error Count: ${result.errorCount}`);
  console.log(`Message: ${result.message}`);
  
  // Exit with error code if verification failed
  process.exit(result.success ? 0 : 1);
}

module.exports = verifyTypeScript;