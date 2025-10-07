const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Injectable services that should never be type imports
const INJECTABLE_SERVICES = [
  'ConfigService',
  'JwtService',
  'Reflector',
  'ModuleRef',
  'Repository',
  'HttpService',
  'HttpClientService',
  'CircuitBreakerService',
  'RequestContextService',
  'ServiceDiscoveryService',
  'KafkaService',
  'EventHandlerService',
  'EventsService',
  'EventEmitter2',
  'SecretsMonitoringService',
  'SecretsHealthCheckService',
  'MetricsService',
  'TracingService',
  'LoggingService',
  'SecretsManagerService',
  'DynamicConfigService',
  'RedisService',
  'UsersService',
  'AuthService',
  'MfaService',
  'SessionService',
  'AuditService',
  'EmailService',
  'NotificationService',
  'PermissionService',
  'RoleService',
  'OrganizationService',
  'ClientService'
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix import type for injectable services
  INJECTABLE_SERVICES.forEach(service => {
    // Fix: import type { ServiceName } from
    const typeImportRegex = new RegExp(`import type \\{ ([^}]*\\b${service}\\b[^}]*) \\} from`, 'g');
    if (typeImportRegex.test(content)) {
      content = content.replace(typeImportRegex, (match, imports) => {
        // Remove 'type' for this service
        return `import { ${imports} } from`;
      });
      modified = true;
    }
    
    // Fix: import { type ServiceName } from
    const mixedImportRegex = new RegExp(`import \\{([^}]*type\\s+${service}[^}]*)\\} from`, 'g');
    if (mixedImportRegex.test(content)) {
      content = content.replace(mixedImportRegex, (match, imports) => {
        // Remove 'type' prefix for this service
        const fixed = imports.replace(new RegExp(`\\btype\\s+${service}\\b`, 'g'), service);
        return `import {${fixed}} from`;
      });
      modified = true;
    }
    
    // Fix: import type { ServiceName } from './local'
    const localTypeImportRegex = new RegExp(`import type \\{ ([^}]*\\b${service}\\b[^}]*) \\} from ['"]\\./`, 'g');
    if (localTypeImportRegex.test(content)) {
      content = content.replace(localTypeImportRegex, (match, imports, quote) => {
        return `import { ${imports} } from './`;
      });
      modified = true;
    }
    
    // Fix: import { type ServiceName } from './local'
    const localMixedImportRegex = new RegExp(`import \\{([^}]*type\\s+${service}[^}]*)\\} from ['"]\\./`, 'g');
    if (localMixedImportRegex.test(content)) {
      content = content.replace(localMixedImportRegex, (match, imports) => {
        const fixed = imports.replace(new RegExp(`\\btype\\s+${service}\\b`, 'g'), service);
        return `import {${fixed}} from './`;
      });
      modified = true;
    }
  });
  
  return { content, modified };
}

// Process all TypeScript files in packages and services
const patterns = [
  'packages/*/src/**/*.ts',
  'services/*/src/**/*.ts'
];

let totalFixed = 0;

patterns.forEach(pattern => {
  const files = glob.sync(pattern);
  
  files.forEach(file => {
    const { content, modified } = fixFile(file);
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Fixed: ${file}`);
      totalFixed++;
    }
  });
});

console.log(`\nTotal files fixed: ${totalFixed}`);