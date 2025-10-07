import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Traced, Metered, Observable } from '@soc-compliance/monitoring';
import { CurrentUser, CurrentUserData } from '@soc-compliance/auth-common';
import type { Response as ExpressResponse } from 'express';
import { PolicyOperationContext } from '../shared/types';
import { 
  Authorize, 
  AuthorizeApprove,
  AuthorizeCreate, 
  AuthorizeDelete,
  AuthorizePublish,
  AuthorizeRead, 
  AuthorizeUpdate, 
} from '../../shared/decorators/authorize.decorator';
import { RateLimit, RateLimitPresets } from '../../shared/decorators/rate-limit.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { AuthorizationGuard } from '../../shared/guards/authorization.guard';
import { KongAuthGuard } from '../../shared/guards/kong-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ResourceOwnershipInterceptor } from '../../shared/interceptors/resource-ownership.interceptor';
import { 
  PolicyContentSanitizationPipe, 
  SanitizationPipe 
} from '../../shared/pipes/sanitization.pipe';
import { Action, Resource } from '../../shared/services/authorization.service';
import type {
  BulkMapPolicyToControlsDto,
  BulkOperationDto,
  CreatePolicyDto,
  GetPoliciesByControlDto,
  MapPolicyToControlDto,
  PolicyEvaluationContextDto,
  PolicyFrameworkMappingDto,
  QueryPolicyDto,
  UnmapPolicyFromControlDto,
  UpdatePolicyControlMappingDto,
  UpdatePolicyDto,
  WorkflowTransitionDto,
} from './dto';
import { Policy, PolicyType } from './entities/policy.entity';
import { PoliciesService } from './policies.service';

@ApiTags('policies')
@Controller('policies')
@UseGuards(KongAuthGuard, RolesGuard, AuthorizationGuard, ThrottlerGuard)
@UseInterceptors(ResourceOwnershipInterceptor)
@ApiBearerAuth()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @AuthorizeCreate(Resource.POLICY)
  @RateLimit(RateLimitPresets.STANDARD)
  create(@Body() createPolicyDto: CreatePolicyDto, @Request() req) {
    return this.policiesService.create({
      ...createPolicyDto,
      createdBy: req.user.id,
    });
  }

  @Get()
  @Traced('policy-list-endpoint')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor', 'policy_viewer')
  @RateLimit(RateLimitPresets.RELAXED)
  findAll(@Query() query: QueryPolicyDto, @Request() req) {
    const user = {
      id: req.user.id,
      organizationId: req.user.organizationId,
      roles: req.user.roles.map(r => typeof r === 'string' ? r : r.name),
    };
    return this.policiesService.findAll(query, user);
  }

  @Get('expiring')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  getExpiringPolicies(@Query('daysAhead') daysAhead?: string) {
    const days = daysAhead ? parseInt(daysAhead) : 30;
    return this.policiesService.getExpiringPolicies(days);
  }

  @Get('needs-review')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  getPoliciesNeedingReview() {
    return this.policiesService.getPoliciesNeedingReview();
  }

  @Get(':id')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor', 'policy_viewer')
  @AuthorizeRead(Resource.POLICY, 'id')
  async findOne(@Param('id') id: string, @Request() req) {
    const policy = await this.policiesService.findOne(id);
    
    // Record view
    await this.policiesService.recordView(id, req.user.id);
    
    return policy;
  }

  @Get('by-number/:policyNumber')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor', 'policy_viewer')
  async findByPolicyNumber(@Param('policyNumber') policyNumber: string, @Request() req) {
    const policy = await this.policiesService.findByPolicyNumber(policyNumber);
    
    // Record view
    await this.policiesService.recordView(policy.id, req.user.id);
    
    return policy;
  }

  @Get(':id/download')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor', 'policy_viewer')
  @Header('Content-Type', 'application/pdf')
  async downloadPolicy(
    @Param('id') id: string,
    @Request() req,
    @Response() res: ExpressResponse,
  ) {
    const policy = await this.policiesService.findOne(id);
    
    // Record download
    await this.policiesService.recordDownload(id, req.user.id);
    
    // Here you would typically:
    // 1. Generate PDF from policy content
    // 2. Stream it to the response
    // For now, we'll return a placeholder response
    
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${policy.policyNumber}_${policy.title.replace(/\s+/g, '_')}.pdf"`,
    );
    
    // In real implementation, generate and stream PDF
    res.send('PDF content would be generated here');
  }

  @Patch(':id')
  @Observable({ spanName: 'policy-update-endpoint', metricName: 'policy_update_endpoint_duration_seconds' })
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @AuthorizeUpdate(Resource.POLICY, 'id')
  @UsePipes(new PolicyContentSanitizationPipe())
  update(
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
    @Request() req,
  ) {
    return this.policiesService.update(id, {
      ...updatePolicyDto,
      updatedBy: req.user.id,
    }, req.user.id);
  }

  @Post(':id/submit-for-review')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Submit policy for review' })
  submitForReview(@Param('id') id: string, @Request() req) {
    return this.policiesService.submitForReview(id, req.user.id);
  }

  @Post(':id/approve')
  @Observable({ spanName: 'policy-approve-endpoint', metricName: 'policy_approve_endpoint_duration_seconds' })
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @AuthorizeApprove(Resource.POLICY, 'id')
  approve(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @Request() req,
  ) {
    return this.policiesService.approve(id, req.user.id, comments);
  }

  @Post(':id/publish')
  @Observable({ spanName: 'policy-publish-endpoint', metricName: 'policy_publish_endpoint_duration_seconds' })
  @Roles('admin', 'policy_manager')
  @AuthorizePublish(Resource.POLICY, 'id')
  publish(@Param('id') id: string, @Request() req) {
    return this.policiesService.publish(id, req.user.id);
  }

  @Post(':id/exception')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  addException(
    @Param('id') id: string,
    @Body() exception: {
      description: string;
      justification: string;
      expirationDate?: Date;
      conditions?: string[];
    },
    @Request() req,
  ) {
    return this.policiesService.addException(id, exception, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'policy_manager')
  @AuthorizeDelete(Resource.POLICY, 'id')
  @ApiOperation({ summary: 'Archive a policy' })
  @ApiResponse({ status: 204, description: 'Policy archived successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.policiesService.remove(id, req.user.id);
  }

  // Workflow management
  @Post(':id/workflow/transition')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Transition policy workflow state' })
  @ApiResponse({ status: 200, description: 'Workflow transitioned successfully' })
  transitionWorkflow(
    @Param('id') id: string,
    @Body() transition: WorkflowTransitionDto,
    @Request() req,
  ) {
    return this.policiesService.transitionWorkflow(id, transition, req.user.id);
  }

  // Bulk operations
  @Post('bulk')
  @Roles('admin', 'policy_manager')
  @ApiOperation({ summary: 'Perform bulk operations on policies' })
  @ApiResponse({ status: 200, description: 'Bulk operation completed' })
  bulkOperation(
    @Body() operation: BulkOperationDto,
    @Request() req,
  ) {
    return this.policiesService.bulkOperation(operation, req.user.id);
  }

  // OPA integration
  @Post(':id/evaluate')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Evaluate policy against context using OPA' })
  @ApiResponse({ status: 200, description: 'Policy evaluation result' })
  evaluatePolicy(
    @Param('id') id: string,
    @Body() context: PolicyEvaluationContextDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const operationContext: PolicyOperationContext = {
      userId: context.user?.id || user?.userId || 'system',
      organizationId: user?.organizationId || 'system-org',
      timestamp: new Date(),
      source: 'api',
      operation: 'evaluate',
      metadata: {
        user: context.user,
        resource: context.resource,
        action: context.action,
        environment: context.environment,
      },
    };
    return this.policiesService.evaluatePolicy(id, operationContext);
  }

  @Post(':id/compile-opa')
  @Roles('admin', 'policy_manager')
  @ApiOperation({ summary: 'Compile and validate OPA policy' })
  @ApiResponse({ status: 200, description: 'OPA policy compiled successfully' })
  async compileOpaPolicy(@Param('id') id: string) {
    const policy = await this.policiesService.findOne(id);
    await this.policiesService.compileAndValidateOpaPolicy(policy);
    // Don't pass the full policy object to update, just return the policy
    return policy;
  }

  // Search and analytics
  @Get('search')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor', 'policy_viewer')
  @ApiOperation({ summary: 'Search policies with advanced filters' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'frameworks', required: false, type: [String] })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  search(
    @Query('q') query: string,
    @Query() filters: any,
    @Request() req,
  ) {
    return this.policiesService.searchPolicies(
      req.user.organizationId,
      query,
      filters,
    );
  }

  @Get(':id/similar')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Find similar policies' })
  @ApiParam({ name: 'id', description: 'Policy ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit the number of results (default: 5)' })
  getSimilarPolicies(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.policiesService.getSimilarPolicies(id, limit || 5);
  }

  // Compliance and metrics
  @Get(':id/compliance-score')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get policy compliance score' })
  getComplianceScore(@Param('id') id: string) {
    return this.policiesService.getComplianceScore(id);
  }

  @Post(':id/calculate-compliance-score')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Calculate and update policy compliance score' })
  calculateComplianceScore(@Param('id') id: string) {
    return this.policiesService.calculateAndUpdateComplianceScore(id);
  }

  @Get(':id/history')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get policy change history' })
  async getHistory(@Param('id') id: string) {
    const policy = await this.policiesService.findOne(id);
    return {
      policyId: policy.id,
      currentVersion: policy.version,
      history: policy.changeHistory || [],
    };
  }

  @Get(':id/evaluation-history')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get policy evaluation history' })
  async getEvaluationHistory(@Param('id') id: string) {
    const policy = await this.policiesService.findOne(id);
    return {
      policyId: policy.id,
      isEvaluatable: policy.isEvaluatable,
      lastEvaluated: policy.lastEvaluated,
      history: policy.evaluationHistory || [],
    };
  }

  // Templates
  @Get('templates')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Get policy templates' })
  getTemplates() {
    return this.policiesService.findAll({
      isTemplate: true,
      limit: 100,
    });
  }

  @Post('from-template/:templateId')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Create policy from template' })
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body() policyData: Partial<CreatePolicyDto>,
    @Request() req,
  ) {
    const template = await this.policiesService.findOne(templateId);
    if (!template.isTemplate) {
      throw new BadRequestException('Not a valid template');
    }

    const createDto: CreatePolicyDto = {
      ...policyData,
      content: template.content,
      type: template.type,
      priority: template.priority,
      scope: template.scope,
      templateId,
      createdBy: req.user.id,
    } as CreatePolicyDto;

    return this.policiesService.create(createDto);
  }

  // Policy-Control Mapping endpoints
  @Post(':id/map-control')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Map policy to control' })
  @ApiResponse({ status: 200, description: 'Policy mapped to control successfully' })
  mapToControl(
    @Param('id') id: string,
    @Body() mapping: MapPolicyToControlDto,
    @Request() req,
  ) {
    return this.policiesService.mapToControl(id, mapping, req.user.id);
  }

  @Post(':id/bulk-map-controls')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Bulk map policy to multiple controls' })
  @ApiResponse({ status: 200, description: 'Policy mapped to controls successfully' })
  bulkMapToControls(
    @Param('id') id: string,
    @Body() bulkMapping: BulkMapPolicyToControlsDto,
    @Request() req,
  ) {
    return this.policiesService.bulkMapToControls(id, bulkMapping, req.user.id);
  }

  @Delete(':id/unmap-control')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Unmap policy from control' })
  @ApiResponse({ status: 200, description: 'Policy unmapped from control successfully' })
  unmapFromControl(
    @Param('id') id: string,
    @Body() unmapDto: UnmapPolicyFromControlDto,
    @Request() req,
  ) {
    return this.policiesService.unmapFromControl(id, unmapDto, req.user.id);
  }

  @Patch(':id/update-control-mapping')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Update policy-control mapping details' })
  @ApiResponse({ status: 200, description: 'Mapping updated successfully' })
  updateControlMapping(
    @Param('id') id: string,
    @Body() updateDto: UpdatePolicyControlMappingDto,
    @Request() req,
  ) {
    return this.policiesService.updateControlMapping(id, updateDto, req.user.id);
  }

  @Post('control/search')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get policies mapped to a control' })
  @ApiResponse({ status: 200, description: 'Policies retrieved successfully' })
  getPoliciesByControl(@Body() query: GetPoliciesByControlDto) {
    return this.policiesService.getPoliciesByControl(query);
  }

  @Get(':id/control-coverage')
  @Roles('admin', 'policy_manager', 'compliance_manager', 'auditor')
  @ApiOperation({ summary: 'Get policy control coverage report' })
  @ApiResponse({ status: 200, description: 'Coverage report generated successfully' })
  getPolicyControlCoverage(@Param('id') id: string) {
    return this.policiesService.getPolicyControlCoverage(id);
  }

  @Post(':id/map-framework')
  @Roles('admin', 'policy_manager', 'compliance_manager')
  @ApiOperation({ summary: 'Map policy to framework controls' })
  @ApiResponse({ status: 200, description: 'Policy mapped to framework successfully' })
  mapToFramework(
    @Param('id') id: string,
    @Body() frameworkMapping: PolicyFrameworkMappingDto,
    @Request() req,
  ) {
    return this.policiesService.mapToFramework(id, frameworkMapping, req.user.id);
  }
}