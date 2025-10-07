import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  PermissionGuard,
  Permissions,
  Public,
  RolesGuard,
} from '../shared-auth';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { RiskAssessmentService } from './risk-assessment.service';

@Controller('api/v1/security')
export class SecurityController {
  constructor(
    private readonly riskAssessmentService: RiskAssessmentService,
    private readonly deviceFingerprintService: DeviceFingerprintService,
  ) {}

  @Public()
  @Post('fingerprint')
  async generateFingerprint(@Body() fingerprintData: any) {
    const fingerprint = this.deviceFingerprintService.generateFingerprint({
      userAgent: fingerprintData.userAgent,
      acceptLanguage: fingerprintData.acceptLanguage,
      acceptEncoding: fingerprintData.acceptEncoding,
      clientData: fingerprintData.clientData,
    });

    return {
      hash: fingerprint.hash,
      trustScore: fingerprint.trustScore,
    };
  }

  @Public()
  @Post('risk-assessment')
  async assessRisk(@Body() context: any, @Request() req) {
    const assessment = await this.riskAssessmentService.assessLoginRisk({
      email: context.email,
      ipAddress: req.ip || req.socket.remoteAddress || context.ipAddress,
      userAgent: req.get('user-agent') || context.userAgent,
      deviceFingerprint: context.deviceFingerprint,
      location: context.location,
      timestamp: new Date(),
    });

    return assessment;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('security:read')
  @Get('suspicious-ips')
  async getSuspiciousIps() {
    // This would retrieve flagged IPs from Redis
    return { message: 'Not implemented yet' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Permissions('security:write')
  @Post('flag-ip')
  @HttpCode(HttpStatus.OK)
  async flagSuspiciousIp(@Body() body: { ipAddress: string; reason: string }) {
    await this.riskAssessmentService.flagSuspiciousIp(body.ipAddress, body.reason);
    return { message: 'IP flagged successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('trust-device')
  @HttpCode(HttpStatus.OK)
  async trustDevice(@Request() req, @Body() body: { deviceFingerprint: string }) {
    await this.riskAssessmentService.recordKnownDevice(req.user.id, body.deviceFingerprint);
    return { message: 'Device trusted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('device-anomalies')
  async checkDeviceAnomalies(@Request() req) {
    const fingerprint = this.deviceFingerprintService.generateFingerprint({
      userAgent: req.get('user-agent'),
      acceptLanguage: req.get('accept-language'),
      acceptEncoding: req.get('accept-encoding'),
    });

    const anomalies = this.deviceFingerprintService.detectAnomalies(fingerprint);

    return {
      fingerprint: fingerprint.hash,
      trustScore: fingerprint.trustScore,
      anomalies,
    };
  }
}