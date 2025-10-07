import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ComplianceMappingService } from './compliance-mapping.service';
import {
  BulkMappingDto,
  CreateMappingDto,
  QueryMappingDto,
  UpdateMappingDto,
} from './dto';
import { CreatePolicyControlMappingDto } from './dto/create-policy-control-mapping.dto';

@ApiTags('compliance-mapping')
@Controller('compliance-mapping')
@UseGuards(KongAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComplianceMappingController {
  constructor(private readonly mappingService: ComplianceMappingService) {}

  @Post()
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Create a new framework-to-framework mapping' })
  create(@Body() createMappingDto: CreateMappingDto) {
    return this.mappingService.create(createMappingDto);
  }

  @Post('policy-control')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Create a new policy-to-control mapping' })
  createPolicyControlMapping(@Body() createMappingDto: CreatePolicyControlMappingDto) {
    return this.mappingService.createPolicyControlMapping(createMappingDto);
  }

  @Get()
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get all compliance mappings' })
  findAll(@Query() query: QueryMappingDto) {
    return this.mappingService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get a single compliance mapping' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  findOne(@Param('id') id: string) {
    return this.mappingService.findOne(id);
  }

  @Get('frameworks/:frameworkIds')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Find mappings by framework IDs' })
  @ApiParam({ name: 'frameworkIds', description: 'Comma-separated framework IDs' })
  findByFrameworks(@Param('frameworkIds') frameworkIds: string) {
    const ids = frameworkIds.split(',');
    return this.mappingService.findByFrameworks(ids);
  }

  @Put(':id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Update a compliance mapping' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  update(@Param('id') id: string, @Body() updateMappingDto: UpdateMappingDto) {
    return this.mappingService.update(id, updateMappingDto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a compliance mapping' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  remove(@Param('id') id: string) {
    return this.mappingService.remove(id);
  }

  @Post('bulk')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Create multiple compliance mappings' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          policyId: { type: 'string' },
          controlIds: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' }
        },
        required: ['policyId', 'controlIds']
      }
    }
  })
  bulkCreate(@Body() mappings: CreatePolicyControlMappingDto[]) {
    return this.mappingService.bulkCreate(mappings);
  }

  @Get('statistics')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get compliance mapping statistics' })
  getStatistics(@Query('organizationId') organizationId?: string) {
    return this.mappingService.getMappingStatistics(organizationId);
  }

  @Get('coverage')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get compliance coverage metrics' })
  @ApiQuery({ name: 'frameworkId', required: false })
  getCoverage(@Query('frameworkId') frameworkId?: string) {
    return this.mappingService.getMappingCoverage(frameworkId);
  }

  @Post('validate/:id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Validate mapping consistency' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  validateMapping(@Param('id') id: string) {
    return this.mappingService.validateMapping(id);
  }

  @Get('export')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Export compliance mappings' })
  @ApiQuery({ name: 'format', enum: ['json', 'csv', 'xlsx'], required: false })
  export(@Query('format') format: string = 'json') {
    return this.mappingService.exportMappings(format);
  }

  @Post('import')
  @Roles('admin')
  @ApiOperation({ summary: 'Import compliance mappings' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'string' },
        format: { type: 'string', enum: ['json', 'csv', 'xlsx'] },
      },
    },
  })
  import(@Body() importData: { data: string; format: string }) {
    return this.mappingService.importMappings(importData.data, importData.format);
  }

  @Get('gaps')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Find unmapped controls' })
  @ApiQuery({ name: 'frameworkId', required: false })
  getGaps(@Query('frameworkId') frameworkId?: string) {
    return this.mappingService.getMappingGaps(frameworkId);
  }

  @Get('conflicts')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Find conflicting mappings' })
  getConflicts() {
    return this.mappingService.getMappingConflicts();
  }

  @Post('approve/:id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Approve a compliance mapping' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approvedBy: { type: 'string' },
        comments: { type: 'string' },
      },
    },
  })
  approve(
    @Param('id') id: string,
    @Body() approvalData: { approvedBy: string; comments?: string },
  ) {
    return this.mappingService.approveMappings([id], approvalData);
  }

  @Post('reject/:id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Reject a compliance mapping' })
  @ApiParam({ name: 'id', description: 'Mapping ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rejectedBy: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  reject(
    @Param('id') id: string,
    @Body() rejectionData: { rejectedBy: string; reason: string },
  ) {
    return this.mappingService.rejectMappings([id], rejectionData);
  }

  @Post('policy/:policyId/controls')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Map a policy to multiple controls' })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        controlIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['controlIds'],
    },
  })
  mapPolicyToControls(
    @Param('policyId') policyId: string,
    @Body('controlIds') controlIds: string[],
  ) {
    return this.mappingService.mapPolicyToControls(policyId, controlIds);
  }

  @Delete('policy/:policyId/controls')
  @Roles('admin', 'compliance_manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmap controls from a policy' })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        controlIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['controlIds'],
    },
  })
  unmapPolicyFromControls(
    @Param('policyId') policyId: string,
    @Body('controlIds') controlIds: string[],
  ) {
    return this.mappingService.unmapPolicyFromControls(policyId, controlIds);
  }

  @Get('policy/:policyId')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get mappings for a specific policy' })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  getPolicyMappings(@Param('policyId') policyId: string) {
    return this.mappingService.getPolicyMappings(policyId);
  }

  @Get('control/:controlId')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get mappings for a specific control' })
  @ApiParam({ name: 'controlId', description: 'Control ID' })
  getControlMappings(@Param('controlId') controlId: string) {
    return this.mappingService.getControlMappings(controlId);
  }

  @Get('suggest/:policyId')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Get mapping suggestions for a policy' })
  @ApiParam({ name: 'policyId', description: 'Policy ID' })
  @ApiQuery({ name: 'frameworkId', required: false })
  suggestMappings(
    @Param('policyId') policyId: string,
    @Query('frameworkId') frameworkId?: string,
  ) {
    return this.mappingService.suggestMappings(policyId, frameworkId);
  }

  @Get('coverage/report')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get comprehensive compliance coverage report' })
  @ApiQuery({ name: 'frameworkId', required: false })
  getComplianceCoverage(@Query('frameworkId') frameworkId?: string) {
    return this.mappingService.getComplianceCoverage(frameworkId);
  }

  @Post('matrix')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Generate compliance matrix for multiple frameworks' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        frameworkIds: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['frameworkIds'],
    },
  })
  generateComplianceMatrix(@Body('frameworkIds') frameworkIds: string[]) {
    return this.mappingService.generateComplianceMatrix(frameworkIds);
  }

  @Post('bulk-map')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Bulk map multiple policies to controls' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              policyId: { type: 'string' },
              controlIds: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      required: ['mappings'],
    },
  })
  bulkMapPolicies(
    @Body('mappings') mappings: Array<{ policyId: string; controlIds: string[] }>,
  ) {
    return this.mappingService.bulkMapPolicies(mappings);
  }
}
