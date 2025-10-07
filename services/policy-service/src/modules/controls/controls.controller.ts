import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { SYSTEM_USER } from '../../shared/types/auth.types';
import { ControlsService } from '../compliance/controls.service';
import {
  CreateControlDto,
  QueryControlDto,
  UpdateControlDto,
} from '../compliance/dto';
import {
  Control,
  ControlFrequency,
  ControlPriority,
  ControlStatus,
  ControlType,
} from '../compliance/entities/control.entity';

@ApiTags('Controls')
@Controller('controls')
@UseGuards(KongAuthGuard)
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new control' })
  @ApiResponse({ status: 201, description: 'Control created successfully', type: Control })
  async create(@Body() createControlDto: CreateControlDto): Promise<Control> {
    return this.controlsService.create(createControlDto, SYSTEM_USER);
  }

  @Get()
  @ApiOperation({ summary: 'Get all controls' })
  @ApiResponse({ status: 200, description: 'Controls retrieved successfully' })
  async findAll(@Query() query: QueryControlDto): Promise<{
    data: Control[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      statistics?: {
        total: number;
        byStatus: Record<string, number>;
        byType: Record<string, number>;
        automationRate: number;
        averageComplianceScore: number;
        testingDue: number;
      };
    };
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    
    const result = await this.controlsService.findAll(query);
    
    const response = {
      data: result.data,
      meta: {
        ...result.meta,
        ...(query.includeStats && {
          statistics: {
            total: result.meta.total,
            byStatus: this.calculateStatusStats(result.data),
            byType: this.calculateTypeStats(result.data),
            automationRate: this.calculateAutomationRate(result.data),
            averageComplianceScore: this.calculateAverageComplianceScore(result.data),
            testingDue: this.calculateTestingDue(result.data),
          },
        }),
      },
    };
    
    return response;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get control by ID' })
  @ApiResponse({ status: 200, description: 'Control retrieved successfully', type: Control })
  async findOne(@Param('id') id: string): Promise<Control> {
    return this.controlsService.findOne(id);
  }

  @Get('by-control-id/:controlId')
  @ApiOperation({ summary: 'Get control by control ID' })
  @ApiResponse({ status: 200, description: 'Control retrieved successfully', type: Control })
  async findByControlId(@Param('controlId') controlId: string): Promise<Control> {
    return this.controlsService.findByControlId(controlId, 'system-org');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update control' })
  @ApiResponse({ status: 200, description: 'Control updated successfully', type: Control })
  async update(
    @Param('id') id: string,
    @Body() updateControlDto: UpdateControlDto
  ): Promise<Control> {
    return this.controlsService.update(id, updateControlDto, SYSTEM_USER);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete control' })
  @ApiResponse({ status: 204, description: 'Control deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.controlsService.remove(id, SYSTEM_USER);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get control statistics' })
  @ApiResponse({ status: 200, description: 'Control statistics retrieved successfully' })
  async getStatistics(@Param('id') id: string): Promise<any> {
    return this.controlsService.getControlStatistics(id);
  }

  @Get(':id/implementation-status')
  @ApiOperation({ summary: 'Get control implementation status' })
  @ApiResponse({ status: 200, description: 'Implementation status retrieved successfully' })
  async getImplementationStatus(@Param('id') id: string): Promise<any> {
    return this.controlsService.getImplementationStatus(id);
  }

  @Get(':id/test-results')
  @ApiOperation({ summary: 'Get control test results' })
  @ApiResponse({ status: 200, description: 'Test results retrieved successfully' })
  async getTestResults(@Param('id') id: string): Promise<any> {
    return this.controlsService.getControlTestResults(id);
  }

  @Post(':id/schedule-test')
  @ApiOperation({ summary: 'Schedule control test' })
  @ApiResponse({ status: 200, description: 'Test scheduled successfully' })
  async scheduleTest(
    @Param('id') id: string,
    @Body() scheduleDto: any
  ): Promise<any> {
    const schedule = {
      id: `schedule-${Date.now()}`,
      controlId: id,
      ...scheduleDto,
      status: 'Scheduled',
      createdAt: new Date(),
    };
    
    await this.controlsService.scheduleTest(id, scheduleDto, SYSTEM_USER);
    
    return schedule;
  }

  @Post(':id/record-test-result')
  @ApiOperation({ summary: 'Record test result' })
  @ApiResponse({ status: 200, description: 'Test result recorded successfully' })
  async recordTestResult(
    @Param('id') id: string,
    @Body() testResultDto: any
  ): Promise<Control> {
    return this.controlsService.recordTestResult(id, testResultDto, SYSTEM_USER);
  }

  @Get(':id/evidence')
  @ApiOperation({ summary: 'Get control evidence' })
  @ApiResponse({ status: 200, description: 'Control evidence retrieved successfully' })
  async getEvidence(@Param('id') id: string): Promise<any> {
    return this.controlsService.getControlEvidence(id);
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Attach evidence to control' })
  @ApiResponse({ status: 200, description: 'Evidence attached successfully' })
  async attachEvidence(
    @Param('id') id: string,
    @Body() evidenceDto: any
  ): Promise<Control> {
    return this.controlsService.attachEvidence(id, evidenceDto);
  }

  @Delete(':id/evidence/:evidenceId')
  @ApiOperation({ summary: 'Remove evidence from control' })
  @ApiResponse({ status: 200, description: 'Evidence removed successfully' })
  async removeEvidence(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string
  ): Promise<Control> {
    return this.controlsService.removeEvidence(id, evidenceId);
  }

  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update controls' })
  @ApiResponse({ status: 200, description: 'Bulk update completed' })
  async bulkUpdate(@Body() bulkDto: any): Promise<any> {
    return this.controlsService.bulkOperation(bulkDto);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export controls' })
  @ApiResponse({ status: 200, description: 'Controls exported successfully' })
  async export(@Query() query: any): Promise<any> {
    return this.controlsService.exportControls(query);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import controls' })
  @ApiResponse({ status: 200, description: 'Controls imported successfully' })
  async import(@Body() importData: any): Promise<any> {
    return this.controlsService.importControls(importData);
  }

  @Get(':id/validate')
  @ApiOperation({ summary: 'Validate control configuration' })
  @ApiResponse({ status: 200, description: 'Control validation completed' })
  async validateControl(@Param('id') id: string): Promise<any> {
    return this.controlsService.validateControl(id);
  }

  @Get(':id/gaps')
  @ApiOperation({ summary: 'Get control gaps analysis' })
  @ApiResponse({ status: 200, description: 'Control gaps analysis completed' })
  async getControlGaps(@Param('id') id: string): Promise<any> {
    return this.controlsService.getControlGaps(id);
  }

  @Get(':id/risk-assessment')
  @ApiOperation({ summary: 'Get control risk assessment' })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  async getRiskAssessment(@Param('id') id: string): Promise<any> {
    return this.controlsService.getControlRiskAssessment(id);
  }

  private calculateStatusStats(controls: Control[]): Record<string, number> {
    const stats: Record<string, number> = {};
    controls.forEach(control => {
      if (control.implementationStatus) {
        const status = control.implementationStatus;
        stats[status] = (stats[status] || 0) + 1;
      }
    });
    return stats;
  }

  private calculateTypeStats(controls: Control[]): Record<string, number> {
    const stats: Record<string, number> = {};
    controls.forEach(control => {
      if (control.type) {
        const type = control.type;
        stats[type] = (stats[type] || 0) + 1;
      }
    });
    return stats;
  }

  private calculateAutomationRate(controls: Control[]): number {
    if (controls.length === 0) return 0;
    const automatedCount = controls.filter(c => c.isAutomated).length;
    return automatedCount / controls.length;
  }

  private calculateAverageComplianceScore(controls: Control[]): number {
    if (controls.length === 0) return 0;
    const totalScore = controls.reduce((sum, c) => sum + (c.implementationScore || 0), 0);
    return totalScore / controls.length / 100; // Convert to 0-1 scale
  }

  private calculateTestingDue(controls: Control[]): number {
    const now = new Date();
    return controls.filter(c => {
      return c.nextAssessmentDate && c.nextAssessmentDate <= now;
    }).length;
  }
}