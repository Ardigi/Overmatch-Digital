import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import type { CreateWebhookDto } from './dto/create-webhook.dto';
import type { FilterWebhookEventsDto } from './dto/filter-webhook-events.dto';
import type { TestWebhookDto } from './dto/test-webhook.dto';
import type { TriggerWebhookDto } from './dto/trigger-webhook.dto';
import type { UpdateWebhookDto } from './dto/update-webhook.dto';
import { type WebhookEndpoint, WebhookStatus } from './entities/webhook-endpoint.entity';
import { EventStatus, type WebhookEvent } from './entities/webhook-event.entity';
import type { WebhookService } from './services/webhook.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhooks' })
  @ApiQuery({ name: 'status', enum: WebhookStatus, required: false })
  @ApiQuery({ name: 'integrationId', type: String, required: false })
  @ApiQuery({ name: 'tags', type: String, required: false })
  async listWebhooks(
    @Req() req: any,
    @Query('status') status?: WebhookStatus,
    @Query('integrationId') integrationId?: string,
    @Query('tags') tags?: string,
  ): Promise<WebhookEndpoint[]> {
    const filters = {
      status,
      integrationId,
      tags: tags ? tags.split(',') : undefined,
    };

    return this.webhookService.findAll(req.user.organizationId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<WebhookEndpoint> {
    return this.webhookService.findOne(id, req.user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async createWebhook(
    @Body() dto: CreateWebhookDto,
    @Req() req: any,
  ): Promise<WebhookEndpoint> {
    return this.webhookService.create({
      ...dto,
      organizationId: req.user.organizationId,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook' })
  async updateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
    @Req() req: any,
  ): Promise<WebhookEndpoint> {
    return this.webhookService.update(id, req.user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<void> {
    await this.webhookService.delete(id, req.user.organizationId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a webhook' })
  async activateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<WebhookEndpoint> {
    return this.webhookService.activate(id, req.user.organizationId);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a webhook' })
  async deactivateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<WebhookEndpoint> {
    return this.webhookService.deactivate(id, req.user.organizationId);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a webhook with sample payload' })
  async testWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestWebhookDto,
    @Req() req: any,
  ): Promise<any> {
    return this.webhookService.testWebhook(id, req.user.organizationId, dto);
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a webhook' })
  async triggerWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriggerWebhookDto,
    @Req() req: any,
  ): Promise<WebhookEvent> {
    return this.webhookService.triggerWebhook(id, req.user.organizationId, dto);
  }

  @Post(':id/incoming')
  @ApiOperation({ summary: 'Process incoming webhook' })
  @ApiHeader({ name: 'x-webhook-signature', required: false })
  async processIncomingWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ): Promise<any> {
    return this.webhookService.processIncomingWebhook(id, {
      payload,
      headers,
      signature: headers['x-webhook-signature'],
    });
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'Get webhook events' })
  @ApiQuery({ name: 'status', enum: EventStatus, required: false })
  @ApiQuery({ name: 'eventType', type: String, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('status') status?: EventStatus,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    const filters: FilterWebhookEventsDto = {
      status,
      eventType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    };

    return this.webhookService.getEvents(id, req.user.organizationId, filters);
  }

  @Get(':webhookId/events/:eventId')
  @ApiOperation({ summary: 'Get specific webhook event' })
  async getEvent(
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: any,
  ): Promise<WebhookEvent> {
    // Verify webhook access
    await this.webhookService.findOne(webhookId, req.user.organizationId);
    
    return this.webhookService.getEvent(eventId);
  }

  @Post(':webhookId/events/:eventId/retry')
  @ApiOperation({ summary: 'Retry a failed webhook event' })
  async retryEvent(
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: any,
  ): Promise<WebhookEvent> {
    return this.webhookService.retryEvent(eventId, req.user.organizationId);
  }

  @Post(':id/events/resend')
  @ApiOperation({ summary: 'Resend multiple webhook events' })
  async resendEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { eventIds: string[] },
    @Req() req: any,
  ): Promise<any> {
    return this.webhookService.resendEvents(id, req.user.organizationId, dto.eventIds);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiQuery({ name: 'hours', type: Number, required: false, example: 24 })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('hours') hours?: number,
  ): Promise<any> {
    return this.webhookService.getStats(id, req.user.organizationId, { hours });
  }
}