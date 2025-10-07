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
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../../shared/auth-common/decorators/roles.decorator';
import { KongUser } from '../../shared/decorators/kong-user.decorator';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';
import { ClientsService } from './clients.service';
import type {
  BulkInvitePortalUsersDto,
  CompleteOnboardingDto,
  CreateClientDto,
  InvitePortalUserDto,
  PortalAccessSettingsDto,
  QueryClientDto,
  ResendInvitationDto,
  StartOnboardingDto,
  UpdateClientDto,
  UpdatePortalUserDto,
} from './dto';
import type { ComplianceFramework, ComplianceStatus } from './entities/client.entity';

@Controller('clients')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles('admin', 'compliance_manager', 'account_manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) createClientDto: CreateClientDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.create(createClientDto, user.id);
  }

  @Get()
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async findAll(@Query(ValidationPipe) query: QueryClientDto) {
    return this.clientsService.findAll(query);
  }

  @Get('dashboard/stats')
  @Roles('admin', 'compliance_manager', 'analyst')
  async getDashboardStats() {
    return this.clientsService.getDashboardStats();
  }

  @Get('upcoming-audits')
  @Roles('admin', 'compliance_manager', 'auditor')
  async getUpcomingAudits(@Query('days') days?: string) {
    const daysAhead = days ? parseInt(days) : 90;
    const clients = await this.clientsService.getUpcomingAudits(daysAhead);
    return {
      data: clients,
      meta: {
        total: clients.length,
        daysAhead,
      },
    };
  }

  @Get('expiring-certificates')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async getExpiringCertificates(@Query('days') days?: string) {
    const daysAhead = days ? parseInt(days) : 90;
    const clients = await this.clientsService.getExpiringCertificates(daysAhead);
    return {
      data: clients,
      meta: {
        total: clients.length,
        daysAhead,
      },
    };
  }

  @Get('by-slug/:slug')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async findBySlug(@Param('slug') slug: string) {
    return this.clientsService.findBySlug(slug);
  }

  @Get(':id')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateClientDto: UpdateClientDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.update(id, updateClientDto, user.id);
  }

  @Put(':id/compliance-status')
  @Roles('admin', 'compliance_manager')
  async updateComplianceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: ComplianceStatus; notes?: string },
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.updateComplianceStatus(
      id,
      body.status,
      user.id,
      body.notes,
    );
  }

  @Post('onboarding/start')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async startOnboarding(
    @Body(ValidationPipe) startOnboardingDto: StartOnboardingDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.startOnboarding(startOnboardingDto, user.id);
  }

  @Post(':id/onboarding/complete')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async completeOnboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) completeOnboardingDto: CompleteOnboardingDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.completeOnboarding(
      id,
      completeOnboardingDto,
      user.id,
    );
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@Param('id', ParseUUIDPipe) id: string, @KongUser() user: KongUser) {
    await this.clientsService.archive(id, user.id);
  }

  @Post(':id/restore')
  @Roles('admin')
  async restore(@Param('id', ParseUUIDPipe) id: string, @KongUser() user: KongUser) {
    return this.clientsService.restore(id, user.id);
  }

  @Get(':id/compliance-metrics')
  @Roles('admin', 'compliance_manager', 'auditor')
  async getComplianceMetrics(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getComplianceMetrics(id);
  }

  @Get(':id/users')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async getClientUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    const users = await this.clientsService.getClientUsers(id, { status, role });
    return {
      data: users,
      meta: {
        total: users.length,
      },
    };
  }

  // Audit Scheduling Endpoints
  @Post(':id/audits')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async scheduleAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() auditData: {
      name: string;
      type: string;
      framework: ComplianceFramework;
      scheduledStartDate: Date;
      scheduledEndDate: Date;
      scope?: string;
      leadAuditorId?: string;
      auditFirmName?: string;
    },
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.scheduleAudit(id, auditData, user.id);
  }

  @Get(':id/audits')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async getClientAudits(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
    @Query('framework') framework?: ComplianceFramework,
    @Query('type') type?: string,
    @Query('year') year?: string,
  ) {
    const filters: any = {};
    if (status) filters.status = status;
    if (framework) filters.framework = framework;
    if (type) filters.type = type;
    if (year) filters.year = parseInt(year);

    const audits = await this.clientsService.getClientAudits(id, filters);
    return {
      data: audits,
      meta: {
        total: audits.length,
      },
    };
  }

  @Get(':id/audits/:auditId')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async getAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('auditId', ParseUUIDPipe) auditId: string,
  ) {
    return this.clientsService.getAuditById(id, auditId);
  }

  @Put(':id/audits/:auditId')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async updateAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('auditId', ParseUUIDPipe) auditId: string,
    @Body() updateData: any,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.updateAudit(id, auditId, updateData, user.id);
  }

  @Post(':id/audits/:auditId/cancel')
  @Roles('admin', 'compliance_manager')
  async cancelAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('auditId', ParseUUIDPipe) auditId: string,
    @Body() body: { reason: string },
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.cancelAudit(id, auditId, body.reason, user.id);
  }

  @Post(':id/audits/:auditId/complete')
  @Roles('admin', 'compliance_manager', 'auditor')
  async completeAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('auditId', ParseUUIDPipe) auditId: string,
    @Body() completionData: {
      result: string;
      findings?: any;
      certificateNumber?: string;
      certificateIssueDate?: Date;
      certificateExpiryDate?: Date;
      reportDeliveredDate?: Date;
    },
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.completeAudit(id, auditId, completionData, user.id);
  }

  // Client Portal Access Endpoints
  @Post(':id/portal/users')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async invitePortalUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) inviteDto: InvitePortalUserDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.invitePortalUser(id, inviteDto, user.id);
  }

  @Post(':id/portal/users/bulk')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async bulkInvitePortalUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) bulkInviteDto: BulkInvitePortalUsersDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.bulkInvitePortalUsers(
      id,
      bulkInviteDto.users,
      user.id,
      bulkInviteDto.sendInvitations,
    );
  }

  @Put(':id/portal/users/:userId')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async updatePortalUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(ValidationPipe) updateDto: UpdatePortalUserDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.updatePortalUser(id, userId, updateDto, user.id);
  }

  @Delete(':id/portal/users/:userId')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async removePortalUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @KongUser() user: KongUser,
  ) {
    await this.clientsService.removePortalUser(id, userId, user.id);
    return { message: 'Portal user removed successfully' };
  }

  @Post(':id/portal/users/resend-invitation')
  @Roles('admin', 'compliance_manager', 'account_manager')
  async resendInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) resendDto: ResendInvitationDto,
    @KongUser() user: KongUser,
  ) {
    await this.clientsService.resendInvitation(
      id,
      resendDto.userId,
      resendDto.customMessage,
    );
    return { message: 'Invitation resent successfully' };
  }

  @Put(':id/portal/settings')
  @Roles('admin', 'compliance_manager')
  async updatePortalSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) settingsDto: PortalAccessSettingsDto,
    @KongUser() user: KongUser,
  ) {
    return this.clientsService.updatePortalAccessSettings(id, settingsDto, user.id);
  }

  @Get(':id/portal/dashboard')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async getPortalDashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.getPortalDashboard(id);
  }

  @Post(':id/portal/activity')
  @Roles('admin', 'compliance_manager', 'account_manager', 'auditor')
  async logPortalActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() activityData: {
      userId: string;
      activityType: string;
      details?: any;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    await this.clientsService.logPortalActivity(
      id,
      activityData.userId,
      activityData.activityType,
      activityData.details,
      activityData.ipAddress,
      activityData.userAgent,
    );
    return { message: 'Activity logged successfully' };
  }
}