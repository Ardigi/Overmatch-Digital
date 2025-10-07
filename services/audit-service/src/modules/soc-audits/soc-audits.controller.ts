import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
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
import type { CreateSOCAuditDto } from './dto/create-soc-audit.dto';
import type { UpdateSOCAuditDto } from './dto/update-soc-audit.dto';
import { type AuditPhase, AuditStatus, AuditType } from './entities/soc-audit.entity';
import type { SOCAuditsService } from './soc-audits.service';

@ApiTags('soc-audits')
@ApiBearerAuth()
@Controller('soc-audits')
export class SOCAuditsController {
  constructor(private readonly auditsService: SOCAuditsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new SOC audit' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Audit created successfully',
  })
  async create(
    @Body() createAuditDto: CreateSOCAuditDto,
    @Request() req: any,
  ) {
    return this.auditsService.create(createAuditDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all SOC audits' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'status', enum: AuditStatus, required: false })
  @ApiQuery({ name: 'auditType', enum: AuditType, required: false })
  @ApiQuery({ name: 'leadAuditorId', required: false })
  @ApiQuery({ name: 'cpaFirmId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audits retrieved successfully',
  })
  async findAll(@Query() query: any) {
    return this.auditsService.findAll({
      ...query,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get('upcoming/:organizationId')
  @ApiOperation({ summary: 'Get upcoming audits for organization' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upcoming audits retrieved successfully',
  })
  async getUpcoming(
    @Param('organizationId') organizationId: string,
    @Query('days') days?: string,
  ) {
    return this.auditsService.getUpcomingAudits(
      organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('client/:clientId')
  @ApiOperation({ summary: 'Get all audits for a client' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Client audits retrieved successfully',
  })
  async getByClient(@Param('clientId') clientId: string) {
    return this.auditsService.getAuditsByClient(clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Audit not found',
  })
  async findOne(@Param('id') id: string) {
    return this.auditsService.findOne(id);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get audit metrics and analytics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics retrieved successfully',
  })
  async getMetrics(@Param('id') id: string) {
    return this.auditsService.getAuditMetrics(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update audit' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateAuditDto: UpdateSOCAuditDto,
    @Request() req: any,
  ) {
    return this.auditsService.update(id, updateAuditDto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update audit status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status updated successfully',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AuditStatus,
    @Request() req: any,
  ) {
    return this.auditsService.updateStatus(id, status, req.user.id);
  }

  @Patch(':id/phase')
  @ApiOperation({ summary: 'Update audit phase' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phase updated successfully',
  })
  async updatePhase(
    @Param('id') id: string,
    @Body('phase') phase: AuditPhase,
    @Request() req: any,
  ) {
    return this.auditsService.updatePhase(id, phase, req.user.id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive completed audit' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit archived successfully',
  })
  async archive(@Param('id') id: string, @Request() req: any) {
    return this.auditsService.archive(id, req.user.id);
  }
}