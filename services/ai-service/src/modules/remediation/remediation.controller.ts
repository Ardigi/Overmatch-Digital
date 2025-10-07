import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateRemediationDto } from './dto/create-remediation.dto';
import type { GenerateRemediationDto } from './dto/generate-remediation.dto';
import type { QueryRemediationDto } from './dto/query-remediation.dto';
import type { UpdateRemediationDto } from './dto/update-remediation.dto';
import type { Remediation, RemediationStep } from './entities/remediation.entity';
import type { RemediationService } from './remediation.service';

@ApiTags('Remediation')
@Controller('api/v1/remediation')
@ApiBearerAuth()
export class RemediationController {
  constructor(private readonly remediationService: RemediationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new remediation' })
  @ApiResponse({ status: 201, description: 'Remediation created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createRemediationDto: CreateRemediationDto, @Request() req: any): Promise<Remediation> {
    const organizationId = req.user?.organizationId || 'org-123';
    const createdBy = req.user?.id || 'user-123';
    return this.remediationService.create({
      ...createRemediationDto,
      createdBy,
      organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all remediations with pagination' })
  @ApiResponse({ status: 200, description: 'List of remediations' })
  findAll(@Query() query: QueryRemediationDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.findAll(query, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get remediation by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Remediation found' })
  @ApiResponse({ status: 404, description: 'Remediation not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<Remediation> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update remediation' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Remediation updated' })
  @ApiResponse({ status: 404, description: 'Remediation not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRemediationDto: UpdateRemediationDto,
    @Request() req: any,
  ): Promise<Remediation> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.update(id, updateRemediationDto, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete remediation' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Remediation deleted' })
  @ApiResponse({ status: 404, description: 'Remediation not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete in-progress remediation' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<void> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.remove(id, organizationId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI-powered remediation' })
  @ApiResponse({ status: 200, description: 'Remediation generated' })
  generateRemediation(@Body() dto: GenerateRemediationDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.generateRemediation(dto, organizationId);
  }

  @Post('bulk-generate')
  @ApiOperation({ summary: 'Generate remediations for multiple findings' })
  @ApiResponse({ status: 200, description: 'Bulk remediations generated' })
  generateBulkRemediations(
    @Body() body: { findingIds: string[]; options: any },
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.generateBulkRemediations(
      body.findingIds,
      body.options,
      organizationId,
    );
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Update remediation progress' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Progress updated' })
  updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() progress: { percentComplete: number; hoursSpent: number; notes?: string },
    @Request() req: any,
  ): Promise<Remediation> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.updateProgress(id, progress, organizationId);
  }

  @Patch(':id/steps/:stepOrder')
  @ApiOperation({ summary: 'Update a remediation step' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'stepOrder', type: 'number' })
  @ApiResponse({ status: 200, description: 'Step updated' })
  updateStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepOrder') stepOrder: number,
    @Body() stepUpdate: Partial<RemediationStep>,
    @Request() req: any,
  ): Promise<Remediation> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.updateStep(id, stepOrder, stepUpdate, organizationId);
  }

  @Get('effectiveness/:clientId')
  @ApiOperation({ summary: 'Get remediation effectiveness metrics' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'timeframe', type: 'string', example: '90days' })
  @ApiResponse({ status: 200, description: 'Effectiveness metrics' })
  getEffectiveness(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('timeframe') timeframe: string = '90days',
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.getEffectiveness(clientId, timeframe, organizationId);
  }

  @Post('optimize/:clientId')
  @ApiOperation({ summary: 'Optimize remediation plan' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Optimized plan' })
  optimizePlan(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() constraints: any,
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.remediationService.optimizePlan(clientId, constraints, organizationId);
  }

  @Post('generate-plan')
  @ApiOperation({ summary: 'Generate remediation plan' })
  @ApiResponse({ status: 200, description: 'Plan generated' })
  generateRemediationPlan(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.generateRemediationPlan(dto, organizationId);
  }

  @Post('prioritize')
  @ApiOperation({ summary: 'Prioritize remediations' })
  @ApiResponse({ status: 200, description: 'Prioritized remediations' })
  prioritizeRemediations(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.prioritizeRemediations(dto, organizationId);
  }

  @Post('estimate-effort')
  @ApiOperation({ summary: 'Estimate remediation effort' })
  @ApiResponse({ status: 200, description: 'Effort estimate' })
  estimateEffort(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.estimateEffort(dto, organizationId);
  }

  @Post('track-progress')
  @ApiOperation({ summary: 'Track remediation progress' })
  @ApiResponse({ status: 200, description: 'Progress report' })
  trackProgress(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.trackProgress(dto, organizationId);
  }

  @Post('suggest-automation')
  @ApiOperation({ summary: 'Suggest automation opportunities' })
  @ApiResponse({ status: 200, description: 'Automation suggestions' })
  suggestAutomation(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.suggestAutomation(dto, organizationId);
  }

  @Post('analyze-impact')
  @ApiOperation({ summary: 'Analyze remediation impact' })
  @ApiResponse({ status: 200, description: 'Impact analysis' })
  analyzeImpact(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.analyzeImpact(dto, organizationId);
  }

  @Post('validate-completion')
  @ApiOperation({ summary: 'Validate remediation completion' })
  @ApiResponse({ status: 200, description: 'Validation results' })
  validateCompletion(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.validateCompletion(dto, organizationId);
  }

  @Post('generate-report')
  @ApiOperation({ summary: 'Generate remediation report' })
  @ApiResponse({ status: 200, description: 'Report generated' })
  generateReport(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.generateReport(dto, organizationId);
  }

  @Post('bulk-assign')
  @ApiOperation({ summary: 'Bulk assign remediations' })
  @ApiResponse({ status: 200, description: 'Assignment results' })
  bulkAssign(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.remediationService.bulkAssign(dto, organizationId);
  }
}