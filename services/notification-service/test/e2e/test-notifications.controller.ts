import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { TestNotificationsService } from './test-notifications.service';

// Mock DTOs for testing
interface CreateNotificationDto {
  templateId: string;
  recipients: string[];
  channel: string;
  data: any;
  priority?: string;
}

interface CreateTemplateDto {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
  category?: string;
  active?: boolean;
}

interface UpdatePreferenceDto {
  channels?: any;
  preferences?: any;
  quietHours?: any;
}

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: TestNotificationsService) {}

  // Notification Templates
  @Get('notification-templates')
  async getTemplates(@Query('type') type?: string) {
    return {
      data: await this.notificationsService.getTemplates(type),
    };
  }

  @Post('notification-templates')
  async createTemplate(@Body() createDto: CreateTemplateDto) {
    return this.notificationsService.createTemplate(createDto);
  }

  // User Preferences
  @Get('preferences/:userId')
  async getUserPreferences(@Param('userId') userId: string) {
    return this.notificationsService.getUserPreferences(userId);
  }

  @Put('preferences/:userId')
  async updateUserPreferences(
    @Param('userId') userId: string,
    @Body() updateDto: UpdatePreferenceDto,
  ) {
    return this.notificationsService.updateUserPreferences(userId, updateDto);
  }

  // Sending Notifications
  @Post('notifications/send')
  @HttpCode(HttpStatus.CREATED)
  async sendNotification(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.sendNotification(createDto);
  }

  @Post('notifications/send-batch')
  @HttpCode(HttpStatus.CREATED)
  async sendBatchNotifications(@Body() batchDto: any) {
    return this.notificationsService.sendBatchNotifications(batchDto);
  }

  // Notification History
  @Get('notifications')
  async getNotifications(@Query() query: any) {
    return this.notificationsService.getNotifications(query);
  }

  @Get('notifications/:id')
  async getNotification(@Param('id') id: string) {
    return this.notificationsService.getNotification(id);
  }

  // In-App Notifications
  @Get('notifications/in-app/:userId')
  async getInAppNotifications(@Param('userId') userId: string) {
    return this.notificationsService.getInAppNotifications(userId);
  }

  @Post('notifications/in-app/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('notifications/in-app/mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Body() body: { userId: string }) {
    return this.notificationsService.markAllAsRead(body.userId);
  }

  // Analytics
  @Get('notifications/analytics')
  async getAnalytics(@Query('period') period: string) {
    return this.notificationsService.getAnalytics(period);
  }

  @Get('notifications/analytics/templates/:templateId')
  async getTemplateAnalytics(@Param('templateId') templateId: string) {
    return this.notificationsService.getTemplateAnalytics(templateId);
  }
}