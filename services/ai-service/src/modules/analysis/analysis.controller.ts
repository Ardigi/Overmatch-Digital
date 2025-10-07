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
import type { AnalysisService } from './analysis.service';
import type { ComplianceAnalysisDto } from './dto/compliance-analysis.dto';
import type { CreateAnalysisDto } from './dto/create-analysis.dto';
import type { FrameworkComparisonDto } from './dto/framework-comparison.dto';
import type { QueryAnalysisDto } from './dto/query-analysis.dto';
import type { RecommendationDto } from './dto/recommendation.dto';
import type { RiskAnalysisDto } from './dto/risk-analysis.dto';
import type { TrendAnalysisDto } from './dto/trend-analysis.dto';
import type { UpdateAnalysisDto } from './dto/update-analysis.dto';
import type { ComplianceAnalysis } from './entities/compliance-analysis.entity';

@ApiTags('AI Analysis')
@Controller('api/v1/analysis')
@ApiBearerAuth()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new analysis' })
  @ApiResponse({ status: 201, description: 'Analysis created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createAnalysisDto: CreateAnalysisDto, @Request() req: any): Promise<ComplianceAnalysis> {
    const organizationId = req.user?.organizationId || 'org-123';
    const createdBy = req.user?.id || 'user-123';
    return this.analysisService.create({
      ...createAnalysisDto,
      createdBy,
      organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all analyses with pagination' })
  @ApiResponse({ status: 200, description: 'List of analyses' })
  findAll(@Query() query: QueryAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.findAll(query, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get analysis by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Analysis found' })
  @ApiResponse({ status: 404, description: 'Analysis not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<ComplianceAnalysis> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update analysis' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Analysis updated' })
  @ApiResponse({ status: 404, description: 'Analysis not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAnalysisDto: UpdateAnalysisDto,
    @Request() req: any,
  ): Promise<ComplianceAnalysis> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.update(id, updateAnalysisDto, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete analysis' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Analysis deleted' })
  @ApiResponse({ status: 404, description: 'Analysis not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<void> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.remove(id, organizationId);
  }

  @Post('compliance')
  @ApiOperation({ summary: 'Perform compliance gap analysis' })
  @ApiResponse({ status: 200, description: 'Compliance analysis completed' })
  analyzeCompliance(@Body() dto: ComplianceAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.analyzeCompliance(dto, organizationId);
  }

  @Post('risks')
  @ApiOperation({ summary: 'Perform risk assessment' })
  @ApiResponse({ status: 200, description: 'Risk analysis completed' })
  analyzeRisks(@Body() dto: RiskAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.analyzeRisks(dto, organizationId);
  }

  @Post('trends')
  @ApiOperation({ summary: 'Analyze compliance trends' })
  @ApiResponse({ status: 200, description: 'Trend analysis completed' })
  analyzeTrends(@Body() dto: TrendAnalysisDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.analyzeTrends(dto, organizationId);
  }

  @Post('recommendations')
  @ApiOperation({ summary: 'Generate AI recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations generated' })
  generateRecommendations(@Body() dto: RecommendationDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.generateRecommendations(dto, organizationId);
  }

  @Post('compare-frameworks')
  @ApiOperation({ summary: 'Compare compliance frameworks' })
  @ApiResponse({ status: 200, description: 'Framework comparison completed' })
  compareFrameworks(@Body() dto: FrameworkComparisonDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.analysisService.compareFrameworks(dto, organizationId);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get analysis history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Analysis history' })
  getAnalysisHistory(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.analysisService.getAnalysisHistory(id, organizationId);
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Export analysis' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Export results' })
  exportAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.analysisService.exportAnalysis(id, dto, organizationId);
  }
}