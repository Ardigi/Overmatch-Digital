import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ServiceApiKeysConfig } from '../config/service-api-keys.config';

/**
 * Guard for service-to-service authentication
 * Uses API keys or service JWT tokens for secure inter-service communication
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(ServiceAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService
  ) {
    // Initialize service API keys on startup
    ServiceApiKeysConfig.initialize();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for service authentication methods
    const apiKey = request.headers['x-service-api-key'];
    const serviceToken = request.headers['x-service-token'];
    const serviceName = request.headers['x-service-name'];

    if (!serviceName) {
      throw new UnauthorizedException('Service name is required for service authentication');
    }

    // Method 1: API Key Authentication
    if (apiKey) {
      return this.validateApiKey(serviceName, apiKey, request);
    }

    // Method 2: Service JWT Token
    if (serviceToken) {
      return await this.validateServiceToken(serviceName, serviceToken, request);
    }

    // No valid service authentication provided
    throw new UnauthorizedException(
      'Valid service authentication required (API key or service token)'
    );
  }

  private validateApiKey(serviceName: string, apiKey: string, request: any): boolean {
    const expectedApiKey = ServiceApiKeysConfig.getApiKey(serviceName);

    if (!expectedApiKey) {
      this.logger.warn(`No API key configured for service: ${serviceName}`);
      throw new UnauthorizedException('Service not registered');
    }

    if (!ServiceApiKeysConfig.validateApiKey(serviceName, apiKey)) {
      this.logger.warn(`Invalid API key for service: ${serviceName}`);
      throw new UnauthorizedException('Invalid service credentials');
    }

    // Warn if using default API key in non-development environment
    if (
      ServiceApiKeysConfig.isUsingDefault(serviceName) &&
      process.env.NODE_ENV !== 'development'
    ) {
      this.logger.warn(
        `Service ${serviceName} is using default API key in ${process.env.NODE_ENV} environment!`
      );
    }

    // Set service context on request
    request.service = {
      name: serviceName,
      authenticatedAt: new Date(),
      authMethod: 'api-key',
    };

    this.logger.debug(`Service authenticated via API key: ${serviceName}`);
    return true;
  }

  private async validateServiceToken(
    serviceName: string,
    token: string,
    request: any
  ): Promise<boolean> {
    try {
      // Verify the JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: ServiceApiKeysConfig.getServiceJwtSecret(),
      });

      // Validate token claims
      if (payload.type !== 'service' || payload.service !== serviceName) {
        throw new UnauthorizedException('Invalid service token claims');
      }

      // Check token expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new UnauthorizedException('Service token expired');
      }

      // Set service context on request
      request.service = {
        name: serviceName,
        authenticatedAt: new Date(),
        authMethod: 'jwt-token',
        tokenId: payload.jti,
      };

      this.logger.debug(`Service authenticated via JWT: ${serviceName}`);
      return true;
    } catch (error) {
      this.logger.error(`Service token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid service token');
    }
  }
}
