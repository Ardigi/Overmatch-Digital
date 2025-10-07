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
import type { CreatePredictionDto } from './dto/create-prediction.dto';
import type { GeneratePredictionDto } from './dto/generate-prediction.dto';
import type { QueryPredictionDto } from './dto/query-prediction.dto';
import type { UpdatePredictionDto } from './dto/update-prediction.dto';
import type { Prediction } from './entities/prediction.entity';
import type { PredictionsService } from './predictions.service';

@ApiTags('Predictions')
@Controller('predictions')
@ApiBearerAuth()
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new prediction' })
  @ApiResponse({ status: 201, description: 'Prediction created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createPredictionDto: CreatePredictionDto, @Request() req: any): Promise<Prediction> {
    const organizationId = req.user?.organizationId || 'org-123';
    const createdBy = req.user?.id || 'user-123';
    return this.predictionsService.create({
      ...createPredictionDto,
      createdBy,
      organizationId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all predictions with pagination' })
  @ApiResponse({ status: 200, description: 'List of predictions' })
  findAll(@Query() query: QueryPredictionDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.findAll(query, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get prediction by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Prediction found' })
  @ApiResponse({ status: 404, description: 'Prediction not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<Prediction> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update prediction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Prediction updated' })
  @ApiResponse({ status: 404, description: 'Prediction not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePredictionDto: UpdatePredictionDto,
    @Request() req: any,
  ): Promise<Prediction> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.update(id, updatePredictionDto, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete prediction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Prediction deleted' })
  @ApiResponse({ status: 404, description: 'Prediction not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any): Promise<void> {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.remove(id, organizationId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI prediction' })
  @ApiResponse({ status: 200, description: 'Prediction generated' })
  generatePrediction(@Body() dto: GeneratePredictionDto, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.generatePrediction(dto, organizationId);
  }

  @Get('compliance-score/:clientId')
  @ApiOperation({ summary: 'Predict compliance score' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'timeframe', type: 'string', example: '90days' })
  @ApiResponse({ status: 200, description: 'Compliance score prediction' })
  predictComplianceScore(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('timeframe') timeframe: string = '90days',
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.predictComplianceScore(clientId, timeframe, organizationId);
  }

  @Post('audit-readiness/:clientId')
  @ApiOperation({ summary: 'Predict audit readiness' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Audit readiness prediction' })
  predictAuditReadiness(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() body: { auditDate: Date },
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.predictAuditReadiness(clientId, body.auditDate, organizationId);
  }

  @Post('scenarios/:clientId')
  @ApiOperation({ summary: 'Compare prediction scenarios' })
  @ApiParam({ name: 'clientId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Scenario comparison results' })
  compareScenarios(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() body: { scenarios: any[] },
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.compareScenarios(clientId, body.scenarios, organizationId);
  }

  @Get(':id/accuracy')
  @ApiOperation({ summary: 'Get prediction accuracy' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Prediction accuracy metrics' })
  getAccuracy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.getAccuracy(id, organizationId);
  }

  @Get('performance/:type')
  @ApiOperation({ summary: 'Get model performance metrics' })
  @ApiParam({ name: 'type', type: 'string', description: 'Prediction type' })
  @ApiResponse({ status: 200, description: 'Model performance metrics' })
  getModelPerformance(@Param('type') type: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123'; // Mock for tests
    return this.predictionsService.getModelPerformance(type, organizationId);
  }

  @Post('compliance')
  @ApiOperation({ summary: 'Predict compliance score' })
  @ApiResponse({ status: 200, description: 'Compliance prediction generated' })
  predictCompliance(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.predictCompliance(dto, organizationId);
  }

  @Post('risks')
  @ApiOperation({ summary: 'Predict risk events' })
  @ApiResponse({ status: 200, description: 'Risk predictions generated' })
  predictRisks(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.predictRisks(dto, organizationId);
  }

  @Post('control-effectiveness')
  @ApiOperation({ summary: 'Predict control effectiveness' })
  @ApiResponse({ status: 200, description: 'Control effectiveness predictions' })
  predictControlEffectiveness(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.predictControlEffectiveness(dto, organizationId);
  }

  @Post('resource-needs')
  @ApiOperation({ summary: 'Predict resource requirements' })
  @ApiResponse({ status: 200, description: 'Resource predictions generated' })
  predictResourceNeeds(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.predictResourceNeeds(dto, organizationId);
  }

  @Post('audit-outcomes')
  @ApiOperation({ summary: 'Predict audit outcomes' })
  @ApiResponse({ status: 200, description: 'Audit outcome predictions' })
  predictAuditOutcomes(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.predictAuditOutcomes(dto, organizationId);
  }

  @Post('evaluate-accuracy')
  @ApiOperation({ summary: 'Evaluate prediction accuracy' })
  @ApiResponse({ status: 200, description: 'Accuracy evaluation results' })
  evaluatePredictionAccuracy(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.evaluatePredictionAccuracy(dto, organizationId);
  }

  @Post('backtest')
  @ApiOperation({ summary: 'Backtest predictions' })
  @ApiResponse({ status: 200, description: 'Backtest results' })
  backtestPredictions(@Body() dto: any, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.backtestPredictions(dto, organizationId);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get prediction history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Prediction history' })
  getPredictionHistory(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.getPredictionHistory(id, organizationId);
  }

  @Post(':id/export')
  @ApiOperation({ summary: 'Export predictions' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Export results' })
  exportPredictions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    const organizationId = req.user?.organizationId || 'org-123';
    return this.predictionsService.exportPredictions(id, dto, organizationId);
  }
}