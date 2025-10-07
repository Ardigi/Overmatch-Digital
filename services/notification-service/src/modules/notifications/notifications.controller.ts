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
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  type CreateBulkNotificationDto,
  type CreateNotificationDto,
  CreatePreferenceDto,
  type CreateTemplateDto,
  type OptOutDto,
  type QueryNotificationDto,
  type UpdateNotificationDto,
  type UpdatePreferenceDto,
  type UpdateTemplateDto,
} from './dto';
import type { NotificationsService } from './notifications.service';
import type { NotificationPreferencesService } from './services/notification-preferences.service';
import type { NotificationTemplatesService } from './services/notification-templates.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly templatesService: NotificationTemplatesService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(
      user.organizationId,
      createDto,
      user.id,
    );
  }

  @Post('bulk')
  @Roles('admin')
  async createBulk(
    @CurrentUser() user: any,
    @Body() createDto: CreateBulkNotificationDto,
  ) {
    return this.notificationsService.createBulk(
      user.organizationId,
      createDto,
      user.id,
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query() query: QueryNotificationDto,
  ) {
    const { page = 1, limit = 20, ...filters } = query;
    const result = await this.notificationsService.findAll(
      user.organizationId,
      { page, limit, ...filters },
    );

    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  @Get('stats')
  async getStats(
    @CurrentUser() user: any,
    @Query() query: { startDate?: string; endDate?: string },
  ) {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return this.notificationsService.getStats(
      user.organizationId,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.notificationsService.findOne(user.organizationId, id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(
      user.organizationId,
      id,
      updateDto,
      user.id,
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.cancel(
      user.organizationId,
      id,
      user.id,
    );
    return { message: 'Notification cancelled successfully' };
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  async resend(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.notificationsService.resend(
      user.organizationId,
      id,
      user.id,
    );
    return { message: 'Notification queued for resend' };
  }

  // Tracking endpoints (public)
  @Get('track/:id/open')
  @UseGuards()
  async recordOpen(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // Extract org ID from notification (would need to implement)
    const organizationId = 'org-123'; // Placeholder
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    await this.notificationsService.recordOpen(
      organizationId,
      id,
      ip,
      userAgent,
    );

    // Return 1x1 transparent pixel
    return Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );
  }

  @Get('track/:id/click')
  @UseGuards()
  async recordClick(
    @Param('id') id: string,
    @Query('url') url: string,
    @Request() req: any,
    @Response() res: any,
  ) {
    // Extract org ID from notification (would need to implement)
    const organizationId = 'org-123'; // Placeholder
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    await this.notificationsService.recordClick(
      organizationId,
      id,
      url,
      ip,
      userAgent,
    );

    res.redirect(url);
  }

  // Template endpoints
  @Post('templates')
  @Roles('admin')
  async createTemplate(
    @CurrentUser() user: any,
    @Body() createDto: CreateTemplateDto,
  ) {
    return this.templatesService.create(
      user.organizationId,
      createDto,
      user.id,
    );
  }

  @Get('templates')
  async findAllTemplates(
    @CurrentUser() user: any,
    @Query() query: any,
  ) {
    const result = await this.templatesService.findAll(
      user.organizationId,
      query,
    );

    return {
      ...result,
      page: query.page || 1,
      limit: query.limit || 20,
      totalPages: Math.ceil(result.total / (query.limit || 20)),
    };
  }

  @Get('templates/:id')
  async findOneTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.templatesService.findOne(user.organizationId, id);
  }

  @Put('templates/:id')
  @Roles('admin')
  async updateTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(
      user.organizationId,
      id,
      updateDto,
      user.id,
    );
  }

  @Delete('templates/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.templatesService.delete(user.organizationId, id);
  }

  @Post('templates/:id/clone')
  @Roles('admin')
  async cloneTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.templatesService.clone(
      user.organizationId,
      id,
      user.id,
    );
  }

  @Post('templates/:id/test')
  @Roles('admin')
  async testTemplate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() testData: { variables: Record<string, any>; recipientEmail?: string },
  ) {
    return this.templatesService.testTemplate(
      user.organizationId,
      id,
      testData.variables,
      testData.recipientEmail || user.email,
    );
  }

  // Preference endpoints
  @Get('preferences/me')
  async getMyPreferences(@CurrentUser() user: any) {
    let preferences = await this.preferencesService.findByUser(
      user.organizationId,
      user.id,
    );

    if (!preferences) {
      // Create default preferences
      preferences = await this.preferencesService.create(
        user.organizationId,
        {
          userId: user.id,
          userEmail: user.email,
        },
        user.id,
      );
    }

    return preferences;
  }

  @Put('preferences/me')
  async updateMyPreferences(
    @CurrentUser() user: any,
    @Body() updateDto: UpdatePreferenceDto,
  ) {
    return this.preferencesService.update(
      user.organizationId,
      user.id,
      updateDto,
      user.id,
    );
  }

  @Post('preferences/me/opt-out')
  @HttpCode(HttpStatus.OK)
  async optOut(
    @CurrentUser() user: any,
    @Body() optOutDto: OptOutDto,
  ) {
    await this.preferencesService.optOut(
      user.organizationId,
      user.id,
      optOutDto.reason,
    );
    return { message: 'Successfully opted out of notifications' };
  }

  @Post('preferences/me/opt-in')
  @HttpCode(HttpStatus.OK)
  async optIn(@CurrentUser() user: any) {
    await this.preferencesService.optIn(
      user.organizationId,
      user.id,
    );
    return { message: 'Successfully opted in to notifications' };
  }

  @Post('preferences/me/block-user/:blockedUserId')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @CurrentUser() user: any,
    @Param('blockedUserId') blockedUserId: string,
  ) {
    await this.preferencesService.blockUser(
      user.organizationId,
      user.id,
      blockedUserId,
    );
    return { message: 'User blocked successfully' };
  }

  @Delete('preferences/me/block-user/:blockedUserId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @CurrentUser() user: any,
    @Param('blockedUserId') blockedUserId: string,
  ) {
    await this.preferencesService.unblockUser(
      user.organizationId,
      user.id,
      blockedUserId,
    );
    return { message: 'User unblocked successfully' };
  }

  @Post('preferences/me/block-source/:source')
  @HttpCode(HttpStatus.OK)
  async blockSource(
    @CurrentUser() user: any,
    @Param('source') source: string,
  ) {
    await this.preferencesService.blockSource(
      user.organizationId,
      user.id,
      source,
    );
    return { message: 'Source blocked successfully' };
  }

  @Delete('preferences/me/block-source/:source')
  @HttpCode(HttpStatus.OK)
  async unblockSource(
    @CurrentUser() user: any,
    @Param('source') source: string,
  ) {
    await this.preferencesService.unblockSource(
      user.organizationId,
      user.id,
      source,
    );
    return { message: 'Source unblocked successfully' };
  }

  // Admin preference endpoints
  @Get('preferences/:userId')
  @Roles('admin')
  async getUserPreferences(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.preferencesService.findByUser(
      user.organizationId,
      userId,
    );
  }

  @Put('preferences/:userId')
  @Roles('admin')
  async updateUserPreferences(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Body() updateDto: UpdatePreferenceDto,
  ) {
    return this.preferencesService.update(
      user.organizationId,
      userId,
      updateDto,
      user.id,
    );
  }

  // Unsubscribe endpoint (public)
  @Get('unsubscribe/:token')
  @UseGuards()
  async unsubscribe(
    @Param('token') token: string,
    @Response() res: any,
  ) {
    const result = await this.preferencesService.handleUnsubscribe(token);

    if (result.success) {
      res.status(HttpStatus.OK).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Unsubscribed Successfully</h1>
            <p>${result.message}</p>
          </body>
        </html>
      `);
    } else {
      res.status(HttpStatus.BAD_REQUEST).send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Unsubscribe Failed</h1>
            <p>${result.message}</p>
          </body>
        </html>
      `);
    }
  }
}