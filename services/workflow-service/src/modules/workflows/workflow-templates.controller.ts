import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowTemplatesService } from './workflow-templates.service';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';

@ApiTags('workflow-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/workflow-templates')
export class WorkflowTemplatesController {
  constructor(private readonly templatesService: WorkflowTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List workflow templates' })
  @ApiQuery({ name: 'category', type: String, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async findAll(
    @Query('category') category?: string,
    @Query('isActive') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: WorkflowTemplate[]; total: number; page: number; limit: number }> {
    return this.templatesService.findAll({
      category,
      isActive,
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow template by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowTemplate> {
    return this.templatesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workflow template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async create(@Body() createTemplateDto: any): Promise<WorkflowTemplate> {
    return this.templatesService.create(createTemplateDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: any,
  ): Promise<WorkflowTemplate> {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.templatesService.remove(id);
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a workflow template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cloneOptions: { name: string; description?: string },
  ): Promise<WorkflowTemplate> {
    return this.templatesService.clone(id, cloneOptions);
  }

  @Post(':id/create-workflow')
  @ApiOperation({ summary: 'Create a workflow from template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async createWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ): Promise<any> {
    return this.templatesService.createWorkflowFromTemplate(id, createWorkflowDto);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get template usage statistics' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getUsageStats(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.templatesService.getUsageStatistics(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a workflow template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowTemplate> {
    return this.templatesService.activate(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow template' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowTemplate> {
    return this.templatesService.deactivate(id);
  }
}