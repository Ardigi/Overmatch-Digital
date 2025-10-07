import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard, Roles, RolesGuard } from '../../shared/auth-common';
import { AuditsService } from './audits.service';
import type { CreateAuditTrailDto, QueryAuditTrailDto } from './dto';
import type { AuditResourceType } from './entities/audit-trail.entity';

@Controller('api/v1/audits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post('track')
  @Roles('admin', 'auditor', 'compliance_manager')
  create(@Body() createAuditTrailDto: CreateAuditTrailDto) {
    return this.auditsService.create(createAuditTrailDto);
  }

  @Get()
  @Roles('admin', 'auditor', 'compliance_manager', 'security_analyst')
  findAll(@Query() query: QueryAuditTrailDto) {
    return this.auditsService.findAll(query);
  }

  @Get('export')
  @Roles('admin', 'auditor', 'compliance_manager')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-trail.csv"')
  async export(
    @Query() query: QueryAuditTrailDto,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Response() res: ExpressResponse,
  ) {
    const data = await this.auditsService.export(query, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-trail.json"');
      return res.send(JSON.stringify(data, null, 2));
    }

    return res.send(data);
  }

  @Get('compliance-report')
  @Roles('admin', 'compliance_manager', 'auditor')
  async getComplianceReport(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('complianceFramework') complianceFramework?: string,
  ) {
    return this.auditsService.getComplianceReport(
      organizationId,
      new Date(startDate),
      new Date(endDate),
      complianceFramework,
    );
  }

  @Get('resource/:resourceType/:resourceId')
  @Roles('admin', 'auditor', 'compliance_manager', 'security_analyst')
  findByResource(
    @Param('resourceType') resourceType: AuditResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditsService.findByResource(resourceType, resourceId);
  }

  @Get('user/:userId')
  @Roles('admin', 'auditor', 'compliance_manager', 'security_analyst')
  findByUser(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.auditsService.findByUser(userId, limit ? parseInt(limit) : 50);
  }

  @Get('client/:clientId')
  @Roles('admin', 'auditor', 'compliance_manager', 'account_manager')
  findByClient(@Param('clientId') clientId: string, @Query('limit') limit?: string) {
    return this.auditsService.findByClient(clientId, limit ? parseInt(limit) : 100);
  }

  @Get(':id')
  @Roles('admin', 'auditor', 'compliance_manager', 'security_analyst')
  findOne(@Param('id') id: string) {
    return this.auditsService.findOne(id);
  }
}