import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import type { CreatePreferenceDto, UpdatePreferenceDto } from '../dto';
import { type NotificationCategory, NotificationChannel, type NotificationType } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    organizationId: string,
    createDto: CreatePreferenceDto,
    createdBy: string,
  ): Promise<NotificationPreference> {
    const preference = this.preferenceRepository.create({
      organizationId,
      ...createDto,
      lastUpdatedBy: createdBy,
      // Set default channel preferences
      channels: createDto.channels || {
        [NotificationChannel.EMAIL]: {
          enabled: true,
          frequency: 'immediate',
        },
        [NotificationChannel.SMS]: {
          enabled: false,
        },
        [NotificationChannel.IN_APP]: {
          enabled: true,
          frequency: 'immediate',
        },
        [NotificationChannel.SLACK]: {
          enabled: false,
        },
        [NotificationChannel.TEAMS]: {
          enabled: false,
        },
        [NotificationChannel.WEBHOOK]: {
          enabled: false,
        },
      },
    });

    return await this.preferenceRepository.save(preference);
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<NotificationPreference> {
    const preference = await this.preferenceRepository.findOne({
      where: { id, organizationId },
    });

    if (!preference) {
      throw new NotFoundException('Preference not found');
    }

    return preference;
  }

  async findByUser(
    organizationId: string,
    userId: string,
  ): Promise<NotificationPreference | null> {
    return await this.preferenceRepository.findOne({
      where: { organizationId, userId },
    });
  }

  async update(
    organizationId: string,
    userId: string,
    updateDto: UpdatePreferenceDto,
    updatedBy: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      // Create preference if it doesn't exist
      preference = await this.create(
        organizationId,
        {
          userId,
          ...updateDto,
        },
        updatedBy,
      );
    } else {
      Object.assign(preference, {
        ...updateDto,
        lastUpdatedBy: updatedBy,
      });
      preference = await this.preferenceRepository.save(preference);
    }

    return preference;
  }

  async setChannelPreference(
    organizationId: string,
    userId: string,
    channel: NotificationChannel,
    preference: any,
    updatedBy: string,
  ): Promise<NotificationPreference> {
    let pref = await this.findByUser(organizationId, userId);

    if (!pref) {
      pref = await this.create(
        organizationId,
        { userId },
        updatedBy,
      );
    }

    pref.setChannelPreference(channel, preference);
    pref.lastUpdatedBy = updatedBy;

    return await this.preferenceRepository.save(pref);
  }

  async setCategoryPreference(
    organizationId: string,
    userId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    enabled: boolean,
    updatedBy: string,
  ): Promise<NotificationPreference> {
    let pref = await this.findByUser(organizationId, userId);

    if (!pref) {
      pref = await this.create(
        organizationId,
        { userId },
        updatedBy,
      );
    }

    pref.setCategoryPreference(channel, category, enabled);
    pref.lastUpdatedBy = updatedBy;

    return await this.preferenceRepository.save(pref);
  }

  async setTypePreference(
    organizationId: string,
    userId: string,
    channel: NotificationChannel,
    type: NotificationType,
    enabled: boolean,
    updatedBy: string,
  ): Promise<NotificationPreference> {
    let pref = await this.findByUser(organizationId, userId);

    if (!pref) {
      pref = await this.create(
        organizationId,
        { userId },
        updatedBy,
      );
    }

    pref.setTypePreference(channel, type, enabled);
    pref.lastUpdatedBy = updatedBy;

    return await this.preferenceRepository.save(pref);
  }

  async optOut(
    organizationId: string,
    userId: string,
    reason?: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.optedOut = true;
    preference.optedOutAt = new Date();
    preference.optOutReason = reason;
    preference.updateStats('optedOut');

    return await this.preferenceRepository.save(preference);
  }

  async optIn(
    organizationId: string,
    userId: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.optIn();

    return await this.preferenceRepository.save(preference);
  }

  async blockUser(
    organizationId: string,
    userId: string,
    blockedUserId: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.blockUser(blockedUserId);

    return await this.preferenceRepository.save(preference);
  }

  async unblockUser(
    organizationId: string,
    userId: string,
    blockedUserId: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.unblockUser(blockedUserId);

    return await this.preferenceRepository.save(preference);
  }

  async blockSource(
    organizationId: string,
    userId: string,
    source: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.blockSource(source);

    return await this.preferenceRepository.save(preference);
  }

  async unblockSource(
    organizationId: string,
    userId: string,
    source: string,
  ): Promise<NotificationPreference> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    preference.unblockSource(source);

    return await this.preferenceRepository.save(preference);
  }

  async generateUnsubscribeLink(
    organizationId: string,
    userId: string,
  ): Promise<string> {
    let preference = await this.findByUser(organizationId, userId);

    if (!preference) {
      preference = await this.create(
        organizationId,
        { userId },
        userId,
      );
    }

    const token = preference.generateUnsubscribeToken();
    await this.preferenceRepository.save(preference);

    const baseUrl = this.configService.get('app.baseUrl') || 'http://localhost:3010';
    return `${baseUrl}/notifications/unsubscribe/${token}`;
  }

  async handleUnsubscribe(
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    const preference = await this.preferenceRepository.findOne({
      where: { unsubscribeToken: token },
    });

    if (!preference) {
      return {
        success: false,
        message: 'Invalid or expired unsubscribe token',
      };
    }

    preference.optedOut = true;
    preference.optedOutAt = new Date();
    preference.optOutReason = 'Unsubscribed via email link';
    preference.updateStats('optedOut');

    await this.preferenceRepository.save(preference);

    return {
      success: true,
      message: 'You have been successfully unsubscribed from all notifications',
    };
  }

  async updateStats(
    organizationId: string,
    userId: string,
    event: 'received' | 'opened' | 'clicked',
  ): Promise<void> {
    const preference = await this.findByUser(organizationId, userId);

    if (preference) {
      preference.updateStats(event);
      await this.preferenceRepository.save(preference);
    }
  }
}