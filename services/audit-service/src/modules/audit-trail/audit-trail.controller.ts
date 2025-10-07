import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuditCreate,
  AuditRead,
  SkipAudit,
} from '../../shared/decorators/audit.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuditLoggingInterceptor } from '../../shared/interceptors/audit-logging.interceptor';
import type { AuditTrailService } from './audit-trail.service';
import { AuditReportDto } from './dto/audit-report.dto';
import type { CreateAuditEntryDto } from './dto/create-audit-entry.dto';
import type { SearchAuditEntriesDto } from './dto/search-audit-entries.dto';
import { AuditEntry, AuditResource } from './entities/audit-entry.entity';
import { AuditSession } from './entities/audit-session.entity';

@ApiTags('audit-trail')
@Controller('api/v1/audit-trail')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLoggingInterceptor)
@ApiBearerAuth()
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Post('entries')
  @Roles('admin', 'system')
  @AuditCreate(AuditResource.SYSTEM, 'Create audit entry manually')
  @ApiOperation({ summary: 'Create audit entry manually' })
  @ApiResponse({ status: 201, type: AuditEntry })
  async createEntry(
    @Body() createDto: CreateAuditEntryDto,
  ): Promise<AuditEntry> {
    return this.auditTrailService.createEntry(createDto);
  }

  @Get('entries')
  @Roles('admin', 'auditor', 'compliance_manager')
  @AuditRead(AuditResource.SYSTEM, 'Search audit entries')
  @ApiOperation({ summary: 'Search audit entries' })
  @ApiResponse({ status: 200, type: [AuditEntry] })
  async searchEntries(
    @Query() searchDto: SearchAuditEntriesDto,
  ): Promise<{
    data: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.auditTrailService.findEntries(searchDto);
  }

  @Get('entries/:id')
  @Roles('admin', 'auditor', 'compliance_manager')
  @AuditRead(AuditResource.SYSTEM, 'Get audit entry details')
  @ApiOperation({ summary: 'Get audit entry by ID' })
  @ApiResponse({ status: 200, type: AuditEntry })
  async getEntry(@Param('id') id: string): Promise<AuditEntry> {
    return this.auditTrailService.findEntryById(id);
  }

  @Get('entries/:id/verify')
  @Roles('admin', 'auditor')
  @SkipAudit()
  @ApiOperation({ summary: 'Verify audit entry checksum' })
  @ApiResponse({ status: 200, type: Boolean })
  async verifyChecksum(@Param('id') id: string): Promise<{ valid: boolean }> {
    const valid = await this.auditTrailService.verifyChecksum(id);
    return { valid };
  }

  @Put('entries/:id/review')
  @Roles('admin', 'auditor', 'compliance_manager')
  @AuditCreate(AuditResource.SYSTEM, 'Review audit entry')
  @ApiOperation({ summary: 'Review audit entry' })
  @ApiResponse({ status: 200, type: AuditEntry })
  async reviewEntry(
    @Param('id') id: string,
    @Body() reviewData: { notes?: string },
    @Request() req: any,
  ): Promise<AuditEntry> {
    return this.auditTrailService.reviewEntry(
      id,
      req.user.id,
      reviewData.notes,
    );
  }

  @Get('sessions/current')
  @Roles('admin', 'user')
  @SkipAudit()
  @ApiOperation({ summary: 'Get current session' })
  @ApiResponse({ status: 200, type: AuditSession })
  async getCurrentSession(@Request() req: any): Promise<AuditSession | null> {
    const sessionToken = req.headers['x-session-id'];
    if (!sessionToken) return null;
    
    return this.auditTrailService.findSessionByToken(sessionToken);
  }

  @Post('sessions/:token/terminate')
  @Roles('admin', 'security')
  @AuditCreate(AuditResource.SYSTEM, 'Terminate session')
  @ApiOperation({ summary: 'Terminate session' })
  @ApiResponse({ status: 200, type: AuditSession })
  async terminateSession(
    @Param('token') token: string,
    @Body() data: { reason?: string },
  ): Promise<AuditSession> {
    return this.auditTrailService.terminateSession(token, data.reason);
  }

  @Get('integrity-check')
  @Roles('admin', 'auditor')
  @AuditRead(AuditResource.SYSTEM, 'Perform integrity check')
  @ApiOperation({ summary: 'Check for tampered entries' })
  @ApiResponse({ status: 200 })
  async checkIntegrity(
    @Query('organizationId') organizationId: string,
  ): Promise<{
    tamperedEntries: AuditEntry[];
    totalChecked: number;
  }> {
    return this.auditTrailService.detectTampering(organizationId);
  }

  @Get('reports/audit')
  @Roles('admin', 'auditor', 'compliance_manager')
  @AuditRead(AuditResource.SYSTEM, 'Generate audit report')
  @ApiOperation({ summary: 'Generate audit report' })
  @ApiResponse({ status: 200, type: AuditReportDto })
  async generateReport(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<AuditReportDto> {
    return this.auditTrailService.generateAuditReport(
      organizationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('my-activity')
  @Roles('admin', 'user')
  @SkipAudit()
  @ApiOperation({ summary: 'Get my audit activity' })
  @ApiResponse({ status: 200, type: [AuditEntry] })
  async getMyActivity(
    @Request() req: any,
    @Query() searchDto: SearchAuditEntriesDto,
  ): Promise<{
    data: AuditEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.auditTrailService.findEntries({
      ...searchDto,
      userId: req.user.id,
    });
  }
}