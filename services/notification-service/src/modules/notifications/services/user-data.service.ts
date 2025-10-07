import { Injectable, Logger } from '@nestjs/common';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';

export interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  organizationId: string;
}

export interface OrganizationData {
  id: string;
  name: string;
  domain?: string;
  settings?: {
    notifications?: {
      enabled: boolean;
      channels: string[];
    };
  };
}

@Injectable()
export class UserDataService {
  private readonly logger = new Logger(UserDataService.name);

  constructor(private readonly serviceDiscovery: ServiceDiscoveryService) {}

  async getUserById(userId: string): Promise<UserData | null> {
    try {
      this.logger.debug(`Fetching user data for ID: ${userId}`);

      const response = await this.serviceDiscovery.callService<UserData>(
        'auth-service',
        'GET',
        `/users/${userId}`,
        undefined
      );

      if (response.success && response.data) {
        this.logger.debug(`Successfully fetched user data for ID: ${userId}`);
        return response.data;
      } else {
        this.logger.warn(`Failed to fetch user data for ID: ${userId}`, response.error);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error fetching user data for ID: ${userId}`, error);
      return null;
    }
  }

  async getUsersByIds(userIds: string[]): Promise<UserData[]> {
    try {
      this.logger.debug(`Fetching user data for IDs: ${userIds.join(', ')}`);

      const response = await this.serviceDiscovery.callService<UserData[]>(
        'auth-service',
        'POST',
        '/users/batch',
        { userIds }
      );

      if (response.success && response.data) {
        this.logger.debug(`Successfully fetched user data for ${response.data.length} users`);
        return response.data;
      } else {
        this.logger.warn('Failed to fetch batch user data', response.error);
        return [];
      }
    } catch (error) {
      this.logger.error('Error fetching batch user data', error);
      return [];
    }
  }

  async getOrganizationById(organizationId: string): Promise<OrganizationData | null> {
    try {
      this.logger.debug(`Fetching organization data for ID: ${organizationId}`);

      const response = await this.serviceDiscovery.callService<OrganizationData>(
        'client-service',
        'GET',
        `/organizations/${organizationId}`,
        undefined
      );

      if (response.success && response.data) {
        this.logger.debug(`Successfully fetched organization data for ID: ${organizationId}`);
        return response.data;
      } else {
        this.logger.warn(
          `Failed to fetch organization data for ID: ${organizationId}`,
          response.error
        );
        return null;
      }
    } catch (error) {
      this.logger.error(`Error fetching organization data for ID: ${organizationId}`, error);
      return null;
    }
  }

  async getUsersByOrganization(organizationId: string): Promise<UserData[]> {
    try {
      this.logger.debug(`Fetching users for organization ID: ${organizationId}`);

      const response = await this.serviceDiscovery.callService<UserData[]>(
        'auth-service',
        'GET',
        `/organizations/${organizationId}/users`,
        undefined
      );

      if (response.success && response.data) {
        this.logger.debug(
          `Successfully fetched ${response.data.length} users for organization: ${organizationId}`
        );
        return response.data;
      } else {
        this.logger.warn(
          `Failed to fetch users for organization: ${organizationId}`,
          response.error
        );
        return [];
      }
    } catch (error) {
      this.logger.error(`Error fetching users for organization: ${organizationId}`, error);
      return [];
    }
  }

  async getUserPreferences(userId: string): Promise<any> {
    try {
      this.logger.debug(`Fetching user preferences for ID: ${userId}`);

      const response = await this.serviceDiscovery.callService<any>(
        'auth-service',
        'GET',
        `/users/${userId}/preferences`,
        undefined
      );

      if (response.success && response.data) {
        this.logger.debug(`Successfully fetched preferences for user: ${userId}`);
        return response.data;
      } else {
        this.logger.warn(`Failed to fetch preferences for user: ${userId}`, response.error);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error fetching preferences for user: ${userId}`, error);
      return null;
    }
  }

  async validateUserAccess(userId: string, organizationId: string): Promise<boolean> {
    try {
      this.logger.debug(`Validating user access: ${userId} in organization: ${organizationId}`);

      const response = await this.serviceDiscovery.callService<{ hasAccess: boolean }>(
        'auth-service',
        'GET',
        `/users/${userId}/organizations/${organizationId}/access`,
        undefined
      );

      if (response.success && response.data) {
        this.logger.debug(
          `Access validation result for user ${userId}: ${response.data.hasAccess}`
        );
        return response.data.hasAccess;
      } else {
        this.logger.warn(`Failed to validate access for user: ${userId}`, response.error);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error validating user access: ${userId}`, error);
      return false;
    }
  }
}
