import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../shared/decorators/roles.decorator';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import type { PolicyContext } from './interfaces/policy-engine.interface';
import { PolicyEngineService } from './policy-engine.service';
import type { PolicyEvaluationParameters, TemplateParameters } from '../shared/types';
import { PolicyTemplateService } from './policy-template.service';

@Controller('api/v1/policy-engine')
@UseGuards(KongAuthGuard, RolesGuard)
export class PolicyEngineController {
  constructor(
    private readonly policyEngine: PolicyEngineService,
    private readonly templateService: PolicyTemplateService,
  ) {}

  // Policy Evaluation Endpoints
  @Post('evaluate/:policyId')
  @Roles('admin', 'compliance_manager', 'auditor')
  async evaluatePolicy(
    @Param('policyId') policyId: string,
    @Body() context: PolicyContext,
  ) {
    return this.policyEngine.evaluatePolicy(policyId, context);
  }

  @Post('evaluate-set/:policySetId')
  @Roles('admin', 'compliance_manager', 'auditor')
  async evaluatePolicySet(
    @Param('policySetId') policySetId: string,
    @Body() context: PolicyContext,
  ) {
    return this.policyEngine.evaluatePolicySet(policySetId, context);
  }

  @Post('validate')
  @Roles('admin', 'compliance_manager', 'policy_author')
  async validatePolicy(@Body() { code }: { code: string }) {
    const isValid = await this.policyEngine.validatePolicy(code);
    return { 
      valid: isValid,
      message: isValid ? 'Policy is valid' : 'Policy validation failed',
    };
  }

  @Post('compile')
  @Roles('admin', 'compliance_manager', 'policy_author')
  async compilePolicy(@Body() { code }: { code: string }) {
    try {
      const rule = await this.policyEngine.compilePolicy(code);
      return {
        success: true,
        rule,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Template Endpoints
  @Get('templates')
  @Roles('admin', 'compliance_manager', 'policy_author', 'viewer')
  getTemplates() {
    return this.templateService.getTemplates();
  }

  @Get('templates/categories')
  @Roles('admin', 'compliance_manager', 'policy_author', 'viewer')
  getTemplateCategories() {
    return this.templateService.getCategories();
  }

  @Get('templates/frameworks')
  @Roles('admin', 'compliance_manager', 'policy_author', 'viewer')
  getTemplateFrameworks() {
    return this.templateService.getFrameworks();
  }

  @Get('templates/search')
  @Roles('admin', 'compliance_manager', 'policy_author', 'viewer')
  searchTemplates(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('framework') framework?: string,
  ) {
    return this.templateService.searchTemplates({
      keyword,
      category,
      framework,
    });
  }

  @Get('templates/:id')
  @Roles('admin', 'compliance_manager', 'policy_author', 'viewer')
  getTemplate(@Param('id') id: string) {
    const template = this.templateService.getTemplate(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }
    return template;
  }

  @Post('templates/:id/validate')
  @Roles('admin', 'compliance_manager', 'policy_author')
  async validateTemplate(@Param('id') id: string) {
    return this.templateService.validateTemplate(id);
  }

  @Post('templates/:id/create-policy')
  @Roles('admin', 'compliance_manager', 'policy_author')
  async createPolicyFromTemplate(
    @Param('id') templateId: string,
    @Body() customizations: {
      name?: string;
      description?: string;
      parameters?: PolicyEvaluationParameters;
      organizationId: string;
    },
    @Request() req: any,
  ) {
    // Transform parameters to match TemplateParameters type
    const transformedCustomizations = {
      ...customizations,
      parameters: customizations.parameters ? 
        Object.entries(customizations.parameters).reduce((acc, [key, value]) => {
          // Only include primitive types that match TemplateParameters
          if (value === null || 
              typeof value === 'string' || 
              typeof value === 'number' || 
              typeof value === 'boolean' ||
              value instanceof Date) {
            acc[key] = value as string | number | boolean | Date | null;
          }
          return acc;
        }, {} as TemplateParameters) : undefined,
      createdBy: req.user.id,
    };
    
    return this.templateService.createPolicyFromTemplate(templateId, transformedCustomizations);
  }

  // Cache Management
  @Post('cache/invalidate')
  @Roles('admin')
  async invalidateCache(@Body() { policyId }: { policyId?: string }) {
    await this.policyEngine.invalidateCache(policyId);
    return { message: 'Cache invalidated successfully' };
  }
}

