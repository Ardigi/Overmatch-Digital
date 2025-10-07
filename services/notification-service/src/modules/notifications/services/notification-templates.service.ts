import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateTemplateDto, UpdateTemplateDto } from '../dto';
import { NotificationChannel } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import type { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateTemplateDto,
    createdBy: string,
  ): Promise<NotificationTemplate> {
    // Check if code already exists
    const existing = await this.templateRepository.findOne({
      where: {
        organizationId,
        code: createDto.code,
      },
    });

    if (existing) {
      throw new ConflictException(`Template with code '${createDto.code}' already exists`);
    }

    const template = this.templateRepository.create({
      ...createDto,
      organizationId,
      createdBy,
    });

    // Validate template content on creation
    try {
      template.validateContent();
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    return await this.templateRepository.save(template);
  }

  async findAll(
    organizationId: string,
    query: any,
  ): Promise<{ items: NotificationTemplate[]; total: number }> {
    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .where('template.organizationId = :organizationId', { organizationId });

    if (query.channel) {
      queryBuilder.andWhere('template.channel = :channel', {
        channel: query.channel,
      });
    }

    if (query.type) {
      queryBuilder.andWhere('template.type = :type', { type: query.type });
    }

    if (query.category) {
      queryBuilder.andWhere('template.category = :category', {
        category: query.category,
      });
    }

    if (query.isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(template.name ILIKE :search OR template.code ILIKE :search OR template.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('template.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(organizationId: string, id: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, organizationId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async findByCode(organizationId: string, code: string): Promise<NotificationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { organizationId, code, isActive: true },
    });

    if (!template) {
      throw new NotFoundException(`Template with code '${code}' not found`);
    }

    return template;
  }

  async update(
    organizationId: string,
    id: string,
    updateDto: UpdateTemplateDto,
    updatedBy: string,
  ): Promise<NotificationTemplate> {
    const template = await this.findOne(organizationId, id);

    // Code is not updatable as it's excluded from UpdateTemplateDto

    Object.assign(template, {
      ...updateDto,
      updatedBy,
      version: template.version + 1,
    });

    // Validate template content if updated
    if (updateDto.content) {
      try {
        template.validateContent();
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    return await this.templateRepository.save(template);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const template = await this.findOne(organizationId, id);

    if (template.isSystem) {
      throw new BadRequestException('System templates cannot be deleted');
    }

    await this.templateRepository.remove(template);
  }

  async clone(
    organizationId: string,
    id: string,
    createdBy: string,
  ): Promise<NotificationTemplate> {
    const original = await this.findOne(organizationId, id);
    const clonedData = original.clone();

    const cloned = this.templateRepository.create({
      ...clonedData,
      organizationId,
      createdBy,
    });

    return await this.templateRepository.save(cloned);
  }

  async testTemplate(
    organizationId: string,
    id: string,
    variables: Record<string, any>,
    recipientEmail: string,
  ): Promise<{ success: boolean; preview?: any; error?: string }> {
    try {
      const template = await this.findOne(organizationId, id);

      // Validate variables
      const validation = template.validateVariables(variables);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid variables: ${validation.errors.join(', ')}`,
        };
      }

      // Interpolate template
      const content = template.interpolate(variables);

      // Create preview
      const preview = {
        channel: template.channel,
        recipient: {
          email: recipientEmail,
        },
        content,
        variables,
        metadata: {
          isTest: true,
          templateId: template.id,
          templateCode: template.code,
        },
      };

      // Optionally send test notification
      if (template.channel === NotificationChannel.EMAIL) {
        await this.notificationsService.create(
          organizationId,
          {
            channel: template.channel,
            type: template.type,
            category: template.category,
            templateId: template.id,
            recipient: {
              id: 'test-recipient',
              email: recipientEmail,
            },
            variables,
            isTransactional: true,
            tags: ['test'],
          },
          'system',
        );
      }

      return {
        success: true,
        preview,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async updatePerformanceMetrics(templateId: string, metrics: any): Promise<void> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId },
    });

    if (template) {
      template.updatePerformanceMetrics(metrics);
      await this.templateRepository.save(template);
    }
  }
}