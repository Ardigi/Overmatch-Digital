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
import type { EvidenceService } from '../evidence/evidence.service';
import type { EvidenceValidationService } from './evidence-validation.service';

@Controller('api/v1/validation')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class ValidationController {
  constructor(
    private readonly validationService: EvidenceValidationService,
    private readonly evidenceService: EvidenceService,
  ) {}

  @Get('rules')
  @Roles('admin', 'auditor', 'compliance_manager', 'viewer')
  async getValidationRules() {
    return this.validationService.getValidationRules();
  }

  @Get('rules/:id')
  @Roles('admin', 'auditor', 'compliance_manager', 'viewer')
  async getValidationRule(@Param('id') id: string) {
    const rule = this.validationService.getValidationRule(id);
    if (!rule) {
      throw new Error(`Validation rule ${id} not found`);
    }
    return rule;
  }

  @Post('evidence/:id')
  @Roles('admin', 'auditor', 'compliance_manager')
  async validateEvidence(@Param('id') id: string) {
    const evidence = await this.evidenceService.findOne(id);
    const score = await this.validationService.validateEvidence(evidence);
    return score;
  }

  @Post('evidence/bulk')
  @Roles('admin', 'auditor', 'compliance_manager')
  async validateMultipleEvidence(@Body() evidenceIds: string[]) {
    const evidenceList = await Promise.all(
      evidenceIds.map(id => this.evidenceService.findOne(id))
    );
    
    const scores = await this.validationService.validateMultipleEvidence(evidenceList);
    
    // Convert Map to object for JSON response
    const response: Record<string, any> = {};
    scores.forEach((value, key) => {
      response[key] = value;
    });
    
    return response;
  }
}