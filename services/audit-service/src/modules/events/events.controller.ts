import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServiceAuth } from '@soc-compliance/auth-common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuditTrailService } from '../audit-trail/audit-trail.service';
import type { CreateAuditEntryDto } from '../audit-trail/dto/create-audit-entry.dto';
import type { AuditAction, AuditResource } from '../audit-trail/entities/audit-entry.entity';
import { type LogEventDto, LogEventResponseDto } from './dto/log-event.dto';

/**
 * Events controller for inter-service event logging
 * Provides a simplified interface for services to log audit events
 */
@ApiTags('events')
@Controller('api/v1/events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Post()
  @ServiceAuth() // Accept service-to-service authentication
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log an audit event' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Event logged successfully',
    type: LogEventResponseDto,
  })
  async logEvent(@Body() eventData: LogEventDto): Promise<LogEventResponseDto> {
    try {
      this.logger.debug(`Logging event: ${eventData.action} on ${eventData.resource}`);
      
      // Transform the event data to audit entry format
      const auditEntry: CreateAuditEntryDto = {
        userId: eventData.userId || 'system',
        organizationId: eventData.organizationId,
        userEmail: eventData.details?.userEmail || 'system@local',
        action: eventData.action as AuditAction,
        resource: eventData.resource as AuditResource,
        resourceId: eventData.resourceId || undefined,
        description: eventData.details?.description || `${eventData.action} on ${eventData.resource}`,
        timestamp: new Date(eventData.timestamp || new Date()),
        ipAddress: eventData.ipAddress || '127.0.0.1',
        userAgent: eventData.userAgent || 'internal-service',
        context: {
          service: eventData.source || 'unknown-service',
          ...(eventData.details && { ...eventData.details }),
        },
        metadata: eventData.metadata,
      };

      const result = await this.auditTrailService.createEntry(auditEntry);
      
      this.logger.debug(`Event logged successfully with ID: ${result.id}`);
      
      return {
        success: true,
        data: {
          id: result.id,
          timestamp: result.timestamp,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to log event: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to log audit event');
    }
  }
}