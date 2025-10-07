import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { KongUser, KongUserType, Roles } from '../../shared/decorators';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';
import { ControlsService } from './controls.service';
import type { AssignControlsDto, AssignFrameworkDto } from './dto/assign-controls.dto';
import type { CreateControlDto } from './dto/create-control.dto';
import type { UpdateControlDto } from './dto/update-control.dto';
import { ControlFrequency, ControlCategory, AutomationLevel } from './entities/control.entity';
import { ControlImplementation } from '../implementation/entities/control-implementation.entity';
import type { BulkUpdateImplementationDto, UpdateImplementationDto } from './dto/update-implementation.dto';
import { 
  ControlQueryParams,
  OrganizationControlsQueryParams,
  ControlTestResultData
} from '../../shared/types/control-query.types';
import { ImplementationUpdateData, GapRemediation } from '../../shared/types/implementation-update.types';
import { ControlAutomationDetails, WorkflowApprovalRequest } from '../../shared/types/automation.types';

@ApiTags('controls')
@ApiBearerAuth()
@Controller('controls')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Post()
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Create a new control' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Control created successfully',
  })
  async create(
    @Body() createControlDto: CreateControlDto,
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.create(createControlDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all controls' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'framework', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Controls retrieved successfully',
  })
  async findAll(@Query() query: ControlQueryParams) {
    return this.controlsService.findAll(query);
  }

  @Get('framework/:framework')
  @ApiOperation({ summary: 'Get controls by framework' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Controls retrieved successfully',
  })
  async getByFramework(@Param('framework') framework: string) {
    return this.controlsService.getControlsByFramework(framework);
  }

  @Get('coverage/:organizationId')
  @ApiOperation({ summary: 'Get control coverage for organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coverage metrics retrieved successfully',
  })
  async getCoverage(@Param('organizationId') organizationId: string) {
    return this.controlsService.getControlCoverage(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get control by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Control not found',
  })
  async findOne(@Param('id') id: string) {
    return this.controlsService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get control by code' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control retrieved successfully',
  })
  async findByCode(@Param('code') code: string) {
    return this.controlsService.findByCode(code);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get control metrics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics retrieved successfully',
  })
  async getMetrics(@Param('id') id: string) {
    return this.controlsService.getControlMetrics(id);
  }

  @Put(':id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Update control' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateControlDto: UpdateControlDto,
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.update(id, updateControlDto, user);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Remove control (soft delete)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control removed successfully',
  })
  async remove(@Param('id') id: string, @KongUser() user: KongUserType) {
    return this.controlsService.remove(id, user);
  }

  @Post('bulk-import')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Bulk import controls' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Controls imported successfully',
  })
  async bulkImport(
    @Body() controls: CreateControlDto[],
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.bulkImport(controls, user);
  }

  @Post('assign-to-organization')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Assign controls to an organization' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Controls assigned successfully',
  })
  async assignControlsToOrganization(
    @Body() assignControlsDto: AssignControlsDto,
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.assignControlsToOrganization(
      assignControlsDto.organizationId,
      assignControlsDto.controlIds,
      user.id,
    );
  }

  @Post('assign-framework')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Assign all framework controls to an organization' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Framework controls assigned successfully',
  })
  async assignFrameworkToOrganization(
    @Body() assignFrameworkDto: AssignFrameworkDto,
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.assignFrameworkToOrganization(
      assignFrameworkDto.organizationId,
      assignFrameworkDto.framework,
      user.id,
      {
        skipImplemented: assignFrameworkDto.skipImplemented,
        onlyRequired: assignFrameworkDto.onlyRequired,
      },
    );
  }

  @Get('organization/:organizationId')
  @ApiOperation({ summary: 'Get controls assigned to an organization' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'framework', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Organization controls retrieved successfully',
  })
  async getOrganizationControls(
    @Param('organizationId') organizationId: string,
    @Query() query: OrganizationControlsQueryParams,
  ) {
    return this.controlsService.getOrganizationControls(
      organizationId,
      query,
    );
  }

  @Put('organization/:organizationId/implementation/:controlId')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Update control implementation status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementation updated successfully',
  })
  async updateControlImplementation(
    @Param('organizationId') organizationId: string,
    @Param('controlId') controlId: string,
    @Body() updateImplementationDto: UpdateImplementationDto,
    @KongUser() user: KongUserType,
  ) {
    // Transform DTO to match ControlImplementation entity format
    const updateData: Partial<ControlImplementation> = {
      status: updateImplementationDto.status,
      notes: updateImplementationDto.description,
    };

    // Transform effectiveness object if provided
    if (updateImplementationDto.effectiveness) {
      updateData.effectiveness = {
        score: updateImplementationDto.effectiveness.score,
        lastAssessmentDate: new Date(),
        assessmentMethod: updateImplementationDto.effectiveness.assessmentMethod,
        strengths: updateImplementationDto.effectiveness.strengths,
        weaknesses: updateImplementationDto.effectiveness.weaknesses,
        improvements: updateImplementationDto.effectiveness.improvements,
      };
    }

    // Transform gaps if provided
    if (updateImplementationDto.gaps) {
      updateData.gaps = updateImplementationDto.gaps.map((gap, index) => ({
        id: `GAP-${Date.now()}-${index}`,
        description: gap.description,
        impact: gap.impact.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
        remediationPlan: gap.remediationPlan,
        targetDate: gap.targetDate,
        status: gap.status.toUpperCase() === 'CLOSED' ? 'CLOSED' : gap.status.toUpperCase() as 'OPEN' | 'IN_PROGRESS' | 'CLOSED',
        assignedTo: gap.assignedTo,
      }));
    }

    return this.controlsService.updateControlImplementation(
      organizationId,
      controlId,
      updateData,
      user.id,
    );
  }

  @Put('organization/:organizationId/implementations/bulk')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Bulk update control implementations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementations updated successfully',
  })
  async bulkUpdateImplementations(
    @Param('organizationId') organizationId: string,
    @Body() updates: BulkUpdateImplementationDto[],
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.bulkUpdateImplementations(
      organizationId,
      updates,
      user.id,
    );
  }

  @Get(':controlId/implementation-history/:organizationId')
  @ApiOperation({ summary: 'Get control implementation history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Implementation history retrieved successfully',
  })
  async getControlImplementationHistory(
    @Param('controlId') controlId: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.controlsService.getControlImplementationHistory(
      controlId,
      organizationId,
    );
  }

  @Get('organization/:organizationId/framework/:framework')
  @ApiOperation({ summary: 'Get framework controls with implementation status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Framework controls retrieved successfully',
  })
  async getControlsByOrganizationAndFramework(
    @Param('organizationId') organizationId: string,
    @Param('framework') framework: string,
  ) {
    return this.controlsService.getControlsByOrganizationAndFramework(
      organizationId,
      framework,
    );
  }

  @Post(':id/test-result')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Record control test result' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Test result recorded successfully',
  })
  async recordTestResult(
    @Param('id') id: string,
    @Body() testResult: ControlTestResultData,
    @KongUser() user: KongUserType,
  ) {
    const testResultWithUser: ControlTestResultData & { testedBy: string } = {
      ...testResult,
      testedBy: user.id,
    };
    
    await this.controlsService.updateControlTestResult(id, testResultWithUser);
    return { message: 'Test result recorded successfully' };
  }

  @Get('gaps/:organizationId/:framework')
  @ApiOperation({ summary: 'Get control gaps analysis' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control gaps retrieved successfully',
  })
  async getControlGaps(
    @Param('organizationId') organizationId: string,
    @Param('framework') framework: string,
  ) {
    return this.controlsService.getControlGaps(organizationId, framework);
  }

  @Get(':id/effectiveness')
  @ApiOperation({ summary: 'Check control effectiveness' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control effectiveness retrieved successfully',
  })
  async checkControlEffectiveness(@Param('id') id: string) {
    return this.controlsService.checkControlEffectiveness(id);
  }

  @Put(':id/automation')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Update control automation status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Automation status updated successfully',
  })
  async updateAutomationStatus(
    @Param('id') id: string,
    @Body() automationDetails: ControlAutomationDetails,
    @KongUser() user: KongUserType,
  ) {
    return this.controlsService.updateAutomationStatus(id, automationDetails);
  }

  @Get(':id/relationships')
  @ApiOperation({ summary: 'Get control relationships' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control relationships retrieved successfully',
  })
  async getControlRelationships(@Param('id') id: string) {
    return this.controlsService.getControlRelationships(id);
  }

  @Get('report/:organizationId')
  @ApiOperation({ summary: 'Generate control report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control report generated successfully',
  })
  async generateControlReport(@Param('organizationId') organizationId: string) {
    return this.controlsService.generateControlReport(organizationId);
  }

  @Get(':id/extended')
  @ApiOperation({ summary: 'Get control with external data (evidence, policies, workflows)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control with external data retrieved successfully',
  })
  async getControlWithExternalData(@Param('id') id: string) {
    return this.controlsService.getControlWithExternalData(id);
  }

  @Post(':id/evidence/validate')
  @ApiOperation({ summary: 'Validate evidence for a control' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence validation completed',
  })
  async validateControlEvidence(
    @Param('id') controlId: string,
    @Body() body: { evidenceId: string }
  ) {
    const isValid = await this.controlsService.validateControlEvidence(controlId, body.evidenceId);
    return {
      controlId,
      evidenceId: body.evidenceId,
      isValid,
      validatedAt: new Date(),
    };
  }

  @Post(':id/approval')
  @ApiOperation({ summary: 'Request approval workflow for control implementation' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Approval workflow initiated',
  })
  async requestControlApproval(
    @Param('id') controlId: string,
    @Body() approvalData: WorkflowApprovalRequest
  ) {
    const workflowId = await this.controlsService.requestControlApproval(controlId, approvalData);
    return {
      controlId,
      workflowId,
      status: workflowId ? 'initiated' : 'failed',
      initiatedAt: new Date(),
    };
  }

  @Get(':id/requirements')
  @ApiOperation({ summary: 'Get evidence requirements for a control' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control evidence requirements retrieved successfully',
  })
  async getControlRequirements(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    // Get the control details
    const control = await this.controlsService.findOneExtended(id, organizationId);
    
    if (!control) {
      return {
        success: false,
        error: 'Control not found',
      };
    }

    // Build evidence requirements based on control properties
    const requirements = {
      controlId: id,
      controlCode: control.code,
      controlName: control.name,
      frameworks: control.frameworks,
      evidenceRequirements: {
        mandatory: [
          {
            type: 'policy',
            description: `Policy document covering ${control.name}`,
            frequency: control.frequency || 'annual',
            format: ['PDF', 'DOCX'],
          },
          {
            type: 'procedure',
            description: `Documented procedures for ${control.name}`,
            frequency: 'annual',
            format: ['PDF', 'DOCX'],
          },
        ],
        recommended: [
          {
            type: 'screenshot',
            description: `System configuration screenshots demonstrating ${control.name}`,
            frequency: control.frequency || 'quarterly',
            format: ['PNG', 'JPG'],
          },
          {
            type: 'report',
            description: `Automated compliance reports for ${control.name}`,
            frequency: 'monthly',
            format: ['PDF', 'CSV', 'XLSX'],
          },
        ],
        conditional: control.automationLevel === AutomationLevel.MANUAL ? [
          {
            type: 'manual_review',
            description: 'Manual review documentation',
            frequency: control.frequency || 'quarterly',
            format: ['PDF', 'DOCX'],
            condition: 'Required when control cannot be automated',
          },
        ] : [],
      },
      collectionGuidance: {
        automated: control.automationLevel !== AutomationLevel.MANUAL ? {
          available: true,
          integrations: ['AWS', 'Azure', 'GCP', 'GitHub'],
          frequency: 'continuous',
        } : null,
        manual: {
          instructions: `Collect evidence demonstrating compliance with ${control.name}`,
          reviewProcess: 'Submit for compliance manager review',
        },
      },
      validationRules: {
        expirationPeriod: control.frequency === ControlFrequency.ANNUAL ? 365 : 90,
        requiresApproval: control.category === ControlCategory.ACCESS_CONTROL,
        minimumEvidence: control.category === ControlCategory.ACCESS_CONTROL ? 3 : 1,
      },
    };

    return requirements;
  }
}