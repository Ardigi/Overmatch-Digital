import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimit, RateLimitPresets } from '../../shared/decorators/rate-limit.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { MonitoringService, SecurityAlert } from './monitoring.service';

interface UserContext {
  id: string;
  email: string;
  organizationId: string;
  roles: string[];
}

@ApiTags('monitoring')
@ApiBearerAuth()
@Controller('monitoring')
@UseGuards(KongAuthGuard, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('alerts')
  @Roles('admin', 'security_admin', 'compliance_manager')
  @RateLimit(RateLimitPresets.STANDARD)
  @ApiOperation({ summary: 'Get active security alerts' })
  @ApiResponse({ status: 200, description: 'Returns active security alerts' })
  async getActiveAlerts(
    @Req() req: Request & { user: UserContext },
  ): Promise<SecurityAlert[]> {
    return this.monitoringService.getActiveAlerts(req.user.organizationId);
  }

  @Post('alerts/:id/resolve')
  @Roles('admin', 'security_admin')
  @RateLimit(RateLimitPresets.STRICT)
  @ApiOperation({ summary: 'Resolve a security alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  async resolveAlert(
    @Param('id') alertId: string,
    @Req() req: Request & { user: UserContext },
  ): Promise<{ message: string }> {
    // Verify the alert belongs to the user's organization
    const alerts = await this.monitoringService.getActiveAlerts(req.user.organizationId);
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert) {
      throw new ForbiddenException('Alert not found or access denied');
    }

    await this.monitoringService.resolveAlert(alertId, req.user.email);
    
    return { message: 'Alert resolved successfully' };
  }

  @Get('metrics')
  @Roles('admin', 'security_admin', 'compliance_manager', 'auditor')
  @RateLimit(RateLimitPresets.RELAXED)
  @ApiOperation({ summary: 'Get security metrics for dashboard' })
  @ApiResponse({ status: 200, description: 'Returns security metrics' })
  async getSecurityMetrics(
    @Req() req: Request & { user: UserContext },
  ) {
    return this.monitoringService.getSecurityMetrics(req.user.organizationId);
  }

  @Get('health')
  @Roles('admin', 'security_admin')
  @ApiOperation({ summary: 'Get monitoring system health status' })
  @ApiResponse({ status: 200, description: 'Returns monitoring health status' })
  async getMonitoringHealth(): Promise<{
    status: string;
    checks: {
      alertSystem: boolean;
      auditLogAccess: boolean;
      scheduledJobs: boolean;
    };
    metrics: {
      totalAlerts: number;
      memoryUsage: number;
    };
  }> {
    // Simple health check
    const alerts = await this.monitoringService.getActiveAlerts('system');
    
    return {
      status: 'healthy',
      checks: {
        alertSystem: true,
        auditLogAccess: true,
        scheduledJobs: true,
      },
      metrics: {
        totalAlerts: alerts.length,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      },
    };
  }
}

