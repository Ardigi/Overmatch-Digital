import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';

export interface AuthenticationConfig {
  type: 'none' | 'api-key' | 'bearer' | 'oauth2' | 'jwt' | 'basic';
  credentials?: {
    apiKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    privateKey?: string;
    tokenUrl?: string;
    scope?: string[];
  };
  headerName?: string;
  paramName?: string;
}

export interface ApiEndpointConfig {
  baseUrl: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    retryDelay: number;
  };
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: Date;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

@Injectable()
export class ApiConnectorService {
  private readonly logger = new Logger(ApiConnectorService.name);
  private readonly axiosInstances = new Map<string, AxiosInstance>();
  private readonly rateLimits = new Map<string, RateLimitInfo>();
  private readonly tokenCache = new Map<string, { token: string; expiresAt: Date }>();

  constructor(private configService: ConfigService) {}

  async sendEvent(
    endpoint: string,
    data: any,
    auth: AuthenticationConfig,
  ): Promise<ApiResponse> {
    const config = await this.prepareRequestConfig(endpoint, auth);
    
    try {
      const response = await this.executeRequest({
        ...config,
        url: endpoint,
        method: 'POST',
        data,
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as any,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to send event to ${endpoint}`, error);
      throw error;
    }
  }

  async fetchData(
    config: ApiEndpointConfig,
    auth: AuthenticationConfig,
  ): Promise<ApiResponse> {
    const url = this.buildUrl(config);
    const requestConfig = await this.prepareRequestConfig(url, auth);

    // Check rate limits
    await this.checkRateLimit(config.baseUrl);

    try {
      const response = await this.executeRequest({
        ...requestConfig,
        url,
        method: config.method || 'GET',
        params: config.queryParams,
        headers: {
          ...requestConfig.headers,
          ...config.headers,
        },
        timeout: config.timeout || 30000,
      });

      // Update rate limit info
      this.updateRateLimit(config.baseUrl, response.headers);

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as any,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch data from ${url}`, error);
      throw error;
    }
  }

  private async prepareRequestConfig(
    url: string,
    auth: AuthenticationConfig,
  ): Promise<AxiosRequestConfig> {
    const config: AxiosRequestConfig = {
      headers: {},
    };

    switch (auth.type) {
      case 'api-key':
        if (auth.headerName) {
          config.headers![auth.headerName] = auth.credentials?.apiKey;
        } else if (auth.paramName) {
          config.params = { [auth.paramName]: auth.credentials?.apiKey };
        } else {
          config.headers!['X-API-Key'] = auth.credentials?.apiKey;
        }
        break;

      case 'bearer':
        config.headers!['Authorization'] = `Bearer ${auth.credentials?.token}`;
        break;

      case 'oauth2':
        const token = await this.getOAuth2Token(auth);
        config.headers!['Authorization'] = `Bearer ${token}`;
        break;

      case 'jwt':
        const jwtToken = await this.generateJWT(auth);
        config.headers!['Authorization'] = `Bearer ${jwtToken}`;
        break;

      case 'basic':
        const basicAuth = Buffer.from(
          `${auth.credentials?.username}:${auth.credentials?.password}`
        ).toString('base64');
        config.headers!['Authorization'] = `Basic ${basicAuth}`;
        break;
    }

    return config;
  }

  private async getOAuth2Token(auth: AuthenticationConfig): Promise<string> {
    const cacheKey = `${auth.credentials?.clientId}_${auth.credentials?.scope?.join(',')}`;
    const cached = this.tokenCache.get(cacheKey);

    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }

    try {
      const response = await axios.post(
        auth.credentials?.tokenUrl!,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: auth.credentials?.clientId!,
          client_secret: auth.credentials?.clientSecret!,
          scope: auth.credentials?.scope?.join(' ') || '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;

      this.tokenCache.set(cacheKey, {
        token,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      });

      return token;
    } catch (error) {
      this.logger.error('Failed to get OAuth2 token', error);
      throw error;
    }
  }

  private async generateJWT(auth: AuthenticationConfig): Promise<string> {
    const payload = {
      iss: auth.credentials?.clientId,
      sub: auth.credentials?.clientId,
      aud: auth.credentials?.tokenUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    return jwt.sign(payload, auth.credentials?.privateKey!, {
      algorithm: 'RS256',
    });
  }

  private buildUrl(config: ApiEndpointConfig): string {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const path = config.path?.replace(/^\//, '') || '';
    return path ? `${baseUrl}/${path}` : baseUrl;
  }

  private async executeRequest(
    config: AxiosRequestConfig,
    retryCount = 0,
  ): Promise<AxiosResponse> {
    try {
      const instance = this.getAxiosInstance(config.url!);
      return await instance.request(config);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle rate limiting
        if (error.response?.status === 429 && retryCount < 3) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.executeRequest(config, retryCount + 1);
        }

        // Handle temporary errors with retry
        if (
          (error.response?.status === 503 || error.code === 'ECONNRESET') &&
          retryCount < 3
        ) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeRequest(config, retryCount + 1);
        }
      }
      throw error;
    }
  }

  private getAxiosInstance(url: string): AxiosInstance {
    const baseURL = new URL(url).origin;
    
    if (!this.axiosInstances.has(baseURL)) {
      const instance = axios.create({
        baseURL,
        timeout: 30000,
        headers: {
          'User-Agent': 'SOC-Compliance-Integration-Service/1.0',
        },
      });

      // Add request interceptor for logging
      instance.interceptors.request.use(
        (config) => {
          this.logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          this.logger.error('Request interceptor error', error);
          return Promise.reject(error);
        }
      );

      // Add response interceptor for logging
      instance.interceptors.response.use(
        (response) => {
          this.logger.debug(`API Response: ${response.status} from ${response.config.url}`);
          return response;
        },
        (error) => {
          if (error.response) {
            this.logger.error(
              `API Error: ${error.response.status} from ${error.config?.url}`,
              error.response.data
            );
          }
          return Promise.reject(error);
        }
      );

      this.axiosInstances.set(baseURL, instance);
    }

    return this.axiosInstances.get(baseURL)!;
  }

  private async checkRateLimit(baseUrl: string): Promise<void> {
    const rateLimit = this.rateLimits.get(baseUrl);
    
    if (rateLimit && rateLimit.remaining === 0) {
      const waitTime = rateLimit.resetAt.getTime() - Date.now();
      
      if (waitTime > 0) {
        this.logger.warn(`Rate limit reached for ${baseUrl}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private updateRateLimit(baseUrl: string, headers: any): void {
    const limit = parseInt(headers['x-ratelimit-limit'] || headers['x-rate-limit-limit']);
    const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining']);
    const reset = parseInt(headers['x-ratelimit-reset'] || headers['x-rate-limit-reset']);

    if (limit && remaining !== undefined && reset) {
      this.rateLimits.set(baseUrl, {
        limit,
        remaining,
        resetAt: new Date(reset * 1000),
      });
    }
  }

  async testConnection(
    config: ApiEndpointConfig,
    auth: AuthenticationConfig,
  ): Promise<boolean> {
    try {
      const response = await this.fetchData(
        {
          ...config,
          method: 'GET',
          timeout: 5000,
        },
        auth
      );

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return false;
    }
  }

  getRateLimitInfo(baseUrl: string): RateLimitInfo | undefined {
    return this.rateLimits.get(baseUrl);
  }

  clearTokenCache(): void {
    this.tokenCache.clear();
  }
}