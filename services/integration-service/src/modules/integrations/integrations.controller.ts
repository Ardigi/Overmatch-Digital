import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import type { CreateCredentialDto, RotateCredentialDto } from './dto/create-credential.dto';
import type { CreateIntegrationDto } from './dto/create-integration.dto';
import type { FilterLogsDto } from './dto/filter-logs.dto';
import type { UpdateIntegrationDto } from './dto/update-integration.dto';
import { AuthType, type Integration, IntegrationStatus, IntegrationType } from './entities/integration.entity';
import { CredentialType, type IntegrationCredential } from './entities/integration-credential.entity';
import type { ConnectorFactory } from './services/connector.factory';
import type { CredentialService } from './services/credential.service';
import type { HealthCheckService } from './services/health-check.service';
import type { IntegrationService } from './services/integration.service';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly credentialService: CredentialService,
    private readonly connectorFactory: ConnectorFactory,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all integrations' })
  @ApiQuery({ name: 'status', enum: IntegrationStatus, required: false })
  @ApiQuery({ name: 'type', enum: IntegrationType, required: false })
  @ApiQuery({ name: 'isHealthy', type: Boolean, required: false })
  @ApiQuery({ name: 'tags', type: String, required: false })
  async listIntegrations(
    @Req() req: any,
    @Query('status') status?: IntegrationStatus,
    @Query('type') type?: IntegrationType,
    @Query('isHealthy') isHealthy?: boolean,
    @Query('tags') tags?: string,
  ): Promise<Integration[]> {
    const filters = {
      status,
      type,
      isHealthy,
      tags: tags ? tags.split(',') : undefined,
    };

    return this.integrationService.findAll(req.user.organizationId, filters);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get supported integration types' })
  async getIntegrationTypes(): Promise<{
    types: IntegrationType[];
    authTypes: AuthType[];
    connectors: string[];
  }> {
    return {
      types: Object.values(IntegrationType),
      authTypes: Object.values(AuthType),
      connectors: this.connectorFactory.getSupportedTypes(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<Integration> {
    return this.integrationService.findOne(id, req.user.organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  async createIntegration(
    @Body() dto: CreateIntegrationDto,
    @Req() req: any,
  ): Promise<Integration> {
    return this.integrationService.create({
      ...dto,
      organizationId: req.user.organizationId,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an integration' })
  async updateIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIntegrationDto,
    @Req() req: any,
  ): Promise<Integration> {
    return this.integrationService.update(id, req.user.organizationId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integration' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<void> {
    await this.integrationService.delete(id, req.user.organizationId);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate an integration' })
  async activateIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<Integration> {
    return this.integrationService.activate(id, req.user.organizationId);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an integration' })
  async deactivateIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<Integration> {
    return this.integrationService.deactivate(id, req.user.organizationId);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<any> {
    return this.integrationService.testConnection(id, req.user.organizationId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get integration statistics' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<any> {
    return this.integrationService.getStats(id, req.user.organizationId);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get integration logs' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'logLevel', required: false })
  @ApiQuery({ name: 'operationType', required: false })
  @ApiQuery({ name: 'success', type: Boolean, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('logLevel') logLevel?: any,
    @Query('operationType') operationType?: any,
    @Query('success') success?: boolean,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    const filters: FilterLogsDto = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      logLevel,
      operationType,
      success,
      limit,
    };

    return this.integrationService.getLogs(id, req.user.organizationId, filters);
  }

  @Get(':id/health-history')
  @ApiOperation({ summary: 'Get health check history' })
  async getHealthHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<any[]> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.healthCheckService.getHealthHistory(id);
  }

  // Credential Management
  @Get(':id/credentials')
  @ApiOperation({ summary: 'List credentials for an integration' })
  async listCredentials(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<IntegrationCredential[]> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.credentialService.findAll(id);
  }

  @Post(':id/credentials')
  @ApiOperation({ summary: 'Create a new credential' })
  async createCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCredentialDto,
    @Req() req: any,
  ): Promise<IntegrationCredential> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.credentialService.create({
      ...dto,
      integrationId: id,
    });
  }

  @Put(':id/credentials/:credentialId')
  @ApiOperation({ summary: 'Update a credential' })
  async updateCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Body() dto: Partial<CreateCredentialDto>,
    @Req() req: any,
  ): Promise<IntegrationCredential> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.credentialService.update(credentialId, dto as any);
  }

  @Delete(':id/credentials/:credentialId')
  @ApiOperation({ summary: 'Delete a credential' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Req() req: any,
  ): Promise<void> {
    await this.integrationService.findOne(id, req.user.organizationId);
    await this.credentialService.delete(credentialId);
  }

  @Post(':id/credentials/:credentialId/rotate')
  @ApiOperation({ summary: 'Rotate a credential' })
  async rotateCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Body() dto: RotateCredentialDto,
    @Req() req: any,
  ): Promise<IntegrationCredential> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.credentialService.rotateCredential(
      credentialId,
      dto.value,
      (dto as any).secret,
    );
  }

  @Post(':id/credentials/:credentialId/refresh')
  @ApiOperation({ summary: 'Refresh OAuth2 token' })
  async refreshOAuth2Token(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('credentialId', ParseUUIDPipe) credentialId: string,
    @Req() req: any,
  ): Promise<IntegrationCredential> {
    await this.integrationService.findOne(id, req.user.organizationId);
    return this.credentialService.refreshOAuth2Token(credentialId);
  }

  // OAuth2 Flow
  @Get(':id/oauth2/authorize')
  @ApiOperation({ summary: 'Get OAuth2 authorization URL' })
  @ApiQuery({ name: 'redirectUri', required: true })
  @ApiQuery({ name: 'state', required: true })
  async getOAuth2AuthorizeUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('redirectUri') redirectUri: string,
    @Query('state') state: string,
    @Req() req: any,
  ): Promise<{ url: string }> {
    const integration = await this.integrationService.findOne(id, req.user.organizationId);
    
    if (integration.authType !== AuthType.OAUTH2) {
      throw new BadRequestException('Integration does not use OAuth2');
    }

    const connector = await this.connectorFactory.createConnector(integration);
    const url = (connector as any).getAuthorizationUrl(state, redirectUri);

    return { url };
  }

  @Post(':id/oauth2/callback')
  @ApiOperation({ summary: 'Handle OAuth2 callback' })
  async handleOAuth2Callback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { code: string; redirectUri: string },
    @Req() req: any,
  ): Promise<IntegrationCredential> {
    const integration = await this.integrationService.findOne(id, req.user.organizationId);
    
    if (integration.authType !== AuthType.OAUTH2) {
      throw new BadRequestException('Integration does not use OAuth2');
    }

    const connector = await this.connectorFactory.createConnector(integration);
    const tokenData = await (connector as any).exchangeCodeForToken(dto.code, dto.redirectUri);

    // Check if credential already exists
    const credential = await this.credentialService.getActiveCredential(id);
    
    if (credential) {
      // Update existing credential
      this.credentialService.updateTokens(
        credential,
        tokenData.accessToken,
        tokenData.refreshToken,
        tokenData.expiresIn,
      );
      return this.credentialService.update(credential.id, {});
    } else {
      // Create new credential
      return this.credentialService.create({
        integrationId: id,
        name: 'OAuth2 Token',
        credentialType: CredentialType.TOKEN,
        value: tokenData.accessToken,
        oauth2Config: integration.configuration.oauth2Config as any,
      });
    }
  }

  // Configuration Management
  @Get(':id/configuration')
  @ApiOperation({ summary: 'Get integration configuration' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Integration configuration retrieved successfully' 
  })
  async getConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<any> {
    const integration = await this.integrationService.findOne(id, req.user.organizationId);
    
    // Return configuration with sensitive data masked
    const configuration = { ...integration.configuration };
    
    // Mask sensitive fields
    if (configuration.apiKey) {
      configuration.apiKey = '***' + configuration.apiKey.slice(-4);
    }
    if (configuration.oauth2Config?.clientSecret) {
      configuration.oauth2Config.clientSecret = '***';
    }
    if (configuration.webhookSecret) {
      configuration.webhookSecret = '***';
    }
    
    return {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      authType: integration.authType,
      configuration,
      metadata: integration.metadata,
      tags: integration.tags,
    };
  }

  @Put(':id/configuration')
  @ApiOperation({ summary: 'Update integration configuration' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Integration configuration updated successfully' 
  })
  async updateConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() configurationData: any,
    @Req() req: any,
  ): Promise<Integration> {
    const integration = await this.integrationService.findOne(id, req.user.organizationId);
    
    // Validate configuration based on integration type
    if (integration.type === IntegrationType.CRM && !configurationData.crmUrl) {
      throw new BadRequestException('CRM URL is required for CRM integrations');
    }
    
    if (integration.type === IntegrationType.TICKETING && !configurationData.ticketingUrl) {
      throw new BadRequestException('Ticketing URL is required for ticketing integrations');
    }
    
    // Update configuration
    const updatedIntegration = await this.integrationService.update(
      id,
      req.user.organizationId,
      {
        configuration: {
          ...integration.configuration,
          ...configurationData,
        },
      }
    );
    
    // Test connection with new configuration
    try {
      await this.integrationService.testConnection(id, req.user.organizationId);
    } catch (error) {
      // Log warning but don't fail the update
      console.warn(`Configuration updated but connection test failed: ${error.message}`);
    }
    
    return updatedIntegration;
  }

  @Post(':id/configuration/validate')
  @ApiOperation({ summary: 'Validate integration configuration' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Configuration validation result' 
  })
  async validateConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() configurationData: any,
    @Req() req: any,
  ): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
    const integration = await this.integrationService.findOne(id, req.user.organizationId);
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Common validation
    if (integration.authType === AuthType.API_KEY && !configurationData.apiKey) {
      errors.push('API key is required for API key authentication');
    }
    
    if (integration.authType === AuthType.OAUTH2) {
      if (!configurationData.oauth2Config?.clientId) {
        errors.push('OAuth2 client ID is required');
      }
      if (!configurationData.oauth2Config?.clientSecret) {
        errors.push('OAuth2 client secret is required');
      }
      if (!configurationData.oauth2Config?.authorizationUrl) {
        errors.push('OAuth2 authorization URL is required');
      }
      if (!configurationData.oauth2Config?.tokenUrl) {
        errors.push('OAuth2 token URL is required');
      }
    }
    
    // Type-specific validation
    switch (integration.type) {
      case IntegrationType.CRM:
        if (!configurationData.crmUrl) {
          errors.push('CRM URL is required');
        }
        if (!configurationData.syncInterval) {
          warnings.push('Sync interval not specified, using default');
        }
        break;
        
      case IntegrationType.TICKETING:
        if (!configurationData.ticketingUrl) {
          errors.push('Ticketing system URL is required');
        }
        if (!configurationData.projectKey) {
          warnings.push('Project key not specified');
        }
        break;
        
      case IntegrationType.MONITORING:
        if (!configurationData.monitoringUrl) {
          errors.push('Monitoring endpoint URL is required');
        }
        if (!configurationData.alertThreshold) {
          warnings.push('Alert threshold not configured');
        }
        break;
        
      case IntegrationType.NOTIFICATION:
        if (!configurationData.webhookUrl && !configurationData.emailConfig) {
          errors.push('Either webhook URL or email configuration is required');
        }
        break;
        
      case IntegrationType.LOGGING:
        if (!configurationData.loggingEndpoint) {
          errors.push('Logging endpoint is required');
        }
        if (!configurationData.logLevel) {
          warnings.push('Log level not specified, defaulting to INFO');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}