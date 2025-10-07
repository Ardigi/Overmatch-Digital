import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { SanitizationPipe } from '../../shared/pipes/sanitization.pipe';
import { ApiKeysService, CreateApiKeyDto, UpdateApiKeyDto } from './api-keys.service';

interface UserContext {
  id: string;
  email: string;
  organizationId: string;
  roles: string[];
}

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(KongAuthGuard, RolesGuard, ThrottlerGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles('admin', 'api_key_manager')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  async create(
    @Body() createApiKeyDto: CreateApiKeyDto,
    @Req() req: Request & { user: UserContext },
  ) {
    // Validate scopes
    const validScopes = ['READ', 'WRITE', 'ADMIN'];
    const invalidScopes = createApiKeyDto.scopes.filter(
      scope => !validScopes.includes(scope) && !scope.startsWith('role:')
    );
    
    if (invalidScopes.length > 0) {
      throw new BadRequestException(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Only admins can create ADMIN scope keys
    if (createApiKeyDto.scopes.includes('ADMIN') && !req.user.roles.includes('admin')) {
      throw new BadRequestException('Only admins can create API keys with ADMIN scope');
    }

    const result = await this.apiKeysService.create(
      createApiKeyDto,
      req.user.id,
      req.user.organizationId,
    );

    // Return the key details with the plain text key (only time it's shown)
    return {
      message: 'API key created successfully. Save the key securely as it will not be shown again.',
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        prefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
        createdAt: result.apiKey.createdAt,
      },
      key: result.plainTextKey,
    };
  }

  @Get()
  @Roles('admin', 'api_key_manager', 'compliance_manager')
  @ApiOperation({ summary: 'List all API keys for the organization' })
  @ApiResponse({ status: 200, description: 'Returns list of API keys' })
  async findAll(
    @Req() req: Request & { user: UserContext },
  ) {
    const apiKeys = await this.apiKeysService.findAll(req.user.organizationId);
    
    // Remove sensitive data
    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      description: key.description,
      prefix: key.keyPrefix,
      status: key.status,
      scopes: key.scopes,
      allowedIps: key.allowedIps,
      rateLimit: key.rateLimit,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      createdAt: key.createdAt,
      createdBy: key.createdBy,
    }));
  }

  @Get(':id')
  @Roles('admin', 'api_key_manager')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, description: 'Returns API key details' })
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: UserContext },
  ) {
    const apiKey = await this.apiKeysService.findOne(id, req.user.organizationId);
    
    // Remove sensitive data
    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description,
      prefix: apiKey.keyPrefix,
      status: apiKey.status,
      scopes: apiKey.scopes,
      allowedIps: apiKey.allowedIps,
      rateLimit: apiKey.rateLimit,
      rateLimitWindow: apiKey.rateLimitWindow,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      lastUsedIp: apiKey.lastUsedIp,
      usageCount: apiKey.usageCount,
      createdAt: apiKey.createdAt,
      createdBy: apiKey.createdBy,
      revokedAt: apiKey.revokedAt,
      revokedBy: apiKey.revokedBy,
      revocationReason: apiKey.revocationReason,
    };
  }

  @Get(':id/usage')
  @Roles('admin', 'api_key_manager')
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Returns usage statistics' })
  async getUsageStats(
    @Param('id') id: string,
    @Req() req: Request & { user: UserContext },
  ) {
    return this.apiKeysService.getUsageStats(id, req.user.organizationId);
  }

  @Put(':id')
  @Roles('admin', 'api_key_manager')
  @ApiOperation({ summary: 'Update API key' })
  @ApiResponse({ status: 200, description: 'API key updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @Req() req: Request & { user: UserContext },
  ) {
    const updated = await this.apiKeysService.update(
      id,
      updateApiKeyDto,
      req.user.id,
      req.user.organizationId,
    );

    return {
      message: 'API key updated successfully',
      apiKey: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        scopes: updated.scopes,
        allowedIps: updated.allowedIps,
        rateLimit: updated.rateLimit,
      },
    };
  }

  @Post(':id/rotate')
  @Roles('admin', 'api_key_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate API key (create new, revoke old)' })
  @ApiResponse({ status: 200, description: 'API key rotated successfully' })
  async rotate(
    @Param('id') id: string,
    @Req() req: Request & { user: UserContext },
  ) {
    const result = await this.apiKeysService.rotate(
      id,
      req.user.id,
      req.user.organizationId,
    );

    return {
      message: 'API key rotated successfully. Save the new key securely.',
      oldKeyId: id,
      newApiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        prefix: result.apiKey.keyPrefix,
        scopes: result.apiKey.scopes,
        expiresAt: result.apiKey.expiresAt,
      },
      key: result.plainTextKey,
    };
  }

  @Delete(':id')
  @Roles('admin', 'api_key_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  async revoke(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: Request & { user: UserContext },
  ) {
    if (!reason) {
      throw new BadRequestException('Revocation reason is required');
    }

    await this.apiKeysService.revoke(
      id,
      req.user.id,
      req.user.organizationId,
      reason,
    );

    return {
      message: 'API key revoked successfully',
      revokedAt: new Date(),
    };
  }
}

