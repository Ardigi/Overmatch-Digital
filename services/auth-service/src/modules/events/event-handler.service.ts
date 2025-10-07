import { Injectable, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuthEventType, KafkaService } from './kafka.service';

@Injectable()
export class EventHandlerService implements OnModuleInit {
  constructor(private kafkaService: KafkaService) {}

  onModuleInit() {
    // Service is ready
  }

  // User events
  @OnEvent('user.created')
  async handleUserCreated(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_CREATED,
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      timestamp: new Date(),
      metadata: {
        email: payload.user.email,
        createdBy: payload.createdBy?.id,
      },
    });

    // Request welcome email
    await this.kafkaService.requestNotification({
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      type: 'welcome_email',
      channel: 'email',
      template: 'user-welcome',
      data: {
        firstName: payload.user.firstName,
        email: payload.user.email,
        organizationName: payload.user.organization?.name,
      },
    });
  }

  @OnEvent('user.invited')
  async handleUserInvited(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_INVITED,
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      timestamp: new Date(),
      metadata: {
        email: payload.user.email,
        invitedBy: payload.invitedBy?.id,
        inviteToken: payload.inviteToken,
      },
    });

    // Request invitation email
    await this.kafkaService.requestNotification({
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      type: 'user_invitation',
      channel: 'email',
      template: 'user-invitation',
      data: {
        firstName: payload.user.firstName,
        email: payload.user.email,
        inviteLink: payload.inviteLink,
        invitedBy: payload.invitedBy?.fullName,
        organizationName: payload.user.organization?.name,
      },
      priority: 'high',
    });
  }

  @OnEvent('user.updated')
  async handleUserUpdated(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_UPDATED,
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      timestamp: new Date(),
      metadata: {
        updatedBy: payload.updatedBy?.id,
        changes: payload.changes,
      },
    });
  }

  @OnEvent('user.suspended')
  async handleUserSuspended(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_SUSPENDED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        suspendedBy: payload.suspendedBy?.id,
        reason: payload.reason,
      },
    });
  }

  @OnEvent('user.activated')
  async handleUserActivated(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_ACTIVATED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        activatedBy: payload.activatedBy?.id,
      },
    });
  }

  // Authentication events
  @OnEvent('user.login')
  async handleUserLogin(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_LOGIN,
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      timestamp: payload.timestamp,
      metadata: {
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
    });

    // Also publish audit event
    await this.kafkaService.publishAuditEvent({
      action: 'user.login',
      userId: payload.user.id,
      organizationId: payload.user.organizationId,
      metadata: {
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
      },
      status: 'success',
    });
  }

  @OnEvent('user.logout')
  async handleUserLogout(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_LOGOUT,
      userId: payload.userId,
      timestamp: payload.timestamp,
      metadata: {
        sessionId: payload.sessionId,
      },
    });
  }

  @OnEvent('user.login.failed')
  async handleLoginFailed(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_LOGIN_FAILED,
      userId: payload.userId,
      timestamp: new Date(),
      metadata: {
        email: payload.email,
        ipAddress: payload.ipAddress,
        reason: payload.reason,
      },
    });

    // Publish audit event
    await this.kafkaService.publishAuditEvent({
      action: 'user.login.failed',
      userId: payload.userId,
      metadata: {
        email: payload.email,
        ipAddress: payload.ipAddress,
        reason: payload.reason,
      },
      status: 'failed',
      errorMessage: payload.reason,
    });
  }

  @OnEvent('user.locked')
  async handleUserLocked(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.USER_LOCKED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        reason: payload.reason,
        lockedUntil: payload.lockedUntil,
      },
    });

    // Request account locked notification
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId,
      type: 'account_locked',
      channel: 'email',
      template: 'account-locked',
      data: {
        reason: payload.reason,
        lockedUntil: payload.lockedUntil,
      },
      priority: 'high',
    });
  }

  // Password events
  @OnEvent('password.changed')
  async handlePasswordChanged(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.PASSWORD_CHANGED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        changedBy: payload.changedBy?.id,
      },
    });

    // Request password change notification
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId,
      type: 'password_changed',
      channel: 'email',
      template: 'password-changed',
      data: {
        timestamp: new Date(),
      },
      priority: 'high',
    });
  }

  @OnEvent('password.reset.requested')
  async handlePasswordResetRequested(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.PASSWORD_RESET_REQUESTED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        resetToken: payload.resetToken,
        expiresAt: payload.expiresAt,
      },
    });

    // Request password reset email
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId,
      type: 'password_reset',
      channel: 'email',
      template: 'password-reset',
      data: {
        resetLink: payload.resetLink,
        expiresAt: payload.expiresAt,
      },
      priority: 'critical',
    });
  }

  // MFA events
  @OnEvent('user.mfa.enabled')
  async handleMfaEnabled(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.MFA_ENABLED,
      userId: payload.userId,
      timestamp: payload.timestamp,
    });

    // Request MFA enabled notification
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId || '',
      type: 'mfa_enabled',
      channel: 'email',
      template: 'mfa-enabled',
      data: {
        timestamp: payload.timestamp,
      },
    });
  }

  @OnEvent('user.mfa.disabled')
  async handleMfaDisabled(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.MFA_DISABLED,
      userId: payload.userId,
      timestamp: payload.timestamp,
    });

    // Request MFA disabled notification (security alert)
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId || '',
      type: 'mfa_disabled',
      channel: 'email',
      template: 'mfa-disabled',
      data: {
        timestamp: payload.timestamp,
      },
      priority: 'critical',
    });
  }

  // Email verification events
  @OnEvent('email.verification.requested')
  async handleEmailVerificationRequested(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.EMAIL_VERIFICATION_REQUESTED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        email: payload.email,
        verificationToken: payload.verificationToken,
      },
    });

    // Request verification email
    await this.kafkaService.requestNotification({
      userId: payload.userId,
      organizationId: payload.organizationId,
      type: 'email_verification',
      channel: 'email',
      template: 'email-verification',
      data: {
        email: payload.email,
        verificationLink: payload.verificationLink,
        expiresAt: payload.expiresAt,
      },
      priority: 'high',
    });
  }

  @OnEvent('email.verified')
  async handleEmailVerified(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.EMAIL_VERIFIED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        email: payload.email,
      },
    });
  }

  // Role events
  @OnEvent('role.assigned')
  async handleRoleAssigned(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.ROLE_ASSIGNED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        roleId: payload.roleId,
        roleName: payload.roleName,
        assignedBy: payload.assignedBy?.id,
      },
    });
  }

  @OnEvent('role.removed')
  async handleRoleRemoved(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.ROLE_REMOVED,
      userId: payload.userId,
      organizationId: payload.organizationId,
      timestamp: new Date(),
      metadata: {
        roleId: payload.roleId,
        roleName: payload.roleName,
        removedBy: payload.removedBy?.id,
      },
    });
  }

  // Token events
  @OnEvent('token.refreshed')
  async handleTokenRefreshed(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.TOKEN_REFRESHED,
      userId: payload.userId,
      timestamp: new Date(),
      metadata: {
        tokenFamily: payload.tokenFamily,
      },
    });
  }

  @OnEvent('token.revoked')
  async handleTokenRevoked(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.TOKEN_REVOKED,
      userId: payload.userId,
      timestamp: new Date(),
      metadata: {
        tokenId: payload.tokenId,
        reason: payload.reason,
      },
    });
  }

  @OnEvent('tokens.revoked.all')
  async handleAllTokensRevoked(payload: any) {
    await this.kafkaService.publishAuthEvent({
      eventType: AuthEventType.ALL_TOKENS_REVOKED,
      userId: payload.userId,
      timestamp: new Date(),
      metadata: {
        reason: payload.reason,
      },
    });
  }
}
