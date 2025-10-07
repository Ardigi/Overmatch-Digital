import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { Roles } from './decorators/roles.decorator';
import { LoginRiskLevel } from './entities/login-event.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Security Events')
@Controller('api/v1/auth/security')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SecurityEventsController {
  constructor(
    private readonly anomalyDetectionService: AnomalyDetectionService,
  ) {}

  @Get('login-history')
  @ApiOperation({ summary: 'Get user login history' })
  @ApiResponse({ status: 200, description: 'Login history retrieved successfully' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 30)' })
  async getLoginHistory(
    @Request() req,
    @Query('days') days?: number,
  ) {
    const userId = req.user.sub;
    const history = await this.anomalyDetectionService.getUserLoginHistory(
      userId,
      days || 30,
    );

    return {
      userId,
      period: `${days || 30} days`,
      totalEvents: history.length,
      events: history.map(event => ({
        id: event.id,
        eventType: event.eventType,
        timestamp: event.createdAt,
        ipAddress: event.ipAddress,
        location: event.location ? {
          country: event.location.country,
          city: event.location.city,
        } : null,
        device: event.deviceInfo ? {
          browser: event.deviceInfo.browser,
          os: event.deviceInfo.os,
          type: event.deviceInfo.deviceType,
        } : null,
        riskLevel: event.riskLevel,
        riskScore: event.riskScore,
        anomalies: event.anomalies?.map(a => ({
          type: a.type,
          description: a.description,
          severity: a.severity,
        })),
      })),
    };
  }

  @Get('security-events')
  @ApiOperation({ summary: 'Get security events for user' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: LoginRiskLevel, description: 'Filter by risk level' })
  async getSecurityEvents(
    @Request() req,
    @Query('riskLevel') riskLevel?: LoginRiskLevel,
  ) {
    const userId = req.user.sub;
    const events = await this.anomalyDetectionService.getSecurityEvents(
      userId,
      riskLevel,
    );

    return {
      userId,
      filter: riskLevel || 'all',
      totalEvents: events.length,
      events: events.map(event => ({
        id: event.id,
        eventType: event.eventType,
        timestamp: event.createdAt,
        riskLevel: event.riskLevel,
        riskScore: event.riskScore,
        ipAddress: event.ipAddress,
        location: event.location,
        device: event.deviceInfo,
        anomalies: event.anomalies,
      })),
    };
  }

  @Get('admin/user/:userId/login-history')
  @Roles('admin', 'security_admin')
  @ApiOperation({ summary: 'Get login history for any user (admin only)' })
  @ApiResponse({ status: 200, description: 'Login history retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 30)' })
  async getLoginHistoryForUser(
    @Param('userId') userId: string,
    @Query('days') days?: number,
  ) {
    const history = await this.anomalyDetectionService.getUserLoginHistory(
      userId,
      days || 30,
    );

    return {
      userId,
      period: `${days || 30} days`,
      totalEvents: history.length,
      events: history.map(event => ({
        id: event.id,
        eventType: event.eventType,
        timestamp: event.createdAt,
        ipAddress: event.ipAddress,
        location: event.location,
        device: event.deviceInfo,
        riskLevel: event.riskLevel,
        riskScore: event.riskScore,
        anomalies: event.anomalies,
        sessionId: event.sessionId,
      })),
    };
  }

  @Get('admin/user/:userId/security-events')
  @Roles('admin', 'security_admin')
  @ApiOperation({ summary: 'Get security events for any user (admin only)' })
  @ApiResponse({ status: 200, description: 'Security events retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiQuery({ name: 'riskLevel', required: false, enum: LoginRiskLevel, description: 'Filter by risk level' })
  async getSecurityEventsForUser(
    @Param('userId') userId: string,
    @Query('riskLevel') riskLevel?: LoginRiskLevel,
  ) {
    const events = await this.anomalyDetectionService.getSecurityEvents(
      userId,
      riskLevel,
    );

    const summary = {
      totalEvents: events.length,
      byRiskLevel: {} as Record<LoginRiskLevel, number>,
      byEventType: {} as Record<string, number>,
      topAnomalies: {} as Record<string, number>,
    };

    // Calculate summary statistics
    events.forEach(event => {
      // Count by risk level
      summary.byRiskLevel[event.riskLevel] = (summary.byRiskLevel[event.riskLevel] || 0) + 1;

      // Count by event type
      summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;

      // Count anomalies
      event.anomalies?.forEach(anomaly => {
        summary.topAnomalies[anomaly.type] = (summary.topAnomalies[anomaly.type] || 0) + 1;
      });
    });

    return {
      userId,
      filter: riskLevel || 'all',
      summary,
      events: events.map(event => ({
        id: event.id,
        eventType: event.eventType,
        timestamp: event.createdAt,
        riskLevel: event.riskLevel,
        riskScore: event.riskScore,
        ipAddress: event.ipAddress,
        location: event.location,
        device: event.deviceInfo,
        anomalies: event.anomalies,
        sessionId: event.sessionId,
      })),
    };
  }

  @Get('login-pattern')
  @ApiOperation({ summary: 'Get user login pattern analysis' })
  @ApiResponse({ status: 200, description: 'Login pattern retrieved successfully' })
  async getLoginPattern(@Request() req) {
    const userId = req.user.sub;
    const pattern = await this.anomalyDetectionService.getUserLoginPattern(userId);

    // Calculate most common login times
    const mostCommonHours = Object.entries(pattern.loginTimes.hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    const mostCommonDays = Object.entries(pattern.loginTimes.dayOfWeekCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([day, count]) => ({
        day: parseInt(day),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)],
        count,
      }));

    return {
      userId,
      loginTimes: {
        mostCommonHours,
        mostCommonDays,
        averageHour: Math.round(pattern.loginTimes.averageHour),
        averageDayOfWeek: pattern.loginTimes.averageDayOfWeek,
      },
      locations: pattern.locations.map(loc => ({
        ...loc,
        percentage: Math.round((loc.count / pattern.locations.reduce((sum, l) => sum + l.count, 0)) * 100),
      })),
      devices: pattern.devices.map(dev => ({
        fingerprint: dev.fingerprint,
        count: dev.count,
        lastSeen: dev.lastSeen,
        percentage: Math.round((dev.count / pattern.devices.reduce((sum, d) => sum + d.count, 0)) * 100),
      })),
      security: {
        failureRate: pattern.failureRate,
        averageSessionDuration: Math.round(pattern.averageSessionDuration / 1000 / 60), // Convert to minutes
        totalLocations: pattern.locations.length,
        totalDevices: pattern.devices.length,
      },
    };
  }
}