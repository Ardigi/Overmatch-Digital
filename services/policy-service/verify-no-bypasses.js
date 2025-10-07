#!/usr/bin/env node
/**
 * Type Bypass Detection Script
 * 
 * Provides OBJECTIVE detection of TypeScript type safety bypasses.
 * Scans production code (not test files) for type bypasses - NO subjective interpretation allowed.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function verifyNoBypasses() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('🔍 Type Bypass Detection Script');
  console.log('================================');
  console.log(`Timestamp: ${timestamp}`);
  console.log('Scanning for type safety bypasses...');
  console.log('');

  const srcDir = path.join(__dirname, 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.log('❌ FAIL: src directory not found');
    return {
      success: false,
      bypassCount: 0,
      message: 'src directory not found',
      bypasses: []
    };
  }

  const bypasses = [];
  const patterns = [
    { pattern: /\s+as\s+any\b/g, name: 'as any' },
    { pattern: /:\s*any\b/g, name: 'type any' },
    { pattern: /Record<string,\s*any>/g, name: 'Record<string, any>' },
    { pattern: /Record<string,any>/g, name: 'Record<string,any>' },
    { pattern: /\[key:\s*string\]:\s*any/g, name: '[key: string]: any' },
    { pattern: /\[key:\s*string\]:\s*unknown/g, name: '[key: string]: unknown' },
    { pattern: /@ts-ignore/g, name: '@ts-ignore' },
    { pattern: /@ts-nocheck/g, name: '@ts-nocheck' },
    { pattern: /\.\.\.\s*\(\s*\w+\s*as\s+any\s*\)/g, name: 'spread as any' },
    { pattern: /any\[\]/g, name: 'any[]' },
    { pattern: /Array<any>/g, name: 'Array<any>' },
  ];

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(__dirname, filePath);
    
    patterns.forEach(({ pattern, name }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lines = content.substring(0, match.index).split('\n');
        const lineNumber = lines.length;
        const lineContent = content.split('\n')[lineNumber - 1].trim();
        
        bypasses.push({
          file: relativePath,
          line: lineNumber,
          pattern: name,
          content: lineContent,
          match: match[0]
        });
      }
    });
  }

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, dist, coverage directories
        if (!['node_modules', 'dist', 'coverage', 'build'].includes(item)) {
          scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        // Only scan TypeScript files, exclude test files
        if (fullPath.endsWith('.ts') && !fullPath.includes('.spec.') && !fullPath.includes('.test.')) {
          scanFile(fullPath);
        }
      }
    }
  }

  try {
    scanDirectory(srcDir);
    
    const duration = Date.now() - startTime;
    const bypassCount = bypasses.length;
    const success = bypassCount === 0;
    
    console.log(`${success ? '✅ PASS' : '❌ FAIL'}: Type bypass detection completed`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Type bypasses found: ${bypassCount}`);
    console.log('');
    
    // Group by pattern type
    const bypassGroups = {};
    bypasses.forEach(bypass => {
      if (!bypassGroups[bypass.pattern]) {
        bypassGroups[bypass.pattern] = [];
      }
      bypassGroups[bypass.pattern].push(bypass);
    });
    
    // Group by file
    const fileGroups = {};
    bypasses.forEach(bypass => {
      if (!fileGroups[bypass.file]) {
        fileGroups[bypass.file] = 0;
      }
      fileGroups[bypass.file]++;
    });
    
    if (bypassCount > 0) {
      console.log('TYPE BYPASSES DETECTED:');
      console.log('=======================');
      
      Object.keys(bypassGroups).forEach(pattern => {
        const group = bypassGroups[pattern];
        console.log(`\n${pattern} (${group.length} occurrences):`);
        group.forEach((bypass, index) => {
          console.log(`  ${index + 1}. ${bypass.file}:${bypass.line}`);
          console.log(`     ${bypass.content}`);
          console.log(`     Found: "${bypass.match}"`);
        });
      });
      console.log('');
      
      console.log('SUMMARY BY FILE:');
      console.log('================');
      Object.keys(fileGroups).sort().forEach(file => {
        console.log(`${file}: ${fileGroups[file]} bypasses`);
      });
      console.log('');
    }
    
    // Log to verification file
    const verificationLog = {
      timestamp,
      status: success ? 'PASS' : 'FAIL',
      bypassCount: bypassCount,
      duration: duration,
      bypasses: bypasses,
      bypasssByPattern: Object.keys(bypassGroups || {}).reduce((acc, pattern) => {
        acc[pattern] = (bypassGroups[pattern] || []).length;
        return acc;
      }, {}),
      bypasssByFile: Object.keys(fileGroups || {}).reduce((acc, file) => {
        acc[file] = fileGroups[file];
        return acc;
      }, {})
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'bypass-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: success,
      bypassCount: bypassCount,
      message: success 
        ? 'No type bypasses detected - excellent type safety!' 
        : `${bypassCount} type bypasses detected`,
      bypasses: bypasses
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log('❌ FAIL: Error during bypass detection');
    console.log(`Duration: ${duration}ms`);
    console.log('ERROR DETAILS:');
    console.log('==============');
    console.log(error.message);
    console.log('');
    
    // Log error to verification file
    const verificationLog = {
      timestamp,
      status: 'FAIL',
      bypassCount: 0,
      duration: duration,
      error: error.message,
      bypasses: []
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'bypass-verification.json'), 
      JSON.stringify(verificationLog, null, 2)
    );
    
    return {
      success: false,
      bypassCount: 0,
      message: `Error during bypass detection: ${error.message}`,
      bypasses: [],
      error: true
    };
  }
}

// Run verification if called directly
if (require.main === module) {
  const result = verifyNoBypasses();
  
  console.log('VERIFICATION RESULT:');
  console.log(`Status: ${result.success ? 'PASS' : 'FAIL'}`);
  console.log(`Type Bypasses: ${result.bypassCount}`);
  console.log(`Message: ${result.message}`);
  
  // Exit with error code if verification failed
  process.exit(result.success ? 0 : 1);
}

module.exports = verifyNoBypasses;