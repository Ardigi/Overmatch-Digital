import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@soc-compliance/cache-common';
import { firstValueFrom } from 'rxjs';

export interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  organizationId?: string;
  phone?: string;
  preferences?: UserPreferences;
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  channels?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    inApp?: boolean;
    slack?: boolean;
    teams?: boolean;
  };
  doNotDisturb?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  };
  digest?: {
    enabled?: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    time?: string;
  };
  categories?: Record<string, boolean>;
  enableSmsAlerts?: boolean;
  phone?: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  supportEmail?: string;
  notifyAdminsOnNewUser?: boolean;
  defaultNotificationSettings?: Record<string, any>;
  complianceFrameworks?: string[];
  timezone?: string;
}

export interface TeamData {
  id: string;
  name: string;
  organizationId: string;
  memberCount: number;
}

@Injectable()
export class UserDataService {
  private readonly logger = new Logger(UserDataService.name);
  private readonly authServiceUrl: string;
  private readonly clientServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.authServiceUrl = this.configService.get('services.auth.url') || 'http://127.0.0.1:3001';
    this.clientServiceUrl = this.configService.get('services.client.url') || 'http://127.0.0.1:3002';
  }

  async getUserById(userId: string): Promise<UserData | null> {
    const cacheKey = `user:data:${userId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/api/users/${userId}`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const userData = response.data;
      
      // Cache for 1 hour
      await this.cacheService.set(cacheKey, JSON.stringify(userData), { ttl: 3600 });
      
      return userData;
    } catch (error) {
      this.logger.error(`Failed to fetch user ${userId}: ${error.message}`);
      return null;
    }
  }

  async getUsersByIds(userIds: string[]): Promise<UserData[]> {
    const users = await Promise.all(
      userIds.map(id => this.getUserById(id))
    );
    
    return users.filter(Boolean) as UserData[];
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const cacheKey = `user:prefs:${userId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/api/users/${userId}/preferences`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const preferences = response.data;
      
      // Cache for 2 hours
      await this.cacheService.set(cacheKey, JSON.stringify(preferences), { ttl: 7200 });
      
      return preferences;
    } catch (error) {
      this.logger.error(`Failed to fetch preferences for user ${userId}: ${error.message}`);
      
      // Return default preferences
      return {
        channels: {
          email: true,
          sms: false,
          push: true,
          inApp: true,
          slack: false,
          teams: false,
        },
        doNotDisturb: {
          enabled: false,
        },
        digest: {
          enabled: false,
          frequency: 'daily',
        },
      };
    }
  }

  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettings | null> {
    const cacheKey = `org:settings:${organizationId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.clientServiceUrl}/api/organizations/${organizationId}`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const settings = response.data;
      
      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(settings), { ttl: 1800 });
      
      return settings;
    } catch (error) {
      this.logger.error(`Failed to fetch organization ${organizationId}: ${error.message}`);
      return null;
    }
  }

  async getOrganizationAdmins(organizationId: string): Promise<UserData[]> {
    const cacheKey = `org:admins:${organizationId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/api/users`, {
          params: {
            organizationId,
            role: 'admin',
          },
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const admins = response.data.items || [];
      
      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(admins), { ttl: 1800 });
      
      return admins;
    } catch (error) {
      this.logger.error(`Failed to fetch admins for organization ${organizationId}: ${error.message}`);
      return [];
    }
  }

  async getUserTeams(userId: string): Promise<TeamData[]> {
    const cacheKey = `user:teams:${userId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/api/users/${userId}/teams`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const teams = response.data.items || [];
      
      // Cache for 1 hour
      await this.cacheService.set(cacheKey, JSON.stringify(teams), { ttl: 3600 });
      
      return teams;
    } catch (error) {
      this.logger.error(`Failed to fetch teams for user ${userId}: ${error.message}`);
      return [];
    }
  }

  async getTeamMembers(teamId: string): Promise<UserData[]> {
    const cacheKey = `team:members:${teamId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceUrl}/api/teams/${teamId}/members`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const members = response.data.items || [];
      
      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(members), { ttl: 1800 });
      
      return members;
    } catch (error) {
      this.logger.error(`Failed to fetch members for team ${teamId}: ${error.message}`);
      return [];
    }
  }

  async getOrganizationHierarchy(organizationId: string): Promise<any> {
    const cacheKey = `org:hierarchy:${organizationId}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.clientServiceUrl}/api/organizations/${organizationId}/hierarchy`, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const hierarchy = response.data;
      
      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(hierarchy), { ttl: 1800 });
      
      return hierarchy;
    } catch (error) {
      this.logger.error(`Failed to fetch hierarchy for organization ${organizationId}: ${error.message}`);
      return null;
    }
  }

  async validateNotificationPermissions(
    userId: string,
    context: { resource?: string; action?: string },
  ): Promise<boolean> {
    const cacheKey = `perm:${userId}:${context.resource || 'notification'}:${context.action || 'receive'}`;
    
    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached === 'true';
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.authServiceUrl}/api/permissions/check`, {
          userId,
          resource: context.resource || 'notification',
          action: context.action || 'receive',
        }, {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        })
      );

      const hasPermission = response.data.hasPermission;
      
      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, String(hasPermission), { ttl: 1800 });
      
      return hasPermission;
    } catch (error) {
      this.logger.error(`Failed to validate permissions for user ${userId}: ${error.message}`);
      // Default to allowing notifications if permission check fails
      return true;
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `user:data:${userId}`,
      `user:prefs:${userId}`,
      `user:teams:${userId}`,
      `perm:${userId}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }

  async invalidateOrganizationCache(organizationId: string): Promise<void> {
    const patterns = [
      `org:settings:${organizationId}`,
      `org:admins:${organizationId}`,
      `org:hierarchy:${organizationId}`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.deletePattern(pattern);
    }
  }

  async getEnrichedUserData(userId: string): Promise<any> {
    const [userData, preferences, teams] = await Promise.all([
      this.getUserById(userId),
      this.getUserPreferences(userId),
      this.getUserTeams(userId),
    ]);

    return {
      ...userData,
      preferences,
      teams,
      hasValidContactInfo: !!(userData?.email || userData?.phone),
    };
  }
}