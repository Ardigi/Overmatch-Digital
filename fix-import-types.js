const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript files
const files = glob.sync('services/auth-service/src/**/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  // Fix import type { ConfigService } from '@nestjs/config'
  if (content.includes("import type { ConfigService } from '@nestjs/config'")) {
    content = content.replace(
      "import type { ConfigService } from '@nestjs/config'",
      "import { ConfigService } from '@nestjs/config'"
    );
    modified = true;
  }
  
  // Fix import type { JwtService } from '@nestjs/jwt'
  if (content.includes("import type { JwtService } from '@nestjs/jwt'")) {
    content = content.replace(
      "import type { JwtService } from '@nestjs/jwt'",
      "import { JwtService } from '@nestjs/jwt'"
    );
    modified = true;
  }
  
  // Fix import type { Repository } from 'typeorm'
  if (content.includes("import type { Repository } from 'typeorm'")) {
    content = content.replace(
      "import type { Repository } from 'typeorm'",
      "import { Repository } from 'typeorm'"
    );
    modified = true;
  }
  
  // Fix mixed imports like: import { Injectable, type OnModuleInit }
  // We need to be more careful here
  const mixedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@nestjs\/[^'"]+['"]/g;
  const matches = content.match(mixedImportRegex);
  
  if (matches) {
    matches.forEach(match => {
      // Check if it contains 'type' keyword for injectable services
      if (match.includes('type')) {
        // Extract the module name
        const moduleMatch = match.match(/from\s+['"](@nestjs\/[^'"]+)['"]/);
        if (moduleMatch) {
          const moduleName = moduleMatch[1];
          
          // Parse imports
          const importsMatch = match.match(/\{([^}]+)\}/);
          if (importsMatch) {
            const imports = importsMatch[1].split(',').map(i => i.trim());
            const regularImports = [];
            const typeImports = [];
            
            imports.forEach(imp => {
              if (imp.startsWith('type ')) {
                typeImports.push(imp.substring(5).trim());
              } else {
                regularImports.push(imp);
              }
            });
            
            // For NestJS modules, certain types should NOT be type imports
            const injectableTypes = ['ConfigService', 'JwtService', 'Reflector', 'ModuleRef'];
            const fixedRegularImports = [...regularImports];
            const fixedTypeImports = [];
            
            typeImports.forEach(typeImp => {
              const cleanType = typeImp.replace(/\s+as\s+.+/, ''); // Remove 'as' aliases
              if (injectableTypes.some(t => cleanType.includes(t))) {
                fixedRegularImports.push(typeImp);
              } else {
                fixedTypeImports.push(typeImp);
              }
            });
            
            // Rebuild import statement
            let newImport = '';
            if (fixedRegularImports.length > 0) {
              newImport = `import { ${fixedRegularImports.join(', ')} } from '${moduleName}'`;
            }
            if (fixedTypeImports.length > 0) {
              if (newImport) {
                newImport += `;\nimport type { ${fixedTypeImports.join(', ')} } from '${moduleName}'`;
              } else {
                newImport = `import type { ${fixedTypeImports.join(', ')} } from '${moduleName}'`;
              }
            }
            
            if (newImport && newImport !== match) {
              content = content.replace(match, newImport);
              modified = true;
            }
          }
        }
      }
    });
  }
  
  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
});

console.log('Done fixing import types');