import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Response,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ServiceAuth } from '@soc-compliance/auth-common';
import type { Response as ExpressResponse } from 'express';
import type { Multer } from 'multer';

type MulterFile = Express.Multer.File;

import type { KongUser as KongUserInterface } from '../../shared/decorators/kong-user.decorator';
import { KongUser } from '../../shared/decorators/kong-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';
import type {
  BulkCollectEvidenceDto,
  BulkDeleteEvidenceDto,
  BulkLinkEvidenceDto,
  BulkUpdateEvidenceDto,
  BulkValidateEvidenceDto,
  CreateEvidenceDto,
  GetEvidenceByControlDto,
  LinkEvidenceToControlDto,
  QueryEvidenceDto,
  UnlinkEvidenceFromControlDto,
  UpdateEvidenceDto,
} from './dto';
import type { EvidenceService } from './evidence.service';

@Controller('evidence')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class EvidenceController {
  private readonly logger = new Logger(EvidenceController.name);

  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @Roles('admin', 'compliance_manager', 'auditor', 'evidence_collector')
  create(@Body() createEvidenceDto: CreateEvidenceDto, @KongUser() user: KongUserInterface) {
    return this.evidenceService.create({
      ...createEvidenceDto,
      createdBy: user.id,
    });
  }

  @Post('upload')
  @Roles('admin', 'compliance_manager', 'auditor', 'evidence_collector')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEvidence(
    @UploadedFile() file: MulterFile | undefined,
    @Body() createEvidenceDto: CreateEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Here you would typically:
    // 1. Upload file to storage service (S3, Azure Blob, etc.)
    // 2. Get the storage URL
    // 3. Extract metadata
    // For now, we'll simulate this:

    const metadata = {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      // Add more metadata extraction here
    };

    return this.evidenceService.create({
      ...createEvidenceDto,
      metadata,
      // storageUrl: uploadedFileUrl,
      createdBy: user.id,
    });
  }

  @Get()
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst', 'evidence_viewer')
  findAll(@Query() query: QueryEvidenceDto) {
    return this.evidenceService.findAll(query);
  }

  @Get('expiring')
  @Roles('admin', 'compliance_manager', 'auditor')
  getExpiringEvidence(@Query('daysAhead') daysAhead?: string) {
    const days = daysAhead ? parseInt(daysAhead) : 30;
    return this.evidenceService.getExpiringEvidence(days);
  }

  @Get('audit/:auditId')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  getEvidenceByAudit(@Param('auditId') auditId: string) {
    return this.evidenceService.getEvidenceByAudit(auditId);
  }

  @Get('control/:controlId')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  getEvidenceByControl(@Param('controlId') controlId: string) {
    return this.evidenceService.getEvidenceByControl(controlId);
  }

  @Get('stats')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  getEvidenceStats() {
    return this.evidenceService.getEvidenceStats();
  }

  @Get(':id')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst', 'evidence_viewer')
  async findOne(@Param('id') id: string, @KongUser() user?: KongUserInterface) {
    const evidence = await this.evidenceService.findOne(id);
    
    // Record view access if user is provided
    if (user?.id) {
      await this.evidenceService.recordAccess(id, user.id, 'view');
    }
    
    return evidence;
  }

  @Get(':id/versions')
  @Roles('admin', 'compliance_manager', 'auditor')
  getVersionHistory(@Param('id') id: string) {
    return this.evidenceService.getVersionHistory(id);
  }

  @Get(':id/download')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst', 'evidence_viewer')
  @Header('Content-Type', 'application/octet-stream')
  async downloadEvidence(
    @Param('id') id: string,
    @Response() res: ExpressResponse,
  ) {
    const file = await this.evidenceService.downloadEvidence(id);
    
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    
    res.send(file.buffer);
  }

  @Patch(':id')
  @Roles('admin', 'compliance_manager', 'auditor', 'evidence_collector')
  update(
    @Param('id') id: string,
    @Body() updateEvidenceDto: UpdateEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.update(id, {
      ...updateEvidenceDto,
      updatedBy: user.id,
    });
  }

  @Post(':id/approve')
  @Roles('admin', 'compliance_manager', 'auditor')
  approve(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.approve(id, user.id, comments);
  }

  @Post(':id/reject')
  @Roles('admin', 'compliance_manager', 'auditor')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @KongUser() user: KongUserInterface,
  ) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }
    return this.evidenceService.reject(id, user.id, reason);
  }

  @Post(':id/validate')
  @Roles('admin', 'compliance_manager', 'auditor')
  validateEvidence(
    @Param('id') id: string,
    @Body() validateDto: { isValid: boolean; validationComments?: string },
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.validateEvidence(id, validateDto, user.id);
  }

  @Post(':id/new-version')
  @Roles('admin', 'compliance_manager', 'auditor', 'evidence_collector')
  createNewVersion(
    @Param('id') id: string,
    @Body() createEvidenceDto: CreateEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.createNewVersion(id, {
      ...createEvidenceDto,
      createdBy: user.id,
    });
  }

  @Delete(':id')
  @Roles('admin', 'compliance_manager')
  remove(@Param('id') id: string) {
    return this.evidenceService.remove(id);
  }

  @Post('bulk/update')
  @Roles('admin', 'compliance_manager', 'auditor')
  bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.bulkUpdate(bulkUpdateDto, user.id);
  }

  @Post('bulk/delete')
  @HttpCode(200)
  @Roles('admin', 'compliance_manager')
  bulkDelete(
    @Body() bulkDeleteDto: BulkDeleteEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.bulkDelete(bulkDeleteDto, user.id);
  }

  @Post('bulk/validate')
  @Roles('admin', 'compliance_manager', 'auditor')
  async bulkValidate(
    @Body() bulkValidateDto: BulkValidateEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    // This would integrate with the validation service
    throw new BadRequestException('Bulk validation not yet implemented');
  }

  @Post('bulk/collect')
  @Roles('admin', 'compliance_manager', 'evidence_collector')
  async bulkCollect(
    @Body() bulkCollectDto: BulkCollectEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.bulkCollect(bulkCollectDto, user.id);
  }

  @Post(':id/link-control')
  @Roles('admin', 'compliance_manager', 'auditor')
  linkToControl(
    @Param('id') id: string,
    @Body() linkDto: LinkEvidenceToControlDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.linkToControl(id, linkDto, user.id);
  }

  @Post('bulk/link-control')
  @Roles('admin', 'compliance_manager', 'auditor')
  bulkLinkToControl(
    @Body() bulkLinkDto: BulkLinkEvidenceDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.bulkLinkToControl(bulkLinkDto, user.id);
  }

  @Delete(':id/unlink-control')
  @Roles('admin', 'compliance_manager', 'auditor')
  unlinkFromControl(
    @Param('id') id: string,
    @Body() unlinkDto: UnlinkEvidenceFromControlDto,
    @KongUser() user: KongUserInterface,
  ) {
    return this.evidenceService.unlinkFromControl(id, unlinkDto, user.id);
  }

  @Post('control/search')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  getEvidenceByControlWithFilters(@Body() query: GetEvidenceByControlDto) {
    return this.evidenceService.getEvidenceByControlWithFilters(query);
  }

  @Get('control/:controlId/summary')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  getControlEvidenceSummary(
    @Param('controlId') controlId: string,
    @Query('organizationId') organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    return this.evidenceService.getControlEvidenceSummary(controlId, organizationId);
  }

  @Get(':id/history')
  @Roles('admin', 'compliance_manager', 'auditor')
  getEvidenceHistory(@Param('id') id: string) {
    return this.evidenceService.getVersionHistory(id);
  }

  @Get('insights/:organizationId')
  @Roles('admin', 'compliance_manager', 'auditor', 'analyst')
  @ServiceAuth() // Allow service-to-service calls
  async getInsights(
    @Param('organizationId') organizationId: string,
    @Query('integrationId') integrationId?: string,
  ) {
    try {
      // Get real evidence statistics from the service
      const stats = await this.evidenceService.getStatistics(organizationId);
      
      // Get daily collection trends from the last 7 days
      const dailyTrends = await this.evidenceService.getDailyCollectionTrends(
        organizationId,
        7, // days
        integrationId
      );
      
      // Get integration-specific metrics if requested
      let integrationMetrics = null;
      if (integrationId) {
        integrationMetrics = await this.evidenceService.getIntegrationMetrics(
          organizationId,
          integrationId
        );
      }
      
      const insights = {
        organizationId,
        integrationId,
        statistics: stats,
        collectionTrends: {
          daily: dailyTrends,
          byType: stats.byType,
          byStatus: stats.byStatus,
        },
        qualityMetrics: {
          averageQualityScore: stats.averageQualityScore || 0,
          needsReview: stats.needsReview || 0,
          expiringSoon: stats.expiringSoon || 0,
          completeness: stats.completeness || 0,
        },
        integrationSpecific: integrationMetrics,
      };
      
      return insights;
    } catch (error) {
      this.logger.error(`Failed to get evidence insights: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve evidence insights');
    }
  }
}