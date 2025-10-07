import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  PermissionGuard,
  RateLimit,
  RequirePermissions,
  Roles,
  RolesGuard,
} from '../shared-auth';
import type { ApiKeysService } from './api-keys.service';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';
import type { RevokeApiKeyDto } from './dto/revoke-api-key.dto';
import type { UpdateApiKeyDto } from './dto/update-api-key.dto';

@Controller('api/v1/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequirePermissions('api-keys:create')
  @RateLimit({ points: 10, duration: 3600 }) // 10 API keys per hour
  async create(@Body() createApiKeyDto: CreateApiKeyDto, @Request() req) {
    const { apiKey, plainKey } = await this.apiKeysService.create(
      createApiKeyDto,
      req.user.id,
      req.user.organizationId,
    );

    // Return the plain key only once during creation
    return {
      apiKey,
      plainKey,
      warning: 'Please save this API key securely. You will not be able to see it again.',
    };
  }

  @Get()
  @RequirePermissions('api-keys:read')
  async findAll(@Request() req, @Query('includeOrganization') includeOrganization?: boolean) {
    if (includeOrganization && req.user.organizationId) {
      return this.apiKeysService.findAll(null, req.user.organizationId);
    }
    return this.apiKeysService.findAll(req.user.id);
  }

  @Get(':id')
  @RequirePermissions('api-keys:read')
  async findOne(@Param('id') id: string) {
    return this.apiKeysService.findOne(id);
  }

  @Get(':id/usage')
  @RequirePermissions('api-keys:read')
  async getUsage(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.apiKeysService.getUsageStats(id, start, end);
  }

  @Patch(':id')
  @RequirePermissions('api-keys:update')
  async update(
    @Param('id') id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
    @Request() req,
  ) {
    return this.apiKeysService.update(id, updateApiKeyDto, req.user.id);
  }

  @Post(':id/rotate')
  @RequirePermissions('api-keys:create', 'api-keys:delete')
  @RateLimit({ points: 5, duration: 3600 }) // 5 rotations per hour
  async rotate(@Param('id') id: string, @Request() req) {
    const { apiKey, plainKey } = await this.apiKeysService.rotate(id, req.user.id);

    return {
      apiKey,
      plainKey,
      warning: 'Please save this new API key securely. The old key has been revoked.',
    };
  }

  @Delete(':id')
  @RequirePermissions('api-keys:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('id') id: string,
    @Body() revokeApiKeyDto: RevokeApiKeyDto,
    @Request() req,
  ) {
    await this.apiKeysService.revoke(id, req.user.id, revokeApiKeyDto.reason);
  }

  @Post('validate')
  @RequirePermissions('api-keys:validate')
  @HttpCode(HttpStatus.OK)
  async validate(@Body('apiKey') apiKey: string, @Request() req) {
    const validKey = await this.apiKeysService.validateApiKey(apiKey, req.ip);
    return {
      valid: true,
      scopes: validKey.scopes,
      permissions: validKey.permissions,
    };
  }
}