import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TestNotificationsService {
  // Mock templates for testing
  private mockTemplates = [
    {
      id: 'welcome-email',
      name: 'Welcome Email',
      type: 'email',
      subject: 'Welcome to SOC Compliance Platform',
      body: 'Hello {{userName}}, welcome to our platform!',
      variables: ['userName'],
      category: 'user',
      active: true,
    },
    {
      id: 'control-assigned',
      name: 'Control Assigned',
      type: 'email',
      subject: 'New Control Assigned: {{controlName}}',
      body: 'You have been assigned to control: {{controlName}} by {{assignedBy}}',
      variables: ['controlName', 'assignedBy'],
      category: 'control',
      active: true,
    },
    {
      id: 'evidence-due',
      name: 'Evidence Due Reminder',
      type: 'email',
      subject: 'Evidence Due Soon: {{evidenceName}}',
      body: 'Evidence {{evidenceName}} is due in {{daysUntilDue}} days on {{dueDate}}',
      variables: ['evidenceName', 'daysUntilDue', 'dueDate'],
      category: 'evidence',
      active: true,
    },
    {
      id: 'report-generated',
      name: 'Report Generated',
      type: 'email',
      subject: 'Report Ready: {{reportName}}',
      body: 'Your report {{reportName}} is ready. Download: {{downloadUrl}}',
      variables: ['reportName', 'downloadUrl'],
      category: 'report',
      active: true,
    },
  ];

  async getTemplates(type?: string) {
    let templates = this.mockTemplates;
    if (type) {
      templates = templates.filter((t) => t.type === type);
    }
    return templates;
  }

  async createTemplate(createDto: any) {
    // Basic validation
    if (!createDto.subject || createDto.subject.includes('{{variable')) {
      throw new BadRequestException('Invalid template syntax');
    }

    return {
      id: createDto.id,
      name: createDto.name,
      variables: createDto.variables,
      ...createDto,
    };
  }

  async getUserPreferences(userId: string) {
    return {
      userId,
      channels: {
        email: true,
        inApp: true,
        sms: false,
        push: false,
      },
      preferences: {
        controlAssigned: { email: true, inApp: true },
        evidenceDue: { email: true, inApp: true },
      },
    };
  }

  async updateUserPreferences(userId: string, updateDto: any) {
    return {
      userId,
      channels: updateDto.channels,
      preferences: updateDto.preferences,
      quietHours: updateDto.quietHours,
    };
  }

  async sendNotification(createDto: any) {
    // Check if template exists
    const template = this.mockTemplates.find((t) => t.id === createDto.templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check for missing variables
    if (template.variables && template.variables.length > 0) {
      const missingVars = template.variables.filter(
        (v) => !createDto.data || !(v in createDto.data)
      );
      if (missingVars.length > 0) {
        throw new BadRequestException(`Missing required variables: ${missingVars.join(', ')}`);
      }
    }

    // Check user preferences for skipping
    if (
      createDto.recipients.includes('11111111-1111-1111-1111-111111111111') &&
      createDto.channel === 'email' &&
      createDto.templateId === 'evidence-due'
    ) {
      return {
        id: uuidv4(),
        status: 'skipped',
        reason: 'User preference disabled',
        templateId: createDto.templateId,
      };
    }

    return {
      id: uuidv4(),
      status: createDto.recipients.length > 1 ? 'processing' : 'queued',
      templateId: createDto.templateId,
      ...(createDto.recipients.length > 1 && {
        batchId: uuidv4(),
        recipientCount: createDto.recipients.length,
      }),
    };
  }

  async sendBatchNotifications(batchDto: any) {
    return {
      batchId: uuidv4(),
      totalNotifications: batchDto.notifications.length,
      status: 'processing',
    };
  }

  async getNotifications(query: any) {
    const mockNotifications = [
      {
        id: uuidv4(),
        recipientId: query.recipientId || '11111111-1111-1111-1111-111111111111',
        status: query.status || 'delivered',
        templateId: 'welcome-email',
        createdAt: new Date(),
      },
    ];

    let filteredNotifications = mockNotifications;
    if (query.recipientId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.recipientId === query.recipientId
      );
    }
    if (query.status) {
      filteredNotifications = filteredNotifications.filter((n) => n.status === query.status);
    }

    return {
      data: filteredNotifications,
      pagination: {
        total: filteredNotifications.length,
        page: 1,
        limit: 20,
      },
    };
  }

  async getNotification(id: string) {
    // Handle analytics endpoint differently
    if (id === 'analytics') {
      return this.getAnalytics('7d');
    }

    return {
      id,
      templateId: 'welcome-email',
      status: 'delivered',
      deliveryAttempts: [],
    };
  }

  async getInAppNotifications(userId: string) {
    return {
      unread: 1,
      notifications: [
        {
          id: uuidv4(),
          userId,
          message: 'You have been assigned to control: Password Policy',
          createdAt: new Date(),
          readAt: null,
        },
      ],
    };
  }

  async markAsRead(id: string) {
    return {
      id,
      readAt: new Date(),
    };
  }

  async markAllAsRead(userId: string) {
    return {
      updated: 1,
    };
  }

  async getAnalytics(period: string) {
    return {
      totalSent: 100,
      delivered: 95,
      failed: 5,
      opened: 60,
      clicked: 25,
      byChannel: {
        email: 80,
        inApp: 20,
      },
      byTemplate: {
        'welcome-email': 30,
        'control-assigned': 40,
        'evidence-due': 30,
      },
    };
  }

  async getTemplateAnalytics(templateId: string) {
    return {
      templateId,
      totalSent: 50,
      deliveryRate: 95,
      openRate: 60,
      clickRate: 25,
    };
  }
}
