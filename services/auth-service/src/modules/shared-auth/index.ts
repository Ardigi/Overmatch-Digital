// Re-export everything from the shared auth module for easy imports

export { RateLimitGuard } from '../../common/guards/rate-limit.guard';
export {
  CanAccessOwnResource,
  Permissions,
  RequirePermissions,
} from '../auth/decorators/permissions.decorator';
// Re-export decorators for easy importing by other modules
export { Public } from '../auth/decorators/public.decorator';
export { RateLimit } from '../auth/decorators/rate-limit.decorator';
export { Roles } from '../auth/decorators/roles.decorator';
export { EmailVerificationService } from '../auth/email-verification.service';
export { ForgotPasswordService } from '../auth/forgot-password.service';
// Re-export guards for easy importing by other modules
export { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
export { PermissionGuard } from '../auth/guards/permission.guard';
export { RolesGuard } from '../auth/guards/roles.guard';
// Re-export services
export { PasswordPolicyService } from '../auth/password-policy.service';
export { PermissionService } from '../auth/permission.service';
export * from './shared-auth.module';

// Note: ApiKeyStrategy is now provided by ApiKeysModule to avoid circular dependencies
