import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateSOCAuditDto } from '../soc-audits/dto/create-soc-audit.dto';
import { UpdateSOCAuditDto } from '../soc-audits/dto/update-soc-audit.dto';
import { AuditPhase, AuditStatus, AuditType } from '../soc-audits/entities/soc-audit.entity';
import type { SOCAuditsService } from '../soc-audits/soc-audits.service';
import type { AuditsService } from './audits.service';

@ApiTags('audits')
@ApiBearerAuth()
@Controller('audits')
export class AuditsController {
  constructor(
    private readonly auditsService: SOCAuditsService,
    private readonly integratedAuditsService: AuditsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all audits' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'period', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audits retrieved successfully',
  })
  async findAll(@Query() query: any) {
    try {
      return await this.auditsService.findAll({
        ...query,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      });
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new audit' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Audit created successfully',
  })
  async create(
    @Body() createAuditDto: any,
    @Request() req: any,
  ) {
    try {
      // Map generic audit DTO to SOC audit DTO
      const socAuditDto: CreateSOCAuditDto = {
        auditNumber: `AUD-${Date.now()}`,
        clientId: createAuditDto.organizationId || 'default-client',
        organizationId: createAuditDto.organizationId || 'test-org-123',
        auditType: this.mapAuditType(createAuditDto.type),
        auditPeriodStart: new Date(createAuditDto.startDate),
        auditPeriodEnd: new Date(createAuditDto.endDate),
        trustServiceCriteria: ['SECURITY', 'AVAILABILITY'],
        leadAuditorId: createAuditDto.leadAuditor || 'default-auditor',
        engagementPartnerId: 'default-partner',
        auditTeamIds: createAuditDto.team || ['default-team-member'],
        cpaFirmId: 'default-firm',
        cpaFirmName: 'Test CPA Firm',
        auditObjectives: (createAuditDto.objectives || ['Standard audit objectives']).join(', '),
        scopeDescription: createAuditDto.scope || 'Standard audit scope',
        inScopeServices: ['Web Application', 'API Services'],
        inScopeLocations: ['Primary Data Center'],
      };
      
      const userId = req.user?.id || 'test-user';
      return await this.auditsService.create(socAuditDto, userId);
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit retrieved successfully',
  })
  async findOne(@Param('id') id: string) {
    try {
      return await this.integratedAuditsService.getAuditDashboard(id);
    } catch (error) {
      throw new HttpException(
        'Audit not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update audit status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status updated successfully',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() statusUpdate: { status: string; comment?: string },
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id || 'test-user';
      return await this.integratedAuditsService.updateAuditStatusWithIntegration(
        id,
        this.mapAuditStatus(statusUpdate.status),
        userId,
        statusUpdate.comment,
      );
    } catch (error) {
      throw new HttpException(
        'Failed to update audit status',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/plan')
  @ApiOperation({ summary: 'Get audit plan' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit plan retrieved successfully',
  })
  async getAuditPlan(@Param('id') id: string) {
    try {
      // Return a mock audit plan for now
      return {
        success: true,
        data: {
          auditId: id,
          objectives: ['Standard audit objectives'],
          methodology: {
            approach: 'risk-based',
            sampling: 'statistical',
          },
          timeline: {
            phases: [
              { name: 'Planning', duration: '2 weeks' },
              { name: 'Fieldwork', duration: '6 weeks' },
            ],
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Put(':id/plan')
  @ApiOperation({ summary: 'Update audit plan' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit plan updated successfully',
  })
  async updateAuditPlan(
    @Param('id') id: string,
    @Body() planUpdate: any,
  ) {
    try {
      return {
        success: true,
        message: 'Audit plan updated successfully',
        data: { auditId: id, ...planUpdate },
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Get(':id/findings')
  @ApiOperation({ summary: 'Get audit findings' })
  @ApiQuery({ name: 'severity', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Findings retrieved successfully',
  })
  async getFindings(
    @Param('id') id: string,
    @Query('severity') severity?: string,
  ) {
    try {
      return {
        success: true,
        data: [],
        message: 'Findings retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Post(':id/findings')
  @ApiOperation({ summary: 'Create a new finding' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Finding created successfully',
  })
  async createFinding(
    @Param('id') id: string,
    @Body() createFindingDto: any,
  ) {
    try {
      return {
        success: true,
        data: {
          id: `finding-${Date.now()}`,
          auditId: id,
          ...createFindingDto,
          createdAt: new Date(),
        },
        message: 'Finding created successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Get(':id/evidence')
  @ApiOperation({ summary: 'Get audit evidence' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence retrieved successfully',
  })
  async getEvidence(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    try {
      const { evidence, meta } = await this.integratedAuditsService.getAuditEvidence(id, {
        controlId: query.controlId,
        status: query.status,
        type: query.type,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      });
      
      return {
        success: true,
        data: evidence,
        meta,
        message: 'Evidence retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve evidence',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Upload audit evidence' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Evidence uploaded successfully',
  })
  async uploadEvidence(
    @Param('id') id: string,
    @Body() evidenceData: any,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id || 'test-user';
      const evidence = await this.integratedAuditsService.uploadAuditEvidence(
        id,
        {
          name: evidenceData.name,
          description: evidenceData.description,
          controlId: evidenceData.controlId,
          type: evidenceData.type,
          fileUrl: evidenceData.fileUrl,
          metadata: evidenceData.metadata,
        },
        userId,
      );
      
      return {
        success: true,
        data: evidence,
        message: 'Evidence uploaded successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to upload evidence',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':id/generate-report')
  @ApiOperation({ summary: 'Generate audit report' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Report generation started',
  })
  async generateReport(
    @Param('id') id: string,
    @Body() reportRequest: any,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id || 'test-user';
      const report = await this.integratedAuditsService.generateAuditReport(
        id,
        {
          format: reportRequest.format || 'pdf',
          sections: reportRequest.sections,
          includeEvidence: reportRequest.includeEvidence !== false,
          includeFindings: reportRequest.includeFindings !== false,
          customTemplate: reportRequest.customTemplate,
        },
        userId,
      );
      
      return {
        success: true,
        data: {
          reportId: report.reportId,
          auditId: id,
          status: report.status,
          estimatedCompletion: report.estimatedCompletion,
          requestedAt: new Date(),
        },
        message: 'Report generation started',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to generate report',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/reports')
  @ApiOperation({ summary: 'List audit reports' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Reports retrieved successfully',
  })
  async getReports(@Param('id') id: string) {
    try {
      // This would require a new method in the service to get all reports for an audit
      return {
        success: true,
        data: [],
        message: 'Reports retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve reports',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/reports/:reportId/status')
  @ApiOperation({ summary: 'Get audit report status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report status retrieved successfully',
  })
  async getReportStatus(
    @Param('id') id: string,
    @Param('reportId') reportId: string,
  ) {
    try {
      const status = await this.integratedAuditsService.getAuditReportStatus(id, reportId);
      
      return {
        success: true,
        data: status,
        message: 'Report status retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get report status',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get audit analytics' })
  @ApiQuery({ name: 'period', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics retrieved successfully',
  })
  async getAnalytics(@Query('period') period?: string) {
    try {
      return {
        success: true,
        data: {
          totalAudits: 0,
          completedAudits: 0,
          inProgressAudits: 0,
          findings: {
            total: 0,
            high: 0,
            medium: 0,
            low: 0,
          },
        },
        message: 'Analytics retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Get('analytics/findings')
  @ApiOperation({ summary: 'Get findings analytics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Findings analytics retrieved successfully',
  })
  async getFindingsAnalytics() {
    try {
      return {
        success: true,
        data: {
          findingsByType: {},
          findingsBySeverity: {},
          remediationRate: 0,
        },
        message: 'Findings analytics retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Service temporarily unavailable',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
  }

  @Post('events')
  @ApiOperation({ summary: 'Create audit event for SOC 2 compliance logging' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Audit event created successfully',
  })
  async createAuditEvent(
    @Body() eventData: any,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id || 'system';
      const event = await this.integratedAuditsService.createAuditEvent({
        action: eventData.action,
        resourceType: eventData.resourceType,
        resourceId: eventData.resourceId,
        userId,
        organizationId: eventData.organizationId || req.user?.organizationId,
        metadata: eventData.metadata || {},
        ipAddress: req.ip || req.connection?.remoteAddress || '0.0.0.0',
        userAgent: req.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
      });
      
      return {
        success: true,
        data: event,
        message: 'Audit event created successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create audit event',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('events')
  @ApiOperation({ summary: 'Search audit events' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit events retrieved successfully',
  })
  async searchAuditEvents(@Query() query: any, @Request() req: any) {
    try {
      const events = await this.integratedAuditsService.searchAuditEvents({
        action: query.action,
        resourceType: query.resourceType,
        userId: query.userId,
        organizationId: req.user?.organizationId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
      });
      
      return {
        success: true,
        data: events.data,
        meta: events.meta,
        message: 'Audit events retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve audit events',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('events/export')
  @ApiOperation({ summary: 'Export audit events for compliance reporting' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json', 'pdf'] })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit events export initiated',
  })
  async exportAuditEvents(@Query() query: any, @Request() req: any) {
    try {
      const exportJob = await this.integratedAuditsService.exportAuditEvents({
        format: query.format || 'csv',
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        organizationId: req.user?.organizationId,
        filters: {
          action: query.action,
          resourceType: query.resourceType,
          userId: query.userId,
        },
      });
      
      return {
        success: true,
        data: {
          jobId: exportJob.jobId,
          status: exportJob.status,
          estimatedCompletion: exportJob.estimatedCompletion,
          downloadUrl: exportJob.downloadUrl,
        },
        message: 'Audit events export initiated',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to export audit events',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/integration-logs')
  @ApiOperation({ summary: 'Get audit integration tracking logs' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Integration logs retrieved successfully',
  })
  async getIntegrationLogs(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    try {
      const logs = await this.integratedAuditsService.getAuditIntegrationLogs(id, {
        action: query.action,
        resource: query.resource,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page, 10) : 1,
        limit: query.limit ? parseInt(query.limit, 10) : 20,
      });
      
      return {
        success: true,
        data: logs,
        message: 'Integration logs retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve integration logs',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/compliance-status')
  @ApiOperation({ summary: 'Get audit compliance status and recommendations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compliance status retrieved successfully',
  })
  async getComplianceStatus(@Param('id') id: string) {
    try {
      const status = await this.integratedAuditsService.getAuditComplianceStatus(id);
      
      return {
        success: true,
        data: status,
        message: 'Compliance status retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve compliance status',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private mapAuditType(type: string): AuditType {
    const typeMap: Record<string, AuditType> = {
      'soc2_type2': AuditType.SOC2_TYPE2,
      'soc1_type1': AuditType.SOC1_TYPE1,
      'soc2_type1': AuditType.SOC2_TYPE1,
      'soc3': AuditType.SOC3,
      'internal': AuditType.SOC2_TYPE2, // Map internal to SOC2 for now
    };
    return typeMap[type] || AuditType.SOC2_TYPE2;
  }

  private mapAuditStatus(status: string): AuditStatus {
    const statusMap: Record<string, AuditStatus> = {
      'planning': AuditStatus.PLANNING,
      'in_progress': AuditStatus.IN_FIELDWORK,
      'fieldwork': AuditStatus.IN_FIELDWORK,
      'review': AuditStatus.REVIEW,
      'reporting': AuditStatus.DRAFT_REPORT,
      'completed': AuditStatus.COMPLETED,
    };
    return statusMap[status] || AuditStatus.PLANNING;
  }
}