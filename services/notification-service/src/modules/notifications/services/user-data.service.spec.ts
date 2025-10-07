import { Test, TestingModule } from '@nestjs/testing';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { NotificationChannel } from '../entities/notification.entity';
import { type OrganizationData, type UserData, UserDataService } from './user-data.service';

describe('UserDataService', () => {
  let service: UserDataService;
  let mockServiceDiscovery: jest.Mocked<ServiceDiscoveryService>;

  beforeEach(async () => {
    mockServiceDiscovery = {
      callService: jest.fn(),
    } as any;

    service = new UserDataService(mockServiceDiscovery);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user data when service call succeeds', async () => {
      const userId = 'user-123';
      const mockUserData: UserData = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        organizationId: 'org-123',
      };

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: mockUserData,
      });

      const result = await service.getUserById(userId);

      expect(result).toEqual(mockUserData);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'auth-service',
        'GET',
        `/users/${userId}`,
        undefined
      );
    });

    it('should return null when service call fails', async () => {
      const userId = 'user-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date(),
        },
      });

      const result = await service.getUserById(userId);

      expect(result).toBeNull();
    });

    it('should return null when service call throws error', async () => {
      const userId = 'user-123';

      mockServiceDiscovery.callService.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('should return array of users when service call succeeds', async () => {
      const userIds = ['user-1', 'user-2'];
      const mockUsersData: UserData[] = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          organizationId: 'org-123',
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          organizationId: 'org-123',
        },
      ];

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: mockUsersData,
      });

      const result = await service.getUsersByIds(userIds);

      expect(result).toEqual(mockUsersData);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'auth-service',
        'POST',
        '/users/batch',
        { userIds }
      );
    });

    it('should return empty array when service call fails', async () => {
      const userIds = ['user-1', 'user-2'];

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'BATCH_FETCH_FAILED',
          message: 'Failed to fetch users',
          timestamp: new Date(),
        },
      });

      const result = await service.getUsersByIds(userIds);

      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization data when service call succeeds', async () => {
      const orgId = 'org-123';
      const mockOrgData: OrganizationData = {
        id: orgId,
        name: 'Test Company',
        domain: 'test.com',
        settings: {
          notifications: {
            enabled: true,
            channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
          },
        },
      };

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: mockOrgData,
      });

      const result = await service.getOrganizationById(orgId);

      expect(result).toEqual(mockOrgData);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'client-service',
        'GET',
        `/organizations/${orgId}`,
        undefined
      );
    });

    it('should return null when service call fails', async () => {
      const orgId = 'org-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'ORG_NOT_FOUND',
          message: 'Organization not found',
          timestamp: new Date(),
        },
      });

      const result = await service.getOrganizationById(orgId);

      expect(result).toBeNull();
    });
  });

  describe('getUsersByOrganization', () => {
    it('should return users for organization when service call succeeds', async () => {
      const orgId = 'org-123';
      const mockUsers: UserData[] = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          organizationId: orgId,
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          organizationId: orgId,
        },
      ];

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: mockUsers,
      });

      const result = await service.getUsersByOrganization(orgId);

      expect(result).toEqual(mockUsers);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'auth-service',
        'GET',
        `/organizations/${orgId}/users`,
        undefined
      );
    });

    it('should return empty array when service call fails', async () => {
      const orgId = 'org-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch organization users',
          timestamp: new Date(),
        },
      });

      const result = await service.getUsersByOrganization(orgId);

      expect(result).toEqual([]);
    });
  });

  describe('validateUserAccess', () => {
    it('should return true when user has access', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: { hasAccess: true },
      });

      const result = await service.validateUserAccess(userId, orgId);

      expect(result).toBe(true);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'auth-service',
        'GET',
        `/users/${userId}/organizations/${orgId}/access`,
        undefined
      );
    });

    it('should return false when user does not have access', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: { hasAccess: false },
      });

      const result = await service.validateUserAccess(userId, orgId);

      expect(result).toBe(false);
    });

    it('should return false when service call fails', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'ACCESS_CHECK_FAILED',
          message: 'Failed to check access',
          timestamp: new Date(),
        },
      });

      const result = await service.validateUserAccess(userId, orgId);

      expect(result).toBe(false);
    });
  });

  describe('getUserPreferences', () => {
    it('should return user preferences when service call succeeds', async () => {
      const userId = 'user-123';
      const mockPreferences = {
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
      };

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: true,
        data: mockPreferences,
      });

      const result = await service.getUserPreferences(userId);

      expect(result).toEqual(mockPreferences);
      expect(mockServiceDiscovery.callService).toHaveBeenCalledWith(
        'auth-service',
        'GET',
        `/users/${userId}/preferences`,
        undefined
      );
    });

    it('should return null when service call fails', async () => {
      const userId = 'user-123';

      mockServiceDiscovery.callService.mockResolvedValueOnce({
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'User preferences not found',
          timestamp: new Date(),
        },
      });

      const result = await service.getUserPreferences(userId);

      expect(result).toBeNull();
    });
  });
});
