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
import { InstanceStatus, type WorkflowInstance } from './entities/workflow-instance.entity';
import { type WorkflowStepExecution } from './entities/workflow-step-execution.entity';
import { WorkflowInstancesService } from './workflow-instances.service';

@ApiTags('workflow-instances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflow-instances')
export class WorkflowInstancesController {
  constructor(private readonly instancesService: WorkflowInstancesService) {}

  @Get()
  @ApiOperation({ summary: 'List workflow instances' })
  @ApiQuery({ name: 'status', enum: InstanceStatus, required: false })
  @ApiQuery({ name: 'workflowId', type: String, required: false })
  @ApiQuery({ name: 'organizationId', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async findAll(
    @Query('status') status?: InstanceStatus,
    @Query('workflowId') workflowId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: WorkflowInstance[]; total: number; page: number; limit: number }> {
    return this.instancesService.findAll({
      status,
      workflowId,
      organizationId,
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow instance by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowInstance> {
    return this.instancesService.findOne(id);
  }

  @Get(':id/steps')
  @ApiOperation({ summary: 'Get workflow instance step executions' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getStepExecutions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowStepExecution[]> {
    return this.instancesService.getStepExecutions(id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a running workflow instance' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async pause(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowInstance> {
    return this.instancesService.pause(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused workflow instance' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async resume(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowInstance> {
    return this.instancesService.resume(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a workflow instance' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<WorkflowInstance> {
    return this.instancesService.cancel(id, body.reason);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed workflow instance' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id', ParseUUIDPipe) id: string): Promise<WorkflowInstance> {
    return this.instancesService.retry(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get workflow instance execution history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getHistory(@Param('id', ParseUUIDPipe) id: string): Promise<any[]> {
    return this.instancesService.getHistory(id);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get workflow instance context' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getContext(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return this.instancesService.getContext(id);
  }

  @Patch(':id/context')
  @ApiOperation({ summary: 'Update workflow instance context' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateContext(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() context: any,
  ): Promise<WorkflowInstance> {
    return this.instancesService.updateContext(id, context);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow instance' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Instance deleted successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.instancesService.remove(id);
  }
}