# Keycloak Service Mocking Pattern

**Date**: October 7, 2025
**Issue**: jwks-rsa ES Module Import Error
**Status**: ✅ RESOLVED

---

## Problem

The `keycloak.service.ts` file uses `const jwksClient = require('jwks-rsa')` at line 4, which triggers an ES module syntax error when imported in Jest tests:

```
SyntaxError: Unexpected token 'export'
export { compactDecrypt } from './jwe/compact/decrypt.js';
```

This occurred in 3 test files:
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/auth/auth.controller.spec.ts`
- `src/modules/auth/auth.controller.owasp.spec.ts`

---

## Root Cause

1. `jwks-rsa` is an ES module
2. Jest's `transformIgnorePatterns` is configured to transform it
3. **However**, when a test file imports a module that imports `keycloak.service.ts`, Jest tries to execute the `require('jwks-rsa')` statement
4. This happens **before** the transformation can occur, causing the ES module syntax error

---

## Solution

Mock the entire `keycloak.service.ts` module **at the top of the test file**, before any imports:

```typescript
// Mock keycloak.service BEFORE imports to avoid jwks-rsa ES module issue
jest.mock('../keycloak/keycloak.service', () => ({
  KeycloakService: jest.fn().mockImplementation(() => ({
    onModuleInit: jest.fn(),
    initialize: jest.fn(),
    createUser: jest.fn(),
    getUserById: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    assignRole: jest.fn(),
    removeRole: jest.fn(),
    validateToken: jest.fn(),
    refreshTokens: jest.fn(), // Important: Add any methods used in production code
  })),
}));

// NOW import the modules that use keycloak.service
import { AuthService } from './auth.service';
// ... other imports
```

### Key Points

1. **Order matters**: `jest.mock()` MUST be called before any imports
2. **Complete mock**: Include all methods that production code calls
3. **Returns undefined by default**: Each mocked method returns `undefined` unless configured in tests
4. **Test-specific behavior**: Configure return values in individual tests using `.mockResolvedValue()`, `.mockReturnValue()`, etc.

---

## Why This Works

1. `jest.mock()` is hoisted by Jest to the top of the file
2. When Jest encounters an import that includes `keycloak.service.ts`, it uses the mock instead of the real file
3. The real `keycloak.service.ts` (and its `require('jwks-rsa')`) is never loaded
4. No ES module syntax error occurs

---

## Alternative Solutions Considered

### ❌ Option 1: Use `jest.unmock('jwks-rsa')`
**Why it doesn't work**: `moduleNameMapper` in `jest.config.js` overrides `jest.unmock()`

### ❌ Option 2: Change production code to use `import`
**Why we didn't**: Violates TDD principle - never change production code to make tests pass

### ❌ Option 3: Mock jwks-rsa directly
**Why we didn't**: The issue occurs during module loading, before we can mock individual dependencies

---

## Testing Results

**Before fix**:
- 15/18 test suites passing (83%)
- 3 test files completely blocked

**After fix**:
- 17/18 test suites passing (94%)
- All 3 previously blocked files now run
- Only minor mock configuration issues remain (not ES module errors)

---

## When to Use This Pattern

Use this mocking pattern whenever a module:
1. Uses `require()` to import an ES module
2. Is imported (directly or indirectly) by test files
3. Causes "Unexpected token 'export'" errors during test execution

Common scenarios:
- Keycloak integration
- JWKS/JWT validation
- Third-party authentication libraries
- Any module mixing CommonJS and ES modules

---

## Example: Complete Test File Pattern

```typescript
// ============================================
// 1. MOCK EXTERNAL DEPENDENCIES FIRST
// ============================================
jest.mock('../keycloak/keycloak.service', () => ({
  KeycloakService: jest.fn().mockImplementation(() => ({
    onModuleInit: jest.fn(),
    validateToken: jest.fn(),
    // ... all methods used in production code
  })),
}));

// ============================================
// 2. NOW IMPORT MODULES
// ============================================
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

// ============================================
// 3. DESCRIBE TESTS
// ============================================
describe('AuthService', () => {
  let service: AuthService;
  // ... test setup

  beforeEach(() => {
    // Manual instantiation pattern for TypeORM compatibility
    service = new AuthService(/* mocked dependencies */);
  });

  it('should validate tokens', async () => {
    // Configure mock behavior for this specific test
    const mockKeycloak = {
      validateToken: jest.fn().mockResolvedValue({ valid: true }),
    };

    // ... test implementation
  });
});
```

---

## Related Documentation

- [Jest Configuration](../services/auth-service/jest.config.js) - Line 54-56: `transformIgnorePatterns`
- [Dual Jest Config Implementation](../DUAL_JEST_CONFIG_IMPLEMENTATION.md) - Full testing strategy
- [Test Execution Report](../TEST_EXECUTION_REPORT.md) - Initial problem identification

---

## Maintenance Notes

When adding new methods to `KeycloakService`:

1. Add the method to the production code
2. Update all 3 mock definitions:
   - `auth.service.spec.ts`
   - `auth.controller.spec.ts`
   - `auth.controller.owasp.spec.ts`
3. Write tests for the new functionality
4. Configure mock return values in tests

---

**Pattern Status**: ✅ Production Ready
**Last Updated**: October 7, 2025
**Next Review**: When upgrading `jwks-rsa` or Jest major versions
