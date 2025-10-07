import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Ctx, EventPattern, type KafkaContext, Payload } from '@nestjs/microservices';
import { AuditsService } from '../audits/audits.service';
import { AuditAction, AuditResourceType } from '../audits/entities/audit-trail.entity';
import { ClientsService } from '../clients/clients.service';

// Auth Event Types that Client Service cares about
export enum AuthEventType {
  USER_CREATED = 'auth.user.created',
  USER_UPDATED = 'auth.user.updated',
  USER_DELETED = 'auth.user.deleted',
  USER_SUSPENDED = 'auth.user.suspended',
  USER_ACTIVATED = 'auth.user.activated',
  USER_LOGIN = 'auth.user.login',
  USER_LOGOUT = 'auth.user.logout',
  USER_LOGIN_FAILED = 'auth.user.login_failed',
  USER_LOCKED = 'auth.user.locked',
  ORGANIZATION_CREATED = 'auth.organization.created',
  ORGANIZATION_UPDATED = 'auth.organization.updated',
}

export interface AuthEvent {
  eventType: AuthEventType;
  userId?: string;
  organizationId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private clientsService: ClientsService;

  constructor(
    private readonly auditsService: AuditsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    // Get ClientsService at runtime to avoid circular dependency
    this.clientsService = this.moduleRef.get(ClientsService, { strict: false });
    this.logger.log('Kafka Consumer Service initialized');
  }

  @EventPattern('auth-events')
  async handleAuthEvents(@Payload() event: AuthEvent, @Ctx() context: KafkaContext) {
    try {
      const { offset } = context.getMessage();
      this.logger.log(`Received auth event: ${event.eventType} at offset ${offset}`);

      // Handle different auth event types
      switch (event.eventType) {
        case AuthEventType.USER_CREATED:
          await this.handleUserCreated(event);
          break;
        case AuthEventType.USER_UPDATED:
          await this.handleUserUpdated(event);
          break;
        case AuthEventType.USER_DELETED:
          await this.handleUserDeleted(event);
          break;
        case AuthEventType.USER_LOGIN:
          await this.handleUserLogin(event);
          break;
        case AuthEventType.USER_LOGOUT:
          await this.handleUserLogout(event);
          break;
        case AuthEventType.ORGANIZATION_CREATED:
          await this.handleOrganizationCreated(event);
          break;
        case AuthEventType.ORGANIZATION_UPDATED:
          await this.handleOrganizationUpdated(event);
          break;
        default:
          this.logger.debug(`Unhandled event type: ${event.eventType}`);
      }

      // Always log to audit trail
      await this.createAuditTrail(event);
    } catch (error) {
      this.logger.error(`Error processing auth event: ${error.message}`, error.stack);
      // Don't throw - let Kafka handle retries based on configuration
    }
  }

  private async handleUserCreated(event: AuthEvent) {
    this.logger.log(`Processing user created: ${event.userId}`);
    
    // Check if user is associated with any clients
    if (event.organizationId) {
      try {
        const clients = await this.clientsService.findByOrganizationId(event.organizationId);
        if (clients.length > 0) {
          this.logger.log(`User ${event.userId} is associated with ${clients.length} clients`);
          // You could update client metadata or send notifications here
        }
      } catch (error) {
        this.logger.error(`Error checking client association: ${error.message}`);
      }
    }
  }

  private async handleUserUpdated(event: AuthEvent) {
    this.logger.log(`Processing user updated: ${event.userId}`);
    // Handle user updates that might affect client data
  }

  private async handleUserDeleted(event: AuthEvent) {
    this.logger.log(`Processing user deleted: ${event.userId}`);
    // Handle user deletion - might need to update client contacts
  }

  private async handleUserLogin(event: AuthEvent) {
    this.logger.debug(`User login: ${event.userId}`);
    // Track user activity for compliance
  }

  private async handleUserLogout(event: AuthEvent) {
    this.logger.debug(`User logout: ${event.userId}`);
    // Track user activity for compliance
  }

  private async handleOrganizationCreated(event: AuthEvent) {
    this.logger.log(`Processing organization created: ${event.organizationId}`);
    // Organizations might become clients - prepare data
  }

  private async handleOrganizationUpdated(event: AuthEvent) {
    this.logger.log(`Processing organization updated: ${event.organizationId}`);
    // Update related client data if needed
  }

  private async createAuditTrail(event: AuthEvent) {
    try {
      const auditData = {
        action: this.mapEventToAuditAction(event.eventType),
        resourceType: AuditResourceType.USER,
        resourceId: event.userId || event.organizationId || 'unknown',
        resourceName: event.metadata?.email || event.metadata?.name || 'Unknown',
        userId: event.userId || 'system',
        userName: event.metadata?.email || 'System',
        userEmail: event.metadata?.email || 'system@soc-compliance.com',
        userRole: event.metadata?.role || 'system',
        organizationId: event.organizationId,
        description: `Auth event: ${event.eventType}`,
        metadata: {
          tags: [event.eventType],
          ...(event.metadata?.ipAddress && { ipAddress: event.metadata.ipAddress }),
          ...(event.metadata?.userAgent && { userAgent: event.metadata.userAgent }),
          ...(event.metadata?.sessionId && { sessionId: event.metadata.sessionId }),
        },
        isSystemAction: true,
        timestamp: new Date(event.timestamp),
      };

      await this.auditsService.create(auditData);
    } catch (error) {
      this.logger.error(`Failed to create audit trail: ${error.message}`);
      // Don't throw - audit trail failure shouldn't break event processing
    }
  }

  private mapEventToAuditAction(eventType: AuthEventType): AuditAction {
    const mapping: Record<AuthEventType, AuditAction> = {
      [AuthEventType.USER_CREATED]: AuditAction.CREATE,
      [AuthEventType.USER_UPDATED]: AuditAction.UPDATE,
      [AuthEventType.USER_DELETED]: AuditAction.DELETE,
      [AuthEventType.USER_SUSPENDED]: AuditAction.STATUS_CHANGE,
      [AuthEventType.USER_ACTIVATED]: AuditAction.STATUS_CHANGE,
      [AuthEventType.USER_LOGIN]: AuditAction.LOGIN,
      [AuthEventType.USER_LOGOUT]: AuditAction.LOGOUT,
      [AuthEventType.USER_LOGIN_FAILED]: AuditAction.LOGIN,
      [AuthEventType.USER_LOCKED]: AuditAction.STATUS_CHANGE,
      [AuthEventType.ORGANIZATION_CREATED]: AuditAction.CREATE,
      [AuthEventType.ORGANIZATION_UPDATED]: AuditAction.UPDATE,
    };
    return mapping[eventType] || AuditAction.VIEW; // Default to VIEW instead of 'other'
  }
}