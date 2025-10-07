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
  Req,
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
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateEntityMappingsDto } from './dto/entity-mappings.dto';
import type { RetrySyncDto } from './dto/retry-sync.dto';
import type { StartSyncDto } from './dto/start-sync.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';
import type { SyncJob } from './entities/sync-job.entity';
import type { SyncSchedule } from './entities/sync-schedule.entity';
import type { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/:integrationId/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new sync job' })
  @ApiParam({ name: 'integrationId', type: 'string', format: 'uuid' })
  async startSync(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body() dto: StartSyncDto,
    @Req() req: any,
  ): Promise<SyncJob> {
    return this.syncService.startSync(
      integrationId,
      req.user.organizationId,
      dto,
    );
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List sync jobs' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getSyncJobs(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.syncService.getSyncJobs(
      integrationId,
      req.user.organizationId,
      { status, page, limit },
    );
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get sync job details' })
  async getSyncJob(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: any,
  ): Promise<SyncJob> {
    return this.syncService.getSyncJob(jobId, req.user.organizationId);
  }

  @Get('jobs/:jobId/progress')
  @ApiOperation({ summary: 'Get real-time sync progress' })
  async getSyncProgress(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: any,
  ): Promise<any> {
    return this.syncService.getSyncProgress(
      integrationId,
      jobId,
      req.user.organizationId,
    );
  }

  @Post('jobs/:jobId/cancel')
  @ApiOperation({ summary: 'Cancel a running sync job' })
  async cancelSync(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Req() req: any,
  ): Promise<SyncJob> {
    return this.syncService.cancelSync(jobId, req.user.organizationId);
  }

  @Post('jobs/:jobId/retry')
  @ApiOperation({ summary: 'Retry a failed sync job' })
  async retrySync(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: RetrySyncDto,
    @Req() req: any,
  ): Promise<SyncJob> {
    return this.syncService.retrySync(jobId, req.user.organizationId, dto);
  }

  // Schedule Management
  @Get('schedules')
  @ApiOperation({ summary: 'List sync schedules' })
  async getSchedules(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Req() req: any,
  ): Promise<SyncSchedule[]> {
    return this.syncService.getSchedules(integrationId, req.user.organizationId);
  }

  @Post('schedules')
  @ApiOperation({ summary: 'Create a sync schedule' })
  async createSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body() dto: CreateScheduleDto,
    @Req() req: any,
  ): Promise<SyncSchedule> {
    return this.syncService.createSchedule(
      integrationId,
      req.user.organizationId,
      dto,
    );
  }

  @Get('schedules/:scheduleId')
  @ApiOperation({ summary: 'Get schedule details' })
  async getSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Req() req: any,
  ): Promise<SyncSchedule> {
    return this.syncService.getSchedule(
      integrationId,
      scheduleId,
      req.user.organizationId,
    );
  }

  @Put('schedules/:scheduleId')
  @ApiOperation({ summary: 'Update a sync schedule' })
  async updateSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: any,
  ): Promise<SyncSchedule> {
    return this.syncService.updateSchedule(
      integrationId,
      scheduleId,
      req.user.organizationId,
      dto,
    );
  }

  @Delete('schedules/:scheduleId')
  @ApiOperation({ summary: 'Delete a sync schedule' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Req() req: any,
  ): Promise<void> {
    await this.syncService.deleteSchedule(
      integrationId,
      scheduleId,
      req.user.organizationId,
    );
  }

  @Post('schedules/:scheduleId/enable')
  @ApiOperation({ summary: 'Enable a sync schedule' })
  async enableSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Req() req: any,
  ): Promise<SyncSchedule> {
    return this.syncService.enableSchedule(
      integrationId,
      scheduleId,
      req.user.organizationId,
    );
  }

  @Post('schedules/:scheduleId/disable')
  @ApiOperation({ summary: 'Disable a sync schedule' })
  async disableSchedule(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Req() req: any,
  ): Promise<SyncSchedule> {
    return this.syncService.disableSchedule(
      integrationId,
      scheduleId,
      req.user.organizationId,
    );
  }

  // Statistics and History
  @Get('stats')
  @ApiOperation({ summary: 'Get sync statistics' })
  @ApiQuery({ name: 'period', required: false, example: '7d' })
  async getSyncStats(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Req() req: any,
    @Query('period') period?: string,
  ): Promise<any> {
    return this.syncService.getSyncStats(
      integrationId,
      req.user.organizationId,
      { period },
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get sync history' })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 30 })
  async getSyncHistory(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Req() req: any,
    @Query('days') days?: number,
  ): Promise<any> {
    return this.syncService.getSyncHistory(
      integrationId,
      req.user.organizationId,
      days,
    );
  }

  // Entity Mappings
  @Get('mappings')
  @ApiOperation({ summary: 'Get entity field mappings' })
  async getEntityMappings(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Req() req: any,
  ): Promise<any> {
    return this.syncService.getEntityMappings(
      integrationId,
      req.user.organizationId,
    );
  }

  @Put('mappings')
  @ApiOperation({ summary: 'Update entity field mappings' })
  async updateEntityMappings(
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Body() dto: UpdateEntityMappingsDto,
    @Req() req: any,
  ): Promise<any> {
    return this.syncService.updateEntityMappings(
      integrationId,
      req.user.organizationId,
      dto,
    );
  }
}