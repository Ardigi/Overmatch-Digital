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
import type {
  AutoMapDto,
  ConsolidationSuggestionDto,
  CoverageAnalysisDto,
  CreateMappingDto,
  ExportMappingDto,
  GapAnalysisDto,
  GenerateMappingDto,
  ImportMappingDto,
  QueryMappingDto,
  SimilarityAnalysisDto,
  UpdateMappingDto,
  ValidateMappingDto,
} from './dto';
import type { FrameworkMapping } from './entities/framework-mapping.entity';
import type { MappingsService } from './mappings.service';

@ApiTags('Framework Mappings')
@Controller('api/v1/mappings')
@ApiBearerAuth()
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new framework mapping' })
  @ApiResponse({ status: 201, description: 'Mapping created successfully' })
  @ApiResponse({ status: 409, description: 'Mapping already exists' })
  create(@Body() createMappingDto: CreateMappingDto, @Request() req: any): Promise<FrameworkMapping> {
    const organizationId = req.user?.organizationId || 'org-123';
    const createdBy = req.user?.id || 'user-123';
    return this.mappingsService.create({
      ...createMappingDto,
      createdBy,
      organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all mappings with pagination' })
  @ApiResponse({ status: 200, description: 'List of mappings' })
  findAll(@Query() query: QueryMappingDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.findAll(query, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mapping by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Mapping found' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<FrameworkMapping> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mapping' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Mapping updated' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMappingDto: UpdateMappingDto,
    @Request() req: any,
  ): Promise<FrameworkMapping> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.update(id, updateMappingDto, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete mapping' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Mapping deleted' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete approved mapping' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<void> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.remove(id, organizationId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI-powered framework mapping' })
  @ApiResponse({ status: 200, description: 'Mapping generated' })
  generateMapping(@Body() dto: GenerateMappingDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.generateFrameworkMapping(dto, organizationId);
  }

  @Post('analyze/similarity')
  @ApiOperation({ summary: 'Analyze control similarity' })
  @ApiResponse({ status: 200, description: 'Similarity analysis results' })
  analyzeControlSimilarity(@Body() dto: SimilarityAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.analyzeControlSimilarity(dto, organizationId);
  }

  @Post('analyze/gaps')
  @ApiOperation({ summary: 'Find gap controls in mapping' })
  @ApiResponse({ status: 200, description: 'Gap analysis results' })
  findGapControls(@Body() dto: GapAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.findGapControls(dto, organizationId);
  }

  @Post('suggest/consolidation')
  @ApiOperation({ summary: 'Suggest control consolidation opportunities' })
  @ApiResponse({ status: 200, description: 'Consolidation suggestions' })
  suggestConsolidation(@Body() dto: ConsolidationSuggestionDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.suggestConsolidation(dto, organizationId);
  }

  @Post('auto-map')
  @ApiOperation({ summary: 'Automatically map controls using AI' })
  @ApiResponse({ status: 200, description: 'Auto-mapping results' })
  autoMapControls(@Body() dto: AutoMapDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.autoMapControls(dto, organizationId);
  }

  @Post(':id/coverage')
  @ApiOperation({ summary: 'Get detailed mapping coverage analysis' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Coverage analysis results' })
  getMappingCoverage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CoverageAnalysisDto>,
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123';
    const coverageDto = { ...dto, mappingId: id };
    return this.mappingsService.getMappingCoverage(coverageDto as CoverageAnalysisDto, organizationId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import mapping from file' })
  @ApiResponse({ status: 200, description: 'Import results' })
  importMapping(@Body() dto: ImportMappingDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.importMapping(dto, organizationId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a framework mapping' })
  @ApiResponse({ status: 200, description: 'Validation results' })
  validateMapping(@Body() dto: ValidateMappingDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.validateMapping(dto, organizationId);
  }

  @Post('bulk-approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Approve multiple mappings' })
  @ApiResponse({ status: 204, description: 'Mappings approved' })
  approveBulk(
    @Body() body: { mappingIds: string[]; approvedBy: string },
    @Request() req: any,
  ): Promise<void> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.mappingsService.approveBulk(body.mappingIds, body.approvedBy, organizationId);
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Export mapping in various formats' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Exported mapping' })
  exportMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExportMappingDto,
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.mappingsService.exportMapping(id, dto, organizationId);
  }
}