import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

describe('SyncController', () => {
  let controller: SyncController;
  let syncService: any;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin'],
  };

  const mockSyncJob = {
    id: 'sync-123',
    integrationId: 'integration-123',
    organizationId: 'org-123',
    jobType: 'full_sync',
    status: 'completed',
    startedAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:15:00Z'),
    duration: 900000, // 15 minutes
    progress: {
      current: 1000,
      total: 1000,
      percentage: 100,
    },
    entities: [
      {
        entityType: 'Contact',
        status: 'completed',
        processed: 500,
        created: 50,
        updated: 400,
        deleted: 10,
        errors: 40,
      },
      {
        entityType: 'Account',
        status: 'completed',
        processed: 300,
        created: 30,
        updated: 250,
        deleted: 5,
        errors: 15,
      },
      {
        entityType: 'Opportunity',
        status: 'completed',
        processed: 200,
        created: 20,
        updated: 170,
        deleted: 5,
        errors: 5,
      },
    ],
    config: {
      batchSize: 100,
      parallel: true,
      retryFailures: true,
      continueOnError: true,
    },
    error: null,
    metadata: {
      triggeredBy: 'user-123',
      reason: 'Daily sync',
      version: '1.0.0',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSyncSchedule = {
    id: 'schedule-123',
    integrationId: 'integration-123',
    organizationId: 'org-123',
    name: 'Daily CRM Sync',
    description: 'Syncs CRM data every day at 2 AM',
    cronExpression: '0 2 * * *',
    timezone: 'America/New_York',
    enabled: true,
    syncConfig: {
      entities: ['Contact', 'Account', 'Opportunity'],
      mode: 'incremental',
      batchSize: 100,
      filters: {
        modifiedSince: 'lastSync',
      },
    },
    lastRunAt: new Date('2024-01-15T02:00:00Z'),
    nextRunAt: new Date('2024-01-16T02:00:00Z'),
    stats: {
      totalRuns: 30,
      successfulRuns: 28,
      failedRuns: 2,
      averageDuration: 900000,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    syncService = {
      startSync: jest.fn(),
      getSyncJob: jest.fn(),
      getSyncJobs: jest.fn(),
      cancelSync: jest.fn(),
      retrySync: jest.fn(),
      getSyncProgress: jest.fn(),
      createSchedule: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      getSchedules: jest.fn(),
      getSchedule: jest.fn(),
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn(),
      getSyncStats: jest.fn(),
      getSyncHistory: jest.fn(),
      getEntityMappings: jest.fn(),
      updateEntityMappings: jest.fn(),
    };

    // Manual instantiation
    controller = new SyncController(syncService);

    jest.clearAllMocks();
  });

  describe('startSync', () => {
    it('should start a new sync job', async () => {
      const startSyncDto = {
        entities: ['Contact', 'Account'],
        mode: 'incremental' as 'full' | 'incremental' | 'delta',
        filters: {
          modifiedSince: '2024-01-14T00:00:00Z',
        },
        options: {
          batchSize: 200,
          parallel: true,
          retryFailures: true,
        },
      };

      syncService.startSync.mockResolvedValue({
        ...mockSyncJob,
        id: 'sync-456',
        status: 'running',
        completedAt: null,
        progress: {
          current: 0,
          total: 1000,
          percentage: 0,
        },
      });

      const result = await controller.startSync('integration-123', startSyncDto, {
        user: mockUser,
      });

      expect(syncService.startSync).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId,
        startSyncDto
      );
      expect(result.status).toBe('running');
    });

    it('should validate sync mode', async () => {
      const invalidDto = {
        mode: 'full' as 'full' | 'incremental' | 'delta',
      };

      syncService.startSync.mockRejectedValue(new BadRequestException('Invalid sync mode'));

      await expect(
        controller.startSync('integration-123', invalidDto, { user: mockUser })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSyncJob', () => {
    it('should return sync job details', async () => {
      syncService.getSyncJob.mockResolvedValue(mockSyncJob);

      const result = await controller.getSyncJob('integration-123', 'sync-123', { user: mockUser });

      expect(syncService.getSyncJob).toHaveBeenCalledWith('sync-123', mockUser.organizationId);
      expect(result).toEqual(mockSyncJob);
    });
  });

  describe('getSyncJobs', () => {
    it('should return paginated sync jobs', async () => {
      const mockJobs = {
        data: [mockSyncJob],
        total: 1,
        page: 1,
        limit: 20,
      };

      syncService.getSyncJobs.mockResolvedValue(mockJobs);

      const result = await controller.getSyncJobs(
        'integration-123',
        { user: mockUser },
        'completed',
        1,
        20
      );

      expect(syncService.getSyncJobs).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId,
        {
          status: 'completed',
          page: 1,
          limit: 20,
        }
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getSyncProgress', () => {
    it('should return real-time sync progress', async () => {
      const progress = {
        jobId: 'sync-123',
        status: 'running',
        progress: {
          current: 450,
          total: 1000,
          percentage: 45,
        },
        currentEntity: 'Contact',
        currentBatch: 5,
        totalBatches: 10,
        estimatedTimeRemaining: 450000, // 7.5 minutes
        entities: [
          {
            entityType: 'Contact',
            status: 'in_progress',
            processed: 250,
            created: 25,
            updated: 200,
            errors: 25,
          },
          {
            entityType: 'Account',
            status: 'pending',
            processed: 0,
          },
        ],
      };

      syncService.getSyncProgress.mockResolvedValue(progress);

      const result = await controller.getSyncProgress('integration-123', 'sync-123', {
        user: mockUser,
      });

      expect(result.progress.percentage).toBe(45);
      expect(result.estimatedTimeRemaining).toBe(450000);
    });
  });

  describe('cancelSync', () => {
    it('should cancel running sync job', async () => {
      const cancelledJob = {
        ...mockSyncJob,
        status: 'cancelled',
        completedAt: new Date(),
        error: 'Cancelled by user',
      };

      syncService.cancelSync.mockResolvedValue(cancelledJob);

      const result = await controller.cancelSync('integration-123', 'sync-123', { user: mockUser });

      expect(syncService.cancelSync).toHaveBeenCalledWith('sync-123', mockUser.organizationId);
      expect(result.status).toBe('cancelled');
    });

    it('should not cancel completed jobs', async () => {
      syncService.cancelSync.mockRejectedValue(
        new BadRequestException('Cannot cancel completed job')
      );

      await expect(
        controller.cancelSync('integration-123', 'sync-123', { user: mockUser })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('retrySync', () => {
    it('should retry failed sync job', async () => {
      const retryDto = {
        entities: ['Contact'], // Retry only failed entities
        retryFailedOnly: true,
      };

      syncService.retrySync.mockResolvedValue({
        ...mockSyncJob,
        id: 'sync-789',
        status: 'running',
        metadata: {
          ...mockSyncJob.metadata,
          retriedFrom: 'sync-123',
        },
      });

      const result = await controller.retrySync('integration-123', 'sync-123', retryDto, {
        user: mockUser,
      });

      expect(syncService.retrySync).toHaveBeenCalledWith(
        'sync-123',
        mockUser.organizationId,
        retryDto
      );
      expect(result.metadata?.retriedFrom).toBe('sync-123');
    });
  });

  describe('Schedule Management', () => {
    describe('createSchedule', () => {
      it('should create sync schedule', async () => {
        const createDto = {
          name: 'Hourly Contact Sync',
          description: 'Syncs contacts every hour',
          cronExpression: '0 * * * *',
          timezone: 'UTC',
          syncConfig: {
            entities: ['Contact'],
            mode: 'incremental' as 'full' | 'incremental' | 'delta',
            batchSize: 50,
          },
        };

        syncService.createSchedule.mockResolvedValue({
          ...mockSyncSchedule,
          ...createDto,
          id: 'schedule-456',
        });

        const result = await controller.createSchedule('integration-123', createDto, {
          user: mockUser,
        });

        expect(syncService.createSchedule).toHaveBeenCalledWith(
          'integration-123',
          mockUser.organizationId,
          createDto
        );
        expect(result.cronExpression).toBe('0 * * * *');
      });

      it('should validate cron expression', async () => {
        const invalidDto = {
          name: 'Invalid Schedule',
          cronExpression: 'invalid-cron',
          syncConfig: {
            entities: ['Contact'],
            mode: 'full' as 'full' | 'incremental' | 'delta',
          },
        };

        syncService.createSchedule.mockRejectedValue(
          new BadRequestException('Invalid cron expression')
        );

        await expect(
          controller.createSchedule('integration-123', invalidDto, { user: mockUser })
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateSchedule', () => {
      it('should update schedule configuration', async () => {
        const updateDto = {
          cronExpression: '0 3 * * *', // Change to 3 AM
          syncConfig: {
            ...mockSyncSchedule.syncConfig,
            mode: 'incremental' as 'full' | 'incremental' | 'delta',
            batchSize: 200,
          },
        };

        syncService.updateSchedule.mockResolvedValue({
          ...mockSyncSchedule,
          ...updateDto,
          nextRunAt: new Date('2024-01-16T03:00:00Z'),
        });

        const result = await controller.updateSchedule(
          'integration-123',
          'schedule-123',
          updateDto,
          { user: mockUser }
        );

        expect(result.cronExpression).toBe('0 3 * * *');
        expect(result.syncConfig.batchSize).toBe(200);
      });
    });

    describe('enable/disable schedule', () => {
      it('should enable schedule', async () => {
        syncService.enableSchedule.mockResolvedValue({
          ...mockSyncSchedule,
          enabled: true,
        });

        const result = await controller.enableSchedule('integration-123', 'schedule-123', {
          user: mockUser,
        });

        expect(result.enabled).toBe(true);
      });

      it('should disable schedule', async () => {
        syncService.disableSchedule.mockResolvedValue({
          ...mockSyncSchedule,
          enabled: false,
          nextRunAt: null,
        });

        const result = await controller.disableSchedule('integration-123', 'schedule-123', {
          user: mockUser,
        });

        expect(result.enabled).toBe(false);
        expect(result.nextRunAt).toBeNull();
      });
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      const stats = {
        integrationId: 'integration-123',
        period: '7d',
        totalSyncs: 50,
        successfulSyncs: 45,
        failedSyncs: 5,
        successRate: 90,
        averageDuration: 900000,
        totalEntitiesSynced: 50000,
        entitiesByType: {
          Contact: 25000,
          Account: 15000,
          Opportunity: 10000,
        },
        errorsByType: {
          API_RATE_LIMIT: 20,
          VALIDATION_ERROR: 15,
          NETWORK_ERROR: 10,
        },
        peakSyncTimes: [
          { hour: 2, count: 15 },
          { hour: 14, count: 12 },
        ],
        dataVolume: {
          totalBytes: 5242880000, // 5GB
          averageBytesPerSync: 104857600, // 100MB
        },
      };

      syncService.getSyncStats.mockResolvedValue(stats);

      const result = await controller.getSyncStats('integration-123', { user: mockUser }, '7d');

      expect(syncService.getSyncStats).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId,
        { period: '7d' }
      );
      expect(result.successRate).toBe(90);
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history with timeline', async () => {
      const history = {
        timeline: [
          {
            date: '2024-01-15',
            syncs: 5,
            successful: 4,
            failed: 1,
            entities: 5000,
            duration: 4500000,
          },
          {
            date: '2024-01-14',
            syncs: 6,
            successful: 6,
            failed: 0,
            entities: 6000,
            duration: 5400000,
          },
        ],
        recentJobs: [mockSyncJob],
        trends: {
          syncFrequency: 'increasing',
          successRate: 'stable',
          dataVolume: 'increasing',
          performance: 'improving',
        },
      };

      syncService.getSyncHistory.mockResolvedValue(history);

      const result = await controller.getSyncHistory('integration-123', { user: mockUser }, 30);

      expect(result.timeline).toHaveLength(2);
      expect(result.trends.syncFrequency).toBe('increasing');
    });
  });

  describe('Entity Mappings', () => {
    describe('getEntityMappings', () => {
      it('should return entity field mappings', async () => {
        const mappings = {
          Contact: {
            sourceEntity: 'Contact',
            targetEntity: 'contacts',
            fields: [
              {
                source: 'FirstName',
                target: 'first_name',
                type: 'string',
                required: true,
                transform: null,
              },
              {
                source: 'LastName',
                target: 'last_name',
                type: 'string',
                required: true,
                transform: null,
              },
              {
                source: 'Email',
                target: 'email',
                type: 'email',
                required: true,
                transform: 'lowercase',
              },
            ],
            relationships: [
              {
                source: 'AccountId',
                target: 'account_id',
                type: 'lookup',
                entity: 'Account',
              },
            ],
            customMappings: [
              {
                source: 'custom_field__c',
                target: 'metadata.custom_field',
                type: 'string',
                transform: 'json_path',
              },
            ],
          },
        };

        syncService.getEntityMappings.mockResolvedValue(mappings);

        const result = await controller.getEntityMappings('integration-123', { user: mockUser });

        expect(result.Contact).toBeDefined();
        expect(result.Contact.fields).toHaveLength(3);
      });
    });

    describe('updateEntityMappings', () => {
      it('should update entity mappings', async () => {
        const updateDto = {
          Contact: {
            sourceEntity: 'Contact',
            targetEntity: 'contacts',
            fields: [
              {
                source: 'Phone',
                target: 'phone_number',
                type: 'string',
                transform: 'phone_format',
              },
            ],
          },
        };

        syncService.updateEntityMappings.mockResolvedValue({
          ...updateDto,
          updatedAt: new Date(),
        });

        const result = await controller.updateEntityMappings('integration-123', updateDto, {
          user: mockUser,
        });

        expect(syncService.updateEntityMappings).toHaveBeenCalledWith(
          'integration-123',
          mockUser.organizationId,
          updateDto
        );
        expect(result.Contact.fields[0].transform).toBe('phone_format');
      });
    });
  });

  describe('Role-based access control', () => {
    it('should allow sync managers to start syncs', async () => {
      const syncManagerUser = { ...mockUser, roles: ['sync_manager'] };
      syncService.startSync.mockResolvedValue(mockSyncJob);

      await controller.startSync('integration-123', { mode: 'full' }, { user: syncManagerUser });

      expect(syncService.startSync).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle sync job not found', async () => {
      syncService.getSyncJob.mockRejectedValue(new NotFoundException('Sync job not found'));

      await expect(
        controller.getSyncJob('integration-123', 'non-existent', { user: mockUser })
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle sync conflicts', async () => {
      syncService.startSync.mockRejectedValue(
        new BadRequestException('Another sync is already running')
      );

      await expect(controller.startSync('integration-123', {}, { user: mockUser })).rejects.toThrow(
        'Another sync is already running'
      );
    });
  });
});
