import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuditQueryDto, AuditService, AuditSummary } from './audit.service';
import type { AuditLog } from './entities/audit-log.entity';

interface UserContext {
  id: string;
  email: string;
  organizationId: string;
  roles: string[];
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('api/v1/audit')
@UseGuards(KongAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiResponse({ status: 200, description: 'Returns audit logs' })
  async findAll(
    @Query() query: AuditQueryDto,
    @Req() req: Request & { user: UserContext },
  ): Promise<{ data: AuditLog[]; total: number }> {
    // Non-admins can only view their organization's logs
    if (!req.user.roles.includes('admin')) {
      query.organizationId = req.user.organizationId;
    }

    // Validate date range
    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      const end = new Date(query.endDate);
      
      if (start > end) {
        throw new BadRequestException('Start date must be before end date');
      }
      
      // Limit date range to 90 days for performance
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        throw new BadRequestException('Date range cannot exceed 90 days');
      }
    }

    return this.auditService.findAll(query);
  }

  @Get('summary')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get audit log summary for dashboard' })
  @ApiResponse({ status: 200, description: 'Returns audit summary' })
  async getSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('organizationId') organizationId: string,
    @Req() req: Request & { user: UserContext },
  ): Promise<AuditSummary> {
    // Non-admins can only view their organization's summary
    if (!req.user.roles.includes('admin')) {
      if (organizationId && organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Cannot view other organization audit summary');
      }
      organizationId = req.user.organizationId;
    }

    if (!startDate || !endDate) {
      // Default to last 30 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      
      return this.auditService.getSummary(
        organizationId || req.user.organizationId,
        start,
        end,
      );
    }

    return this.auditService.getSummary(
      organizationId || req.user.organizationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('security-events')
  @Roles('admin', 'security_admin')
  @ApiOperation({ summary: 'Get recent security events' })
  @ApiResponse({ status: 200, description: 'Returns security events' })
  async getSecurityEvents(
    @Query('limit') limit: string,
    @Query('organizationId') organizationId: string,
    @Req() req: Request & { user: UserContext },
  ): Promise<AuditLog[]> {
    // Non-admins can only view their organization's events
    if (!req.user.roles.includes('admin')) {
      if (organizationId && organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Cannot view other organization security events');
      }
      organizationId = req.user.organizationId;
    }

    return this.auditService.getSecurityEvents(
      organizationId || req.user.organizationId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('user-activity/:userId')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get user activity timeline' })
  @ApiResponse({ status: 200, description: 'Returns user activity' })
  async getUserActivity(
    @Query('userId') userId: string,
    @Query('days') days: string,
    @Req() req: Request & { user: UserContext },
  ): Promise<AuditLog[]> {
    // Non-admins can only view activity in their organization
    const organizationId = req.user.organizationId;
    
    // If admin, they need to specify organizationId
    if (req.user.roles.includes('admin') && !organizationId) {
      throw new BadRequestException('Organization ID required for admin users');
    }

    return this.auditService.getUserActivity(
      userId,
      organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('suspicious-activity')
  @Roles('admin', 'security_admin')
  @ApiOperation({ summary: 'Detect suspicious activity patterns' })
  @ApiResponse({ status: 200, description: 'Returns suspicious activity alerts' })
  async detectSuspiciousActivity(
    @Query('organizationId') organizationId: string,
    @Req() req: Request & { user: UserContext },
  ): Promise<any[]> {
    // Non-admins can only check their organization
    if (!req.user.roles.includes('admin')) {
      if (organizationId && organizationId !== req.user.organizationId) {
        throw new ForbiddenException('Cannot view other organization activity');
      }
      organizationId = req.user.organizationId;
    }

    return this.auditService.detectSuspiciousActivity(
      organizationId || req.user.organizationId,
    );
  }

  @Get('export')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Export audit logs (CSV format)' })
  @ApiResponse({ status: 200, description: 'Returns CSV data' })
  async exportAuditLogs(
    @Query() query: AuditQueryDto,
    @Req() req: Request & { user: UserContext },
  ): Promise<string> {
    // Non-admins can only export their organization's logs
    if (!req.user.roles.includes('admin')) {
      query.organizationId = req.user.organizationId;
    }

    // Limit export to 10000 records
    query.limit = Math.min(query.limit || 10000, 10000);

    const { data } = await this.auditService.findAll(query);

    // Convert to CSV
    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Resource Type',
      'Resource',
      'Success',
      'Status Code',
      'Duration (ms)',
      'IP Address',
      'Description',
    ];

    const rows = data.map(log => [
      log.createdAt.toISOString(),
      log.userEmail || 'System',
      log.action,
      log.resourceType,
      log.resourceName || log.resourceId || 'N/A',
      log.success ? 'Yes' : 'No',
      log.statusCode || 'N/A',
      log.durationMs || 'N/A',
      log.metadata?.ip || 'N/A',
      log.description || 'N/A',
    ]);

    // Generate CSV
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}

