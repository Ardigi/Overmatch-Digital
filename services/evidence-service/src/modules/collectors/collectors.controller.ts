import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { KongUser } from '../../shared/decorators/kong-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard, KongRolesGuard } from '../../shared/guards';
import type { CollectorConfig, CollectorType } from './base/collector.interface';
import type { CollectorManagerService } from './collector-manager.service';

@Controller('collectors')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class CollectorsController {
  constructor(
    private readonly collectorManager: CollectorManagerService,
  ) {}

  @Get()
  @Roles('admin', 'auditor', 'compliance_manager')
  async getCollectorStatus() {
    return this.collectorManager.getCollectorStatus();
  }

  @Get('metrics')
  @Roles('admin', 'auditor', 'compliance_manager')
  async getCollectorMetrics() {
    return this.collectorManager.getCollectorMetrics();
  }

  @Post(':type/configure')
  @Roles('admin', 'compliance_manager')
  async configureCollector(
    @Param('type') type: CollectorType,
    @Body() config: CollectorConfig,
  ) {
    await this.collectorManager.configureCollector(type, config);
    return { message: `${type} collector configured successfully` };
  }

  @Post(':type/test')
  @Roles('admin', 'compliance_manager')
  async testCollectorConnection(@Param('type') type: CollectorType) {
    const result = await this.collectorManager.testCollectorConnection(type);
    return { 
      type,
      connected: result,
      message: result ? 'Connection successful' : 'Connection failed',
    };
  }

  @Post(':type/run')
  @Roles('admin', 'compliance_manager', 'auditor')
  async runCollector(@Param('type') type: CollectorType) {
    const result = await this.collectorManager.runCollector(type);
    return result;
  }

  @Post('run-all')
  @Roles('admin', 'compliance_manager')
  async runAllCollectors() {
    const results = await this.collectorManager.runAllCollectors();
    
    // Convert Map to object for JSON response
    const response: Record<string, any> = {};
    results.forEach((value, key) => {
      response[key] = value;
    });
    
    return response;
  }
}