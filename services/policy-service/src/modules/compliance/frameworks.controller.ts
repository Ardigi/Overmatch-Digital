import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { CurrentUser, type CurrentUserData, Roles, RolesGuard } from '@soc-compliance/auth-common';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import type { CreateFrameworkDto, UpdateFrameworkDto } from './dto';
import { FrameworksService } from './frameworks.service';

@ApiTags('frameworks')
@Controller('api/v1/frameworks')
@UseGuards(KongAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Post()
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Create a new compliance framework' })
  @ApiResponse({ status: 201, description: 'Framework created successfully' })
  create(
    @Body() createFrameworkDto: CreateFrameworkDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.frameworksService.create(createFrameworkDto, user);
  }

  @Get()
  @Roles('admin', 'compliance_manager', 'auditor', 'policy_viewer')
  @ApiOperation({ summary: 'Get all compliance frameworks' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query() query: any) {
    return this.frameworksService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'compliance_manager', 'auditor', 'policy_viewer')
  @ApiOperation({ summary: 'Get a specific framework by ID' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  findOne(@Param('id') id: string) {
    return this.frameworksService.findOne(id);
  }

  @Get('identifier/:identifier')
  @Roles('admin', 'compliance_manager', 'auditor', 'policy_viewer')
  @ApiOperation({ summary: 'Get a framework by identifier' })
  @ApiParam({ name: 'identifier', description: 'Framework identifier (e.g., SOC2, ISO27001)' })
  findByIdentifier(@Param('identifier') identifier: string) {
    return this.frameworksService.findByIdentifier(identifier);
  }

  @Get(':id/statistics')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get compliance statistics for a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  getStatistics(@Param('id') id: string) {
    return this.frameworksService.getComplianceStatistics(id);
  }

  @Get(':id/cross-mappings')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get cross-framework mappings' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  getCrossMappings(@Param('id') id: string) {
    return this.frameworksService.findCrossMappings(id);
  }

  @Get(':id/export')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Export framework data' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  export(@Param('id') id: string) {
    return this.frameworksService.exportFramework(id);
  }

  @Patch(':id')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Update a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  update(
    @Param('id') id: string,
    @Body() updateFrameworkDto: UpdateFrameworkDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.frameworksService.update(id, updateFrameworkDto, user);
  }

  @Post('import')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Import a framework' })
  @ApiResponse({ status: 201, description: 'Framework imported successfully' })
  import(@Body() frameworkData: any) {
    return this.frameworksService.importFramework(frameworkData);
  }

  @Get(':id/coverage-report')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get coverage report for a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  getCoverageReport(@Param('id') id: string) {
    return this.frameworksService.getCoverageReport(id);
  }

  @Get(':id/compliance-score')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get compliance score for a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  getComplianceScore(@Param('id') id: string) {
    return this.frameworksService.getComplianceScore(id);
  }

  @Get(':id/validate')
  @Roles('admin', 'compliance_manager')
  @ApiOperation({ summary: 'Validate framework configuration' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  validateFramework(@Param('id') id: string) {
    return this.frameworksService.validateFramework(id);
  }

  @Get(':id/implementation-guide')
  @Roles('admin', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get implementation guide for a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  getImplementationGuide(@Param('id') id: string) {
    return this.frameworksService.getImplementationGuide(id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate a framework' })
  @ApiParam({ name: 'id', description: 'Framework ID' })
  @ApiResponse({ status: 204, description: 'Framework deactivated successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.frameworksService.remove(id, user);
  }
}

