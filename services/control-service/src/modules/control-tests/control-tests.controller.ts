import {
  Body,
  Controller,
  Get,
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
import { KongUser, Roles } from '../../shared/decorators';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';
import { ControlTestsService } from './control-tests.service';
import type { CreateControlTestDto } from './dto/create-control-test.dto';
import type { UpdateControlTestDto } from './dto/update-control-test.dto';
import type { QueryControlTestsDto } from './dto/query-control-tests.dto';

@ApiTags('control-tests')
@ApiBearerAuth()
@Controller('api/v1/control-tests')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class ControlTestsController {
  constructor(private readonly controlTestsService: ControlTestsService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a new control test' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Control test scheduled successfully',
  })
  async create(@Body() createControlTestDto: CreateControlTestDto) {
    return this.controlTestsService.create(createControlTestDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all control tests for organization' })
  @ApiQuery({ name: 'controlId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'auditId', required: false })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control tests retrieved successfully',
  })
  async findAll(@Query() query: QueryControlTestsDto) {
    const { organizationId, ...filters } = query;
    return this.controlTestsService.findAll(organizationId, filters);
  }

  @Get('metrics/:organizationId')
  @ApiOperation({ summary: 'Get test metrics for organization' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'quarter', 'year'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test metrics retrieved successfully',
  })
  async getMetrics(
    @Param('organizationId') organizationId: string,
    @Query('period') period?: string,
  ) {
    return this.controlTestsService.getTestMetrics(organizationId, period);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get control test by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control test retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Control test not found',
  })
  async findOne(@Param('id') id: string) {
    return this.controlTestsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update control test' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control test updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateControlTestDto: UpdateControlTestDto,
  ) {
    return this.controlTestsService.update(id, updateControlTestDto);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a scheduled control test' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control test execution started',
  })
  async execute(@Param('id') id: string, @Body() body: { testerId: string }) {
    return this.controlTestsService.executeTest(id, body.testerId);
  }

  @Post(':id/results')
  @ApiOperation({ summary: 'Record test results' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test results recorded successfully',
  })
  async recordResults(
    @Param('id') id: string,
    @Body() body: { results: any; testerId: string },
  ) {
    return this.controlTestsService.recordTestResults(id, body.results, body.testerId);
  }

  @Post(':id/findings')
  @ApiOperation({ summary: 'Add finding to control test' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Finding added successfully',
  })
  async addFinding(@Param('id') id: string, @Body() finding: any) {
    return this.controlTestsService.addFinding(id, finding);
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Add evidence to control test' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence added successfully',
  })
  async addEvidence(@Param('id') id: string, @Body() evidence: any) {
    return this.controlTestsService.addEvidence(id, evidence);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review control test' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Control test reviewed successfully',
  })
  async review(
    @Param('id') id: string,
    @Body() body: {
      reviewerId: string;
      reviewNotes: string;
      approved: boolean;
    },
  ) {
    return this.controlTestsService.reviewTest(
      id,
      body.reviewerId,
      body.reviewNotes,
      body.approved,
    );
  }
}