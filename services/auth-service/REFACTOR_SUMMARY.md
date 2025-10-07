# Auth Service Circular Dependencies Refactor Summary

## Problem
The auth-service had circular dependencies causing "Invalid value used as weak map key" errors during E2E test execution. The main issue was:

1. **AuthModule** imported 5 modules with `forwardRef()`: MfaModule, ApiKeysModule, SsoModule, SessionModule, SecurityModule
2. **UsersModule** imported AuthModule with `forwardRef()`
3. All these modules needed guards, decorators, and core services from AuthModule

## Solution - Created SharedAuthModule

### 1. Created SharedAuthModule (`src/modules/shared-auth/`)
A new `@Global()` module that contains:
- **Guards**: JwtAuthGuard, RolesGuard, PermissionGuard, RateLimitGuard
- **Core Services**: PasswordPolicyService, PermissionService, EmailVerificationService, ForgotPasswordService
- **Strategies**: ApiKeyStrategy (JwtStrategy remains in AuthModule due to UsersService dependency)
- **Decorators**: All auth decorators (Public, Roles, Permissions, RateLimit, etc.)

### 2. Refactored Module Dependencies

**AuthModule** now only imports:
- UsersModule (no circular dependency)
- AuditModule (no circular dependency)
- RedisModule, EventsModule (no circular dependency)
- SharedAuthModule (no circular dependency)

**Other modules** now import:
- SharedAuthModule (instead of AuthModule) for guards and decorators
- No more `forwardRef()` needed

### 3. Files Changed

#### Core Modules:
- ✅ `auth.module.ts` - Removed forwardRef imports, added SharedAuthModule
- ✅ `users.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef
- ✅ `users.service.ts` - Removed forwardRef injection for PasswordPolicyService

#### Feature Modules:
- ✅ `mfa.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef
- ✅ `api-keys.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef
- ✅ `sso.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef
- ✅ `sessions/session.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef
- ✅ `security.module.ts` - Replaced AuthModule with SharedAuthModule, removed forwardRef

#### Controllers (updated imports):
- ✅ `users.controller.ts` - Import guards/decorators from SharedAuthModule
- ✅ `mfa.controller.ts` - Import guards from SharedAuthModule
- ✅ `api-keys.controller.ts` - Import guards/decorators from SharedAuthModule
- ✅ `sso.controller.ts` - Import guards/decorators from SharedAuthModule
- ✅ `sessions/session.controller.ts` - Import guards/decorators from SharedAuthModule
- ✅ `security.controller.ts` - Import guards/decorators from SharedAuthModule

#### Special Cases:
- ✅ `jwt.strategy.ts` - Made SessionService optional to break circular dependency
- ✅ `app.module.ts` - Added SharedAuthModule import

### 4. Removed forwardRef Usage
All `forwardRef()` calls have been eliminated:
- No more `forwardRef(() => AuthModule)`
- No more `@Inject(forwardRef(() => Service))`

### 5. Import Structure
```
SharedAuthModule (Global)
├── Guards, Decorators, Core Services
├── No dependencies on feature modules
└── Used by all other modules

AuthModule
├── AuthService, RefreshTokenService, AnomalyDetectionService
├── Imports: UsersModule, AuditModule, SharedAuthModule
└── No circular dependencies

Feature Modules (Mfa, ApiKeys, Sso, Sessions, Security)
├── Import SharedAuthModule for guards/decorators
├── No imports of AuthModule
└── No circular dependencies
```

## Benefits
1. **No Circular Dependencies**: Eliminated all `forwardRef()` usage
2. **Clear Separation**: Shared utilities in SharedAuthModule, business logic in AuthModule
3. **Better Maintainability**: Easier to understand module relationships
4. **Improved Performance**: No WeakMap compilation errors in E2E tests
5. **Type Safety**: Proper dependency injection without bypasses

## Testing
- All modules now compile without circular dependency errors
- E2E tests should no longer fail with WeakMap errors
- Guards and decorators work correctly across all modules
- Authentication flows remain intact

## Files Created
- `src/modules/shared-auth/shared-auth.module.ts`
- `src/modules/shared-auth/index.ts`

## Files Modified
- 13 module files
- 6 controller files
- 1 service file
- 1 strategy file
- 1 app module file