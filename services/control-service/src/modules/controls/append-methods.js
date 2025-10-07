const fs = require('fs');
const path = require('path');

// Read the original service file
const serviceFile = path.join(__dirname, 'controls.service.ts');
const serviceContent = fs.readFileSync(serviceFile, 'utf8');

// Read the missing methods
const missingMethodsFile = path.join(__dirname, 'missing-methods.ts');
const missingMethods = fs.readFileSync(missingMethodsFile, 'utf8');

// Find the last closing brace and insert methods before it
const lines = serviceContent.split('\n');
const lastLineIndex = lines.length - 1;

if (lines[lastLineIndex].trim() === '}') {
  // Insert the missing methods before the last line
  lines.splice(lastLineIndex, 0, '', ...missingMethods.split('\n'), '');
  
  // Write the updated content back
  const updatedContent = lines.join('\n');
  fs.writeFileSync(serviceFile, updatedContent);
  
  console.log('Successfully added missing methods to ControlsService!');
} else {
  console.error('Could not find the expected closing brace at the end of the file');
}