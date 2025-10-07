import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ApiResponse,
  type AuditFinding,
  AuditFindingsSummaryResponse,
  BulkControlsResponse,
  type Control,
  ControlSummaryResponse,
  type Evidence,
  EvidenceCountResponse,
  PaginatedControlsResponse,
  type PaginatedEvidenceResponse,
  type PaginatedFindingsResponse,
  Policy,
  type PolicyComplianceResponse,
} from '@soc-compliance/contracts';
import {
  type AnalysisCompletedEvent,
  EventType,
  type RemediationGeneratedEvent,
} from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { Cache } from 'cache-manager';
import { firstValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type { AnalyzeImpactDto } from './dto/analyze-impact.dto';
import type { BulkAssignDto } from './dto/bulk-assign.dto';
import type { CreateRemediationDto } from './dto/create-remediation.dto';
import type { EstimateEffortDto } from './dto/estimate-effort.dto';
import type { GenerateRemediationPlanDto } from './dto/generate-plan.dto';
import type { GenerateRemediationDto } from './dto/generate-remediation.dto';
import type { GenerateReportDto } from './dto/generate-report.dto';
import type { PrioritizeRemediationsDto } from './dto/prioritize-remediations.dto';
import type { QueryRemediationDto } from './dto/query-remediation.dto';
import type { SuggestAutomationDto } from './dto/suggest-automation.dto';
import type { TrackProgressDto } from './dto/track-progress.dto';
import type { UpdateRemediationDto } from './dto/update-remediation.dto';
import type { ValidateCompletionDto } from './dto/validate-completion.dto';
import {
  Remediation,
  RemediationPriority,
  RemediationStatus,
  type RemediationStep,
  RemediationType,
} from './entities/remediation.entity';

@Injectable()
export class RemediationService {
  private readonly logger = new Logger(RemediationService.name);

  constructor(
    @InjectRepository(Remediation)
    private readonly remediationRepository: Repository<Remediation>,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async create(createDto: CreateRemediationDto): Promise<Remediation> {
    // Validate due date if provided
    if (createDto.dueDate) {
      const dueDate = new Date(createDto.dueDate);
      if (dueDate <= new Date()) {
        throw new BadRequestException('Due date must be in the future');
      }
    }

    // Auto-estimate effort if not provided
    let estimatedEffort = createDto.estimatedEffort;
    if (!estimatedEffort) {
      const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
      try {
        const estimation = await firstValueFrom(
          this.httpService.post(`${remediationEngineUrl}/estimate`, {
            title: createDto.title,
            description: createDto.description,
            priority: createDto.priority,
          }).pipe(
            map((res) => res.data),
          ),
        );
        estimatedEffort = {
          hours: estimation.estimatedHours,
          complexity: estimation.complexity,
        };
      } catch (error) {
        this.logger.warn('Failed to auto-estimate effort, using defaults');
        estimatedEffort = {
          hours: 40,
          complexity: 'medium',
        };
      }
    }

    const remediation = this.remediationRepository.create({
      ...createDto,
      status: RemediationStatus.PENDING,
      estimatedEffort,
    });

    const savedRemediation = await this.remediationRepository.save(remediation);

    // Emit creation event
    await this.eventEmitter.emit('remediation.created', {
      remediation: savedRemediation,
    });

    return savedRemediation;
  }

  async generateRemediation(dto: GenerateRemediationDto, organizationId: string): Promise<any> {
    try {
      // Get finding details if only ID provided
      let findingDetails = dto.finding;
      if (dto.findingId && !dto.finding) {
        findingDetails = await this.getFindingDetails(dto.findingId);
      }

      // Generate AI-based remediation suggestions
      const aiResponse = await this.generateAIRemediation({
        clientId: dto.clientId,
        finding: findingDetails,
        includeCostEstimate: dto.includeCostEstimate,
        includeSteps: dto.includeSteps,
        preferAutomation: dto.preferAutomation,
        constraints: dto.constraints,
        organizationId,
      });

      // Create remediation from AI response
      if (aiResponse.autoCreate) {
        const remediation = await this.create({
          clientId: dto.clientId,
          organizationId,
          findingId: dto.findingId,
          title: aiResponse.title,
          description: aiResponse.description,
          type: aiResponse.type || RemediationType.TECHNICAL,
          priority: aiResponse.priority || RemediationPriority.MEDIUM,
          estimatedEffort: aiResponse.estimatedEffort,
          metadata: aiResponse.metadata,
          createdBy: 'ai-service',
        });

        aiResponse.remediationId = remediation.id;
      }

      // Emit standardized remediation generated event
      const remediationGeneratedEvent: RemediationGeneratedEvent = {
        id: uuidv4(),
        type: EventType.REMEDIATION_GENERATED,
        timestamp: new Date(),
        version: '1.0',
        source: 'ai-service',
        userId: 'ai-service',
        organizationId,
        payload: {
          remediationId: aiResponse.remediationId || uuidv4(),
          findingId: dto.findingId || '',
          controlId: dto.finding?.controlId,
          organizationId,
          priority: aiResponse.priority || 'medium',
          generatedBy: 'ai-service',
          estimatedEffort: aiResponse.estimatedEffort?.hours || 0,
        },
      };
      
      this.eventEmitter.emit('remediation.generated', remediationGeneratedEvent);
      this.logger.log(`Emitted remediation.generated event for finding ${dto.findingId}`);

      return aiResponse;
    } catch (error) {
      this.logger.error('Failed to generate remediation:', error);
      throw new BadRequestException('Failed to generate remediation');
    }
  }

  private async getFindingDetails(findingId: string): Promise<any> {
    try {
      // Try to get finding details from audit service first
      const auditResponse = await this.serviceDiscovery.callService(
        'audit-service',
        'GET',
        `/findings/${findingId}`,
      );

      if (auditResponse.success && auditResponse.data) {
        return auditResponse.data;
      }

      // Fallback to control service for control-related findings
      const controlResponse = await this.serviceDiscovery.callService(
        'control-service',
        'GET',
        `/controls/finding/${findingId}`,
      );

      if (controlResponse.success && controlResponse.data) {
        return controlResponse.data;
      }

      // If no service has the finding, return mock data with warning
      this.logger.warn(`Finding ${findingId} not found in any service, using mock data`);
      return {
        id: findingId,
        type: 'compliance_gap',
        severity: 'high',
        description: 'Missing access review process',
        controlId: 'CC6.1',
        framework: 'SOC2',
        isMockData: true,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch finding details for ${findingId}:`, error);
      // Return mock data on error
      return {
        id: findingId,
        type: 'compliance_gap',
        severity: 'medium',
        description: 'Finding details unavailable',
        controlId: 'UNKNOWN',
        framework: 'SOC2',
        isMockData: true,
        error: error.message,
      };
    }
  }

  private async generateAIRemediation(params: any): Promise<any> {
    const { clientId, finding, includeCostEstimate, includeSteps, preferAutomation, constraints, organizationId } = params;
    
    try {
      // Get real data from services for AI analysis
      const [controlData, auditFindings, evidenceData, policyData] = await Promise.allSettled([
        this.getControlData(finding.controlId, organizationId),
        this.getAuditFindings(clientId, organizationId),
        this.getEvidenceData(finding.controlId, organizationId),
        this.getPolicyData(organizationId),
      ]);

      // Analyze real data for AI-driven recommendations
      const analysisResult = await this.performRealAIAnalysis({
        finding,
        controlData: controlData.status === 'fulfilled' ? controlData.value : null,
        auditFindings: auditFindings.status === 'fulfilled' ? auditFindings.value : null,
        evidenceData: evidenceData.status === 'fulfilled' ? evidenceData.value : null,
        policyData: policyData.status === 'fulfilled' ? policyData.value : null,
        constraints,
        preferAutomation,
      });

      const remediation = {
        title: analysisResult.title,
        description: analysisResult.description,
        type: analysisResult.type,
        priority: analysisResult.priority,
        estimatedEffort: includeCostEstimate ? analysisResult.estimatedEffort : undefined,
        steps: includeSteps ? analysisResult.steps : [],
        metadata: {
          aiGenerated: true,
          confidence: analysisResult.confidence,
          framework: finding.framework,
          controlId: finding.controlId,
          automationRecommended: analysisResult.automationRecommended,
          constraints: constraints || {},
          dataQuality: analysisResult.dataQuality,
          recommendationBasis: analysisResult.basis,
        },
        autoCreate: true,
      };

      return remediation;
    } catch (error) {
      this.logger.error('Failed to generate AI remediation with real data:', error);
      // Fallback to basic analysis
      return this.generateBasicRemediation(finding, includeCostEstimate, includeSteps, preferAutomation, constraints);
    }
  }

  private generateRemediationDescription(finding: any): string {
    const baseDescription = finding.description || 'Compliance gap identified';
    return `Address the following compliance issue: ${baseDescription}. This remediation will implement necessary controls and processes to meet compliance requirements.`;
  }

  private determineRemediationType(finding: any): RemediationType {
    if (finding.type === 'policy_gap') return RemediationType.POLICY;
    if (finding.type === 'process_gap') return RemediationType.PROCESS;
    if (finding.type === 'training_gap') return RemediationType.TRAINING;
    return RemediationType.TECHNICAL;
  }

  private determinePriority(finding: any): RemediationPriority {
    if (finding.severity === 'critical') return RemediationPriority.CRITICAL;
    if (finding.severity === 'high') return RemediationPriority.HIGH;
    if (finding.severity === 'low') return RemediationPriority.LOW;
    return RemediationPriority.MEDIUM;
  }

  private estimateEffortFromFinding(finding: any): any {
    // Simple effort estimation based on finding characteristics
    let hours = 40; // Default
    let complexity = 'medium';

    if (finding.severity === 'critical') {
      hours = 80;
      complexity = 'high';
    } else if (finding.severity === 'low') {
      hours = 20;
      complexity = 'low';
    }

    return { hours, complexity };
  }

  private generateSteps(finding: any, preferAutomation: boolean): RemediationStep[] {
    const steps: RemediationStep[] = [
      {
        order: 1,
        title: 'Analyze Current State',
        description: 'Review current implementation and identify gaps (Est. 8 hours)',
        status: 'pending',
      },
      {
        order: 2,
        title: 'Design Solution',
        description: 'Design remediation approach and implementation plan (Est. 16 hours)',
        status: 'pending',
      },
      {
        order: 3,
        title: 'Implement Changes',
        description: `${preferAutomation ? 'Implement automated solution' : 'Implement manual processes'} (Est. ${preferAutomation ? 24 : 32} hours)`,
        status: 'pending',
      },
      {
        order: 4,
        title: 'Test and Validate',
        description: 'Test implementation and validate compliance (Est. 8 hours)',
        status: 'pending',
      },
    ];

    return steps;
  }

  private canAutomate(finding: any): boolean {
    // Simple automation assessment
    const automatable = ['technical', 'monitoring', 'access_control'];
    return automatable.includes(finding.type);
  }

  /**
   * Get control data from control-service for AI analysis
   */
  private async getControlData(controlId: string, organizationId: string): Promise<Control | null> {
    if (!controlId) return null;
    
    try {
      const response = await this.serviceDiscovery.callService<Control>(
        'control-service',
        'GET',
        `/controls/${controlId}`,
        undefined,
        { headers: { 'X-Organization-Id': organizationId } }
      );

      return response.success && response.data ? response.data : null;
    } catch (error) {
      this.logger.warn(`Failed to fetch control data for ${controlId}:`, error.message);
      return null;
    }
  }

  /**
   * Get audit findings from audit-service for risk assessment
   */
  private async getAuditFindings(clientId: string, organizationId: string): Promise<AuditFinding[]> {
    try {
      const response = await this.serviceDiscovery.callService<PaginatedFindingsResponse>(
        'audit-service',
        'GET',
        `/findings?clientId=${clientId}&status=IDENTIFIED,CONFIRMED&limit=50`,
        undefined,
        { headers: { 'X-Organization-Id': organizationId } }
      );

      if (response.success && response.data?.items) {
        return response.data.items;
      }
      return [];
    } catch (error) {
      this.logger.warn('Failed to fetch audit findings:', error.message);
      return [];
    }
  }

  /**
   * Get evidence data from evidence-service for validation analysis
   */
  private async getEvidenceData(controlId: string, organizationId: string): Promise<Evidence[]> {
    if (!controlId) return [];
    
    try {
      const response = await this.serviceDiscovery.callService<PaginatedEvidenceResponse>(
        'evidence-service',
        'GET',
        `/evidence?controlId=${controlId}&limit=20`,
        undefined,
        { headers: { 'X-Organization-Id': organizationId } }
      );

      if (response.success && response.data?.items) {
        return response.data.items;
      }
      return [];
    } catch (error) {
      this.logger.warn(`Failed to fetch evidence data for control ${controlId}:`, error.message);
      return [];
    }
  }

  /**
   * Get policy data from policy-service for compliance checking
   */
  private async getPolicyData(organizationId: string): Promise<PolicyComplianceResponse | null> {
    try {
      const response = await this.serviceDiscovery.callService<PolicyComplianceResponse>(
        'policy-service',
        'GET',
        '/policies/compliance-status',
        undefined,
        { headers: { 'X-Organization-Id': organizationId } }
      );

      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      this.logger.warn('Failed to fetch policy compliance data:', error.message);
      return null;
    }
  }

  /**
   * Perform real AI analysis using actual service data
   */
  private async performRealAIAnalysis(analysisData: {
    finding: any;
    controlData: Control | null;
    auditFindings: AuditFinding[];
    evidenceData: Evidence[];
    policyData: PolicyComplianceResponse | null;
    constraints: any;
    preferAutomation: boolean;
  }): Promise<any> {
    const { finding, controlData, auditFindings, evidenceData, policyData, constraints, preferAutomation } = analysisData;

    // Calculate data quality score
    const dataQuality = this.calculateDataQuality(controlData, auditFindings, evidenceData, policyData);
    
    // Analyze control effectiveness
    const controlAnalysis = this.analyzeControlEffectiveness(controlData, evidenceData);
    
    // Assess risk based on audit findings
    const riskAssessment = this.assessRiskFromFindings(finding, auditFindings);
    
    // Generate recommendations based on evidence gaps
    const evidenceAnalysis = this.analyzeEvidenceGaps(controlData, evidenceData);
    
    // Provide compliance insights
    const complianceInsights = this.generateComplianceInsights(finding, policyData);
    
    // Determine automation feasibility
    const automationAnalysis = this.analyzeAutomationFeasibility(finding, controlData, preferAutomation);

    return {
      title: this.generateAnalyticalTitle(finding, controlAnalysis, riskAssessment),
      description: this.generateAnalyticalDescription(finding, controlAnalysis, evidenceAnalysis, complianceInsights),
      type: this.determineRemediationType(finding),
      priority: this.calculatePriorityFromRisk(riskAssessment, controlAnalysis),
      estimatedEffort: this.calculateRealEffortEstimate(finding, controlData, evidenceAnalysis, automationAnalysis),
      steps: this.generateIntelligentSteps(finding, controlAnalysis, evidenceAnalysis, automationAnalysis),
      confidence: this.calculateConfidenceScore(dataQuality, controlAnalysis, riskAssessment),
      automationRecommended: automationAnalysis.recommended,
      dataQuality,
      basis: {
        controlEffectiveness: controlAnalysis.score,
        riskLevel: riskAssessment.level,
        evidenceGaps: evidenceAnalysis.gaps.length,
        complianceScore: complianceInsights.score,
        automationFeasibility: automationAnalysis.feasibilityScore,
      },
    };
  }

  /**
   * Calculate data quality score based on available service data
   */
  private calculateDataQuality(controlData: Control | null, auditFindings: AuditFinding[], evidenceData: Evidence[], policyData: PolicyComplianceResponse | null): number {
    let score = 0;
    const maxScore = 4;

    if (controlData) score += 1;
    if (auditFindings.length > 0) score += 1;
    if (evidenceData.length > 0) score += 1;
    if (policyData) score += 1;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Analyze control effectiveness based on real control data and evidence
   */
  private analyzeControlEffectiveness(controlData: Control | null, evidenceData: Evidence[]): any {
    if (!controlData) {
      return {
        score: 30,
        status: 'unknown',
        issues: ['Control data not available'],
        recommendations: ['Ensure control is properly documented'],
      };
    }

    const verifiedEvidence = evidenceData.filter(e => e.verified).length;
    const totalEvidence = evidenceData.length;
    const evidenceScore = totalEvidence > 0 ? (verifiedEvidence / totalEvidence) * 100 : 0;

    let effectivenessScore = 50; // Base score
    const issues = [];
    const recommendations = [];

    // Analyze implementation status
    switch (controlData.implementationStatus) {
      case 'IMPLEMENTED':
        effectivenessScore += 30;
        break;
      case 'PARTIALLY_IMPLEMENTED':
        effectivenessScore += 15;
        issues.push('Control is only partially implemented');
        recommendations.push('Complete control implementation');
        break;
      case 'NOT_IMPLEMENTED':
        effectivenessScore -= 20;
        issues.push('Control is not implemented');
        recommendations.push('Implement control according to requirements');
        break;
    }

    // Analyze effectiveness
    if (controlData.effectiveness) {
      switch (controlData.effectiveness) {
        case 'EFFECTIVE':
          effectivenessScore += 20;
          break;
        case 'PARTIALLY_EFFECTIVE':
          effectivenessScore += 10;
          issues.push('Control effectiveness is limited');
          recommendations.push('Address control effectiveness gaps');
          break;
        case 'NOT_EFFECTIVE':
          effectivenessScore -= 10;
          issues.push('Control is not effective');
          recommendations.push('Redesign control to improve effectiveness');
          break;
      }
    }

    // Factor in evidence score
    effectivenessScore = (effectivenessScore + evidenceScore) / 2;

    return {
      score: Math.max(0, Math.min(100, Math.round(effectivenessScore))),
      status: effectivenessScore >= 80 ? 'good' : effectivenessScore >= 60 ? 'fair' : 'poor',
      issues,
      recommendations,
      evidenceRatio: totalEvidence > 0 ? verifiedEvidence / totalEvidence : 0,
    };
  }

  /**
   * Assess risk based on actual audit findings
   */
  private assessRiskFromFindings(currentFinding: any, auditFindings: AuditFinding[]): any {
    const relatedFindings = auditFindings.filter(f => 
      f.controlId === currentFinding.controlId || 
      f.findingType === currentFinding.type
    );

    const criticalCount = relatedFindings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = relatedFindings.filter(f => f.severity === 'HIGH').length;
    const openCount = relatedFindings.filter(f => ['IDENTIFIED', 'CONFIRMED'].includes(f.status)).length;

    let riskScore = 50; // Base risk
    let riskLevel = 'MEDIUM';

    if (criticalCount > 0) {
      riskScore += 40;
      riskLevel = 'CRITICAL';
    } else if (highCount > 0) {
      riskScore += 25;
      riskLevel = 'HIGH';
    }

    if (openCount > 2) {
      riskScore += 15;
    }

    // Check for recurring issues
    const recurringFindings = relatedFindings.filter(f => f.isRecurring).length;
    if (recurringFindings > 0) {
      riskScore += 20;
    }

    return {
      level: riskLevel,
      score: Math.min(100, riskScore),
      relatedFindingsCount: relatedFindings.length,
      criticalIssues: criticalCount,
      openIssues: openCount,
      isRecurring: recurringFindings > 0,
    };
  }

  /**
   * Analyze evidence gaps for validation
   */
  private analyzeEvidenceGaps(controlData: Control | null, evidenceData: Evidence[]): any {
    const gaps = [];
    const recommendations = [];

    if (!controlData) {
      gaps.push('Control definition missing');
      recommendations.push('Define control requirements and procedures');
    }

    const verifiedEvidence = evidenceData.filter(e => e.verified);
    const unverifiedEvidence = evidenceData.filter(e => !e.verified);
    const automatedEvidence = evidenceData.filter(e => e.isAutomated);

    if (evidenceData.length === 0) {
      gaps.push('No evidence collected');
      recommendations.push('Implement evidence collection procedures');
    } else {
      if (unverifiedEvidence.length > verifiedEvidence.length) {
        gaps.push('Majority of evidence is unverified');
        recommendations.push('Establish evidence verification process');
      }

      if (automatedEvidence.length === 0 && evidenceData.length > 0) {
        gaps.push('No automated evidence collection');
        recommendations.push('Implement automated evidence collection where possible');
      }

      // Check for evidence freshness
      const staleEvidence = evidenceData.filter(e => {
        const daysSinceCollection = (Date.now() - new Date(e.collectedDate).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCollection > 90;
      });

      if (staleEvidence.length > 0) {
        gaps.push('Some evidence is outdated');
        recommendations.push('Refresh stale evidence with recent data');
      }
    }

    return {
      gaps,
      recommendations,
      verificationRate: evidenceData.length > 0 ? verifiedEvidence.length / evidenceData.length : 0,
      automationRate: evidenceData.length > 0 ? automatedEvidence.length / evidenceData.length : 0,
    };
  }

  /**
   * Generate compliance insights based on policy data
   */
  private generateComplianceInsights(finding: any, policyData: PolicyComplianceResponse | null): any {
    if (!policyData) {
      return {
        score: 50,
        insights: ['Policy compliance data not available'],
        recommendations: ['Establish policy management process'],
      };
    }

    const insights = [];
    const recommendations = [];

    if (policyData.overallScore < 70) {
      insights.push('Overall policy compliance is below acceptable threshold');
      recommendations.push('Review and update policies to improve compliance score');
    }

    if (policyData.expiredPolicies > 0) {
      insights.push(`${policyData.expiredPolicies} policies have expired`);
      recommendations.push('Update expired policies to maintain compliance');
    }

    if (policyData.pendingReviewPolicies > 0) {
      insights.push(`${policyData.pendingReviewPolicies} policies are pending review`);
      recommendations.push('Complete pending policy reviews');
    }

    return {
      score: policyData.overallScore,
      insights,
      recommendations,
      publishedRatio: policyData.totalPolicies > 0 ? policyData.publishedPolicies / policyData.totalPolicies : 0,
    };
  }

  /**
   * Analyze automation feasibility
   */
  private analyzeAutomationFeasibility(finding: any, controlData: Control | null, preferAutomation: boolean): any {
    const automatable = ['technical', 'monitoring', 'access_control', 'CONTROL_DEFICIENCY'];
    const isAutomatable = automatable.includes(finding.type) || automatable.includes(finding.findingType);
    
    let feasibilityScore = 30; // Base score
    const benefits = [];
    const challenges = [];

    if (isAutomatable) {
      feasibilityScore += 40;
      benefits.push('Finding type is suitable for automation');
    } else {
      challenges.push('Finding type requires manual intervention');
    }

    if (controlData && controlData.category.includes('Technical')) {
      feasibilityScore += 20;
      benefits.push('Technical control can be automated');
    }

    if (preferAutomation) {
      feasibilityScore += 10;
      benefits.push('Automation is preferred by user');
    }

    // Check for complexity indicators
    if (finding.description && finding.description.includes('policy')) {
      feasibilityScore -= 15;
      challenges.push('Policy-related issues may require human judgment');
    }

    if (finding.description && finding.description.includes('training')) {
      feasibilityScore -= 20;
      challenges.push('Training-related issues require human involvement');
    }

    return {
      recommended: feasibilityScore >= 60,
      feasibilityScore: Math.max(0, Math.min(100, feasibilityScore)),
      benefits,
      challenges,
      automationType: isAutomatable ? 'full' : 'partial',
    };
  }

  /**
   * Generate analytical title based on real data analysis
   */
  private generateAnalyticalTitle(finding: any, controlAnalysis: any, riskAssessment: any): string {
    const severity = riskAssessment.level.toLowerCase();
    const effectiveness = controlAnalysis.status;
    const baseTitle = finding.title || finding.description || 'Compliance Issue';
    
    return `[${severity.toUpperCase()}] Remediate ${baseTitle} - ${effectiveness} control effectiveness`;
  }

  /**
   * Generate analytical description based on comprehensive analysis
   */
  private generateAnalyticalDescription(finding: any, controlAnalysis: any, evidenceAnalysis: any, complianceInsights: any): string {
    const parts = [];
    
    parts.push(`Primary Issue: ${finding.description || 'Compliance gap identified'}`);
    
    if (controlAnalysis.status === 'poor') {
      parts.push(`Control Status: Current control effectiveness is ${controlAnalysis.status} (${controlAnalysis.score}%). Major issues identified: ${controlAnalysis.issues.join(', ')}.`);
    } else {
      parts.push(`Control Status: Control effectiveness is ${controlAnalysis.status} (${controlAnalysis.score}%).`);
    }

    if (evidenceAnalysis.gaps.length > 0) {
      parts.push(`Evidence Gaps: ${evidenceAnalysis.gaps.join(', ')}. Verification rate: ${Math.round(evidenceAnalysis.verificationRate * 100)}%.`);
    }

    parts.push(`Compliance Impact: Overall policy compliance score is ${complianceInsights.score}%.`);
    
    parts.push('This remediation plan addresses the identified issues through systematic implementation of controls, evidence collection, and process improvements.');

    return parts.join(' ');
  }

  /**
   * Calculate priority based on risk assessment and control analysis
   */
  private calculatePriorityFromRisk(riskAssessment: any, controlAnalysis: any): RemediationPriority {
    if (riskAssessment.level === 'CRITICAL' || controlAnalysis.score < 30) {
      return RemediationPriority.CRITICAL;
    }
    if (riskAssessment.level === 'HIGH' || controlAnalysis.score < 50) {
      return RemediationPriority.HIGH;
    }
    if (riskAssessment.level === 'MEDIUM' || controlAnalysis.score < 70) {
      return RemediationPriority.MEDIUM;
    }
    return RemediationPriority.LOW;
  }

  /**
   * Calculate realistic effort estimate based on analysis
   */
  private calculateRealEffortEstimate(finding: any, controlData: Control | null, evidenceAnalysis: any, automationAnalysis: any): any {
    let baseHours = 40;
    let complexity = 'medium';

    // Adjust based on control implementation status
    if (controlData) {
      switch (controlData.implementationStatus) {
        case 'NOT_IMPLEMENTED':
          baseHours += 40;
          complexity = 'high';
          break;
        case 'PARTIALLY_IMPLEMENTED':
          baseHours += 20;
          break;
        case 'IMPLEMENTED':
          baseHours -= 10;
          break;
      }
    }

    // Adjust based on evidence gaps
    if (evidenceAnalysis.gaps.length > 2) {
      baseHours += evidenceAnalysis.gaps.length * 8;
      complexity = 'high';
    }

    // Adjust for automation
    if (automationAnalysis.recommended && automationAnalysis.feasibilityScore > 70) {
      baseHours -= 15;
      complexity = automationAnalysis.challenges.length > 0 ? 'medium' : 'low';
    }

    // Adjust based on finding severity
    if (finding.severity === 'critical') {
      baseHours += 20;
      complexity = 'high';
    } else if (finding.severity === 'low') {
      baseHours -= 10;
      complexity = 'low';
    }

    return {
      hours: Math.max(20, Math.min(120, baseHours)),
      complexity,
      breakdown: {
        analysis: Math.round(baseHours * 0.2),
        implementation: Math.round(baseHours * 0.5),
        testing: Math.round(baseHours * 0.2),
        documentation: Math.round(baseHours * 0.1),
      },
    };
  }

  /**
   * Generate intelligent steps based on comprehensive analysis
   */
  private generateIntelligentSteps(finding: any, controlAnalysis: any, evidenceAnalysis: any, automationAnalysis: any): RemediationStep[] {
    const steps: RemediationStep[] = [];
    let stepOrder = 1;

    // Step 1: Analysis and Planning
    steps.push({
      order: stepOrder++,
      title: 'Comprehensive Gap Analysis',
      description: `Analyze current state: Control effectiveness (${controlAnalysis.score}%), evidence gaps (${evidenceAnalysis.gaps.length} identified), and compliance requirements. Est. ${Math.round(controlAnalysis.score < 50 ? 12 : 8)} hours.`,
      status: 'pending',
    });

    // Step 2: Control Implementation/Improvement
    if (controlAnalysis.score < 70) {
      steps.push({
        order: stepOrder++,
        title: 'Control Implementation Enhancement',
        description: `Address control deficiencies: ${controlAnalysis.issues.join(', ')}. Focus on ${controlAnalysis.recommendations.join(', ')}. Est. ${Math.round(controlAnalysis.score < 30 ? 32 : 20)} hours.`,
        status: 'pending',
      });
    }

    // Step 3: Evidence Collection
    if (evidenceAnalysis.gaps.length > 0) {
      const automationNote = automationAnalysis.recommended ? ' (prioritize automated collection)' : '';
      steps.push({
        order: stepOrder++,
        title: 'Evidence Collection and Verification',
        description: `Address evidence gaps: ${evidenceAnalysis.gaps.join(', ')}${automationNote}. Target: ${Math.round(evidenceAnalysis.verificationRate * 100)}% → 90% verification rate. Est. ${evidenceAnalysis.gaps.length * 6} hours.`,
        status: 'pending',
      });
    }

    // Step 4: Automation Implementation (if recommended)
    if (automationAnalysis.recommended && automationAnalysis.feasibilityScore > 60) {
      steps.push({
        order: stepOrder++,
        title: 'Process Automation Implementation',
        description: `Implement ${automationAnalysis.automationType} automation. Benefits: ${automationAnalysis.benefits.join(', ')}. Challenges to address: ${automationAnalysis.challenges.join(', ')}. Est. 24 hours.`,
        status: 'pending',
      });
    }

    // Step 5: Testing and Validation
    steps.push({
      order: stepOrder++,
      title: 'Solution Testing and Validation',
      description: `Test implemented controls and validate effectiveness. Verify evidence collection processes and compliance alignment. Est. ${Math.round(steps.length * 4)} hours.`,
      status: 'pending',
    });

    // Step 6: Documentation and Monitoring
    steps.push({
      order: stepOrder++,
      title: 'Documentation and Monitoring Setup',
      description: 'Document implemented changes, update procedures, and establish ongoing monitoring. Create evidence collection schedules and compliance checkpoints. Est. 8 hours.',
      status: 'pending',
    });

    return steps;
  }

  /**
   * Calculate confidence score based on data quality and analysis completeness
   */
  private calculateConfidenceScore(dataQuality: number, controlAnalysis: any, riskAssessment: any): number {
    let confidence = 0.5; // Base confidence

    // Adjust based on data quality
    confidence += (dataQuality / 100) * 0.3;

    // Adjust based on control analysis completeness
    if (controlAnalysis.score > 0) confidence += 0.1;
    if (controlAnalysis.evidenceRatio > 0.5) confidence += 0.1;

    // Adjust based on risk assessment data
    if (riskAssessment.relatedFindingsCount > 0) confidence += 0.1;

    return Math.min(0.95, Math.max(0.6, confidence));
  }

  /**
   * Generate basic remediation as fallback
   */
  private generateBasicRemediation(finding: any, includeCostEstimate: boolean, includeSteps: boolean, preferAutomation: boolean, constraints: any): any {
    return {
      title: `Remediate ${finding.description || 'Compliance Issue'}`,
      description: this.generateRemediationDescription(finding),
      type: this.determineRemediationType(finding),
      priority: this.determinePriority(finding),
      estimatedEffort: includeCostEstimate ? this.estimateEffortFromFinding(finding) : undefined,
      steps: includeSteps ? this.generateSteps(finding, preferAutomation) : [],
      confidence: 0.7,
      automationRecommended: preferAutomation && this.canAutomate(finding),
      dataQuality: 30,
      basis: {
        controlEffectiveness: 50,
        riskLevel: 'MEDIUM',
        evidenceGaps: 0,
        complianceScore: 50,
        automationFeasibility: 50,
      },
    };
  }

  async generateBulkRemediations(
    findingIds: string[],
    options: any,
    organizationId: string,
  ): Promise<any> {
    // Generate remediations for each finding
    const generatedRemediations = [];
    
    for (const findingId of findingIds) {
      try {
        const finding = await this.getFindingDetails(findingId);
        const remediation = await this.generateAIRemediation({
          finding,
          ...options,
          organizationId,
        });
        
        generatedRemediations.push({
          ...remediation,
          findingId,
        });
      } catch (error) {
        this.logger.error(`Failed to generate remediation for finding ${findingId}:`, error);
      }
    }
    
    const response = {
      remediations: generatedRemediations,
      total: generatedRemediations.length,
    };

    // Process and save generated remediations
    const created = [];
    for (const remediation of response.remediations) {
      try {
        const saved = await this.create({
          ...remediation,
          organizationId,
          createdBy: options.createdBy || 'ai-service',
        });
        created.push(saved);
      } catch (error) {
        this.logger.error(`Failed to create remediation: ${error.message}`);
      }
    }

    return {
      total: response.remediations.length,
      created: created.length,
      remediations: created,
    };
  }

  async findAll(query: QueryRemediationDto, organizationId: string): Promise<{
    data: Remediation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.remediationRepository.createQueryBuilder('remediation');

    // Base filter by organization
    qb.where('remediation.organizationId = :organizationId', { organizationId });

    // Apply filters
    if (query.clientId) {
      qb.andWhere('remediation.clientId = :clientId', { clientId: query.clientId });
    }

    if (query.findingId) {
      qb.andWhere('remediation.findingId = :findingId', { findingId: query.findingId });
    }

    if (query.type) {
      qb.andWhere('remediation.type = :type', { type: query.type });
    }

    if (query.status) {
      qb.andWhere('remediation.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('remediation.priority = :priority', { priority: query.priority });
    }

    if (query.assignedTo) {
      qb.andWhere('remediation.assignedTo = :assignedTo', { assignedTo: query.assignedTo });
    }

    if (query.dueBefore) {
      qb.andWhere('remediation.dueDate <= :dueBefore', { dueBefore: query.dueBefore });
    }

    if (query.search) {
      qb.andWhere(
        '(remediation.title ILIKE :search OR remediation.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Handle overdue filter
    if (query.overdue) {
      qb.andWhere('remediation.dueDate < :now AND remediation.status != :completed', {
        now: new Date(),
        completed: RemediationStatus.COMPLETED,
      });
    }

    // Apply sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    qb.orderBy(`remediation.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (query.page - 1) * query.limit;
    qb.skip(skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, organizationId: string): Promise<Remediation> {
    const cacheKey = `remediation:${id}`;
    
    // Check cache first
    const cached = await this.cacheManager.get<Remediation>(cacheKey);
    if (cached) {
      return cached;
    }

    const remediation = await this.remediationRepository.findOne({
      where: {
        id,
        organizationId,
      },
      relations: ['finding', 'assignee'],
    });

    if (!remediation) {
      throw new NotFoundException(`Remediation with ID ${id} not found`);
    }

    // Cache for 30 minutes
    const cacheTTL = this.configService.get<number>('REMEDIATION_CACHE_TTL', 1800);
    await this.cacheManager.set(cacheKey, remediation, cacheTTL);

    return remediation;
  }

  async update(
    id: string,
    updateDto: UpdateRemediationDto,
    organizationId: string,
  ): Promise<Remediation> {
    const remediation = await this.findOne(id, organizationId);

    // Handle status transitions
    if (updateDto.status) {
      this.validateStatusTransition(remediation.status, updateDto.status);
      
      if (updateDto.status === RemediationStatus.COMPLETED) {
        updateDto['completedAt'] = new Date();
      }
      
      if (updateDto.status === RemediationStatus.IN_PROGRESS && !remediation.actualEffort?.startedAt) {
        updateDto.actualEffort = {
          ...updateDto.actualEffort,
          startedAt: new Date(),
          hours: 0,
          percentComplete: 0,
        };
      }
    }

    // Handle approval
    if (updateDto.approvedBy && remediation.status === RemediationStatus.DRAFT) {
      updateDto['approvedAt'] = new Date();
      updateDto.status = RemediationStatus.PENDING;
    }

    // Handle actual effort hours and percent complete updates
    if (updateDto.actualEffortHours !== undefined || updateDto.percentComplete !== undefined) {
      updateDto.actualEffort = {
        ...remediation.actualEffort,
        ...(updateDto.actualEffortHours !== undefined && { hours: updateDto.actualEffortHours }),
        ...(updateDto.percentComplete !== undefined && { percentComplete: updateDto.percentComplete }),
      };
    }

    const updated = await this.remediationRepository.save({
      ...remediation,
      ...updateDto,
      updatedAt: new Date(),
    });

    // Clear cache
    await this.cacheManager.del(`remediation:${id}`);

    // Emit update event
    await this.eventEmitter.emit('remediation.updated', {
      remediation: updated,
      changes: updateDto,
    });

    return updated;
  }

  private validateStatusTransition(currentStatus: RemediationStatus, newStatus: RemediationStatus): void {
    const validTransitions: Record<RemediationStatus, RemediationStatus[]> = {
      [RemediationStatus.DRAFT]: [RemediationStatus.PENDING, RemediationStatus.CANCELLED],
      [RemediationStatus.PENDING]: [RemediationStatus.IN_PROGRESS, RemediationStatus.CANCELLED, RemediationStatus.ON_HOLD],
      [RemediationStatus.IN_PROGRESS]: [RemediationStatus.COMPLETED, RemediationStatus.ON_HOLD, RemediationStatus.CANCELLED],
      [RemediationStatus.ON_HOLD]: [RemediationStatus.IN_PROGRESS, RemediationStatus.CANCELLED],
      [RemediationStatus.COMPLETED]: [],
      [RemediationStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async updateProgress(
    id: string,
    progress: { percentComplete: number; hoursSpent: number; notes?: string },
    organizationId: string,
  ): Promise<Remediation> {
    const remediation = await this.findOne(id, organizationId);

    if (remediation.status !== RemediationStatus.IN_PROGRESS) {
      throw new BadRequestException('Can only update progress for in-progress remediations');
    }

    const actualEffort = {
      ...remediation.actualEffort,
      hours: (remediation.actualEffort?.hours || 0) + progress.hoursSpent,
      percentComplete: progress.percentComplete,
      lastUpdatedAt: new Date(),
    };

    const updated = await this.remediationRepository.save({
      ...remediation,
      actualEffort,
      notes: progress.notes ? `${remediation.notes || ''}\n${progress.notes}` : remediation.notes,
    });

    // Check if auto-complete threshold reached
    if (progress.percentComplete === 100) {
      await this.eventEmitter.emit('remediation.ready.complete', {
        remediation: updated,
      });
    }

    return updated;
  }

  async updateStep(
    id: string,
    stepOrder: number,
    stepUpdate: Partial<RemediationStep>,
    organizationId: string,
  ): Promise<Remediation> {
    const remediation = await this.findOne(id, organizationId);

    if (!remediation.steps || remediation.steps.length === 0) {
      throw new BadRequestException('Remediation has no steps defined');
    }

    const stepIndex = remediation.steps.findIndex(s => s.order === stepOrder);
    if (stepIndex === -1) {
      throw new NotFoundException(`Step with order ${stepOrder} not found`);
    }

    remediation.steps[stepIndex] = {
      ...remediation.steps[stepIndex],
      ...stepUpdate,
    };

    // Calculate overall progress based on completed steps
    const completedSteps = remediation.steps.filter(s => s.status === 'completed').length;
    const percentComplete = Math.round((completedSteps / remediation.steps.length) * 100);

    const updated = await this.remediationRepository.save({
      ...remediation,
      steps: remediation.steps,
      actualEffort: {
        ...remediation.actualEffort,
        percentComplete,
      },
    });

    return updated;
  }

  async getEffectiveness(
    clientId: string,
    timeframe: string,
    organizationId: string,
  ): Promise<any> {
    const qb = this.remediationRepository.createQueryBuilder('remediation');

    // Get completed remediations in timeframe
    const startDate = this.calculateStartDate(timeframe);
    
    qb.where('remediation.organizationId = :organizationId', { organizationId })
      .andWhere('remediation.clientId = :clientId', { clientId })
      .andWhere('remediation.status = :status', { status: RemediationStatus.COMPLETED })
      .andWhere('remediation.completedAt >= :startDate', { startDate });

    const remediations = await qb.getMany();

    if (remediations.length === 0) {
      return {
        effectiveness: null,
        message: 'No completed remediations in the specified timeframe',
      };
    }

    // Calculate effectiveness metrics
    const metrics = {
      totalCompleted: remediations.length,
      averageCompletionTime: this.calculateAverageCompletionTime(remediations),
      onTimeCompletionRate: this.calculateOnTimeRate(remediations),
      effortAccuracy: this.calculateEffortAccuracy(remediations),
      byPriority: this.groupByPriority(remediations),
      byType: this.groupByType(remediations),
    };

    return metrics;
  }

  private calculateStartDate(timeframe: string): Date {
    const now = new Date();
    const match = timeframe.match(/(\d+)(\w+)/);
    if (!match) return now;

    const [, value, unit] = match;
    const amount = parseInt(value);

    switch (unit) {
      case 'days':
      case 'd':
        now.setDate(now.getDate() - amount);
        break;
      case 'months':
      case 'm':
        now.setMonth(now.getMonth() - amount);
        break;
      case 'years':
      case 'y':
        now.setFullYear(now.getFullYear() - amount);
        break;
    }

    return now;
  }

  private calculateAverageCompletionTime(remediations: Remediation[]): number {
    const completionTimes = remediations
      .filter(r => r.createdAt && r.completedAt)
      .map(r => r.completedAt.getTime() - r.createdAt.getTime());

    if (completionTimes.length === 0) return 0;

    const average = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length;
    return Math.round(average / (1000 * 60 * 60 * 24)); // Convert to days
  }

  private calculateOnTimeRate(remediations: Remediation[]): number {
    const withDueDate = remediations.filter(r => r.dueDate);
    if (withDueDate.length === 0) return 100;

    const onTime = withDueDate.filter(r => r.completedAt <= r.dueDate).length;
    return Math.round((onTime / withDueDate.length) * 100);
  }

  private calculateEffortAccuracy(remediations: Remediation[]): number {
    const withEffort = remediations.filter(
      r => r.estimatedEffort?.hours && r.actualEffort?.hours,
    );

    if (withEffort.length === 0) return null;

    const accuracies = withEffort.map(r => {
      const estimated = r.estimatedEffort.hours;
      const actual = r.actualEffort.hours;
      return 100 - Math.abs((actual - estimated) / estimated) * 100;
    });

    return Math.round(accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length);
  }

  private groupByPriority(remediations: Remediation[]): Record<string, number> {
    return remediations.reduce((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByType(remediations: Remediation[]): Record<string, number> {
    return remediations.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});
  }

  async optimizePlan(
    clientId: string,
    constraints: any,
    organizationId: string,
  ): Promise<any> {
    // Get pending remediations
    const pendingRemediations = await this.remediationRepository.find({
      where: {
        organizationId,
        clientId,
        status: RemediationStatus.PENDING,
      },
    });

    // AI-based optimization logic
    const optimizedPlan = this.optimizeRemediationPlan(pendingRemediations, constraints);

    return optimizedPlan;
  }

  private optimizeRemediationPlan(remediations: Remediation[], constraints: any): any {
    // Sort remediations by priority and impact
    const prioritizedRemediations = remediations.sort((a, b) => {
      const priorityOrder = {
        [RemediationPriority.CRITICAL]: 4,
        [RemediationPriority.HIGH]: 3,
        [RemediationPriority.MEDIUM]: 2,
        [RemediationPriority.LOW]: 1,
      };
      
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Apply constraints
    let optimizedRemediations = prioritizedRemediations;
    
    if (constraints.maxEffort) {
      let totalEffort = 0;
      optimizedRemediations = prioritizedRemediations.filter(remediation => {
        const effortHours = remediation.estimatedEffort?.hours || 40;
        if (totalEffort + effortHours <= constraints.maxEffort) {
          totalEffort += effortHours;
          return true;
        }
        return false;
      });
    }

    if (constraints.timeframe) {
      const timeframeDays = this.parseTimeframe(constraints.timeframe);
      const maxConcurrentRemediations = Math.floor(timeframeDays / 14); // 2 weeks per remediation average
      optimizedRemediations = optimizedRemediations.slice(0, maxConcurrentRemediations);
    }

    return {
      optimizedPlan: optimizedRemediations,
      totalEffort: optimizedRemediations.reduce((sum, r) => sum + (r.estimatedEffort?.hours || 40), 0),
      estimatedCompletion: this.calculateCompletionDate(optimizedRemediations),
      recommendations: this.generateOptimizationRecommendations(remediations, optimizedRemediations, constraints),
    };
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)\s*(days?|weeks?|months?)/i);
    if (!match) return 90; // Default 90 days
    
    const [, value, unit] = match;
    const days = parseInt(value);
    
    switch (unit.toLowerCase()) {
      case 'day':
      case 'days': return days;
      case 'week':
      case 'weeks': return days * 7;
      case 'month':
      case 'months': return days * 30;
      default: return days;
    }
  }

  private calculateCompletionDate(remediations: Remediation[]): Date {
    const totalHours = remediations.reduce((sum, r) => sum + (r.estimatedEffort?.hours || 40), 0);
    const workingHours = 8; // Hours per day
    const workingDays = Math.ceil(totalHours / workingHours);
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + workingDays);
    return completionDate;
  }

  private generateOptimizationRecommendations(original: Remediation[], optimized: Remediation[], constraints: any): string[] {
    const recommendations = [];
    
    if (optimized.length < original.length) {
      recommendations.push(`Deferred ${original.length - optimized.length} lower-priority remediations due to constraints`);
    }
    
    const criticalCount = optimized.filter(r => r.priority === RemediationPriority.CRITICAL).length;
    if (criticalCount > 0) {
      recommendations.push(`Prioritizing ${criticalCount} critical remediations`);
    }
    
    const automatable = optimized.filter(r => r.metadata?.automationRecommended).length;
    if (automatable > 0) {
      recommendations.push(`${automatable} remediations can be automated to reduce effort`);
    }
    
    return recommendations;
  }

  async generateRemediationPlan(planDto: GenerateRemediationPlanDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/plan`, {
          findingIds: planDto.findingIds,
          clientId: planDto.clientId,
          strategy: planDto.optimizationStrategy,
          includeAutomation: planDto.includeAutomation,
          budgetConstraint: planDto.budgetConstraint,
          useAIGuidance: planDto.useAIGuidance,
          organizationId,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to generate remediation plan:', error);
      throw new BadRequestException('Failed to generate remediation plan');
    }
  }

  async prioritizeRemediations(prioritizeDto: PrioritizeRemediationsDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/prioritize`, {
          remediationIds: prioritizeDto.remediationIds,
          method: prioritizeDto.prioritizationMethod,
          criteria: prioritizeDto.criteria,
          organizationId,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to prioritize remediations:', error);
      throw new BadRequestException('Failed to prioritize remediations');
    }
  }

  async estimateEffort(effortDto: EstimateEffortDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      // Get remediation details
      const remediation = await this.findOne(effortDto.remediationId, organizationId);

      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/estimate/detailed`, {
          remediation,
          includeBreakdown: effortDto.includeBreakdown,
          considerDependencies: effortDto.considerDependencies,
          includeConfidenceIntervals: effortDto.includeConfidenceIntervals,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to estimate effort:', error);
      throw new BadRequestException('Failed to estimate effort');
    }
  }

  async trackProgress(progressDto: TrackProgressDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      // Get remediation details
      const remediation = await this.findOne(progressDto.remediationId, organizationId);

      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/progress`, {
          remediation,
          includeMetrics: progressDto.includeMetrics,
          includeForecast: progressDto.includeForecast,
          includeHistory: progressDto.includeHistory,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to track progress:', error);
      throw new BadRequestException('Failed to track progress');
    }
  }

  async suggestAutomation(automationDto: SuggestAutomationDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/automation`, {
          remediationIds: automationDto.remediationIds,
          goal: automationDto.automationGoal,
          includeROIAnalysis: automationDto.includeROIAnalysis,
          technologyPreferences: automationDto.technologyPreferences,
          organizationId,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to suggest automation:', error);
      throw new BadRequestException('Failed to suggest automation');
    }
  }

  async analyzeImpact(impactDto: AnalyzeImpactDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      // Get remediation details
      const remediation = await this.findOne(impactDto.remediationId, organizationId);

      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/impact`, {
          remediation,
          dimensions: impactDto.impactDimensions,
          includeCostBenefit: impactDto.includeCostBenefit,
          includeRiskMetrics: impactDto.includeRiskMetrics,
        }).pipe(
          map((res) => res.data),
        ),
      );

      // Emit standardized analysis completed event
      const analysisCompletedEvent: AnalysisCompletedEvent = {
        id: uuidv4(),
        type: EventType.ANALYSIS_COMPLETED,
        timestamp: new Date(),
        version: '1.0',
        source: 'ai-service',
        userId: 'ai-service',
        organizationId,
        payload: {
          analysisId: uuidv4(),
          analysisType: 'impact_analysis',
          organizationId,
          duration: 0, // Would track actual duration
          resultSummary: {
            entityId: impactDto.remediationId,
            entityType: 'remediation',
            results: response,
            confidence: response.confidence || 0.8,
          },
        },
      };
      
      this.eventEmitter.emit('analysis.completed', analysisCompletedEvent);
      this.logger.log(`Emitted analysis.completed event for remediation ${impactDto.remediationId}`);

      return response;
    } catch (error) {
      this.logger.error('Failed to analyze impact:', error);
      throw new BadRequestException('Failed to analyze impact');
    }
  }

  async validateCompletion(validationDto: ValidateCompletionDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      // Get remediation details
      const remediation = await this.findOne(validationDto.remediationId, organizationId);

      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/validate`, {
          remediation,
          evidenceIds: validationDto.evidenceIds,
          testingResults: validationDto.testingResults,
          completionNotes: validationDto.completionNotes,
          validationChecklist: validationDto.validationChecklist,
        }).pipe(
          map((res) => res.data),
        ),
      );

      // Update remediation status to completed if validation passes
      if (response.status === 'validated') {
        const updated = await this.remediationRepository.save({
          ...remediation,
          status: RemediationStatus.COMPLETED,
          completedAt: new Date(),
        });

        // Emit completion event
        await this.eventEmitter.emit('remediation.completed', {
          remediation: updated,
          validationResult: response,
        });
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to validate completion:', error);
      throw new BadRequestException('Failed to validate completion');
    }
  }

  async generateReport(reportDto: GenerateReportDto, organizationId: string): Promise<any> {
    const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${remediationEngineUrl}/report`, {
          clientId: reportDto.clientId,
          reportType: reportDto.reportType,
          dateRange: reportDto.dateRange,
          remediationIds: reportDto.remediationIds,
          format: reportDto.format,
          includeVisualizations: reportDto.includeVisualizations,
          organizationId,
        }).pipe(
          map((res) => res.data),
        ),
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to generate report:', error);
      throw new BadRequestException('Failed to generate report');
    }
  }

  async bulkAssign(bulkAssignDto: BulkAssignDto, organizationId: string): Promise<any> {
    try {
      // Get all remediations to assign
      const remediations = await this.remediationRepository.find({
        where: {
          id: In(bulkAssignDto.remediationIds),
          organizationId,
        },
      });

      if (remediations.length !== bulkAssignDto.remediationIds.length) {
        throw new BadRequestException('Some remediations not found');
      }

      // Check workload if requested
      let workloadAnalysis = null;
      if (bulkAssignDto.rebalanceWorkload || bulkAssignDto.considerCapacity) {
        const remediationEngineUrl = this.configService.get<string>('REMEDIATION_ENGINE_URL');
        const workloadResponse = await firstValueFrom(
          this.httpService.post(`${remediationEngineUrl}/workload`, {
            assigneeId: bulkAssignDto.assigneeId,
            newRemediations: remediations,
            rebalance: bulkAssignDto.rebalanceWorkload,
            considerCapacity: bulkAssignDto.considerCapacity,
          }).pipe(
            map((res) => res.data),
          ),
        );
        workloadAnalysis = workloadResponse.workloadAnalysis;
      }

      // Update remediations with new assignment
      const updatedRemediations = remediations.map(remediation => ({
        ...remediation,
        assignedTo: bulkAssignDto.assigneeId,
        assignedAt: new Date(),
        dueDate: bulkAssignDto.dueDate ? new Date(bulkAssignDto.dueDate) : remediation.dueDate,
        notes: bulkAssignDto.notes ? `${remediation.notes || ''}\n${bulkAssignDto.notes}` : remediation.notes,
      }));

      await this.remediationRepository.save(updatedRemediations);

      // Emit assignment events
      for (const remediation of updatedRemediations) {
        await this.eventEmitter.emit('remediation.assigned', {
          remediation,
          assigneeId: bulkAssignDto.assigneeId,
        });
      }

      return {
        assigned: updatedRemediations.length,
        remediations: updatedRemediations,
        workloadAnalysis,
      };
    } catch (error) {
      this.logger.error('Failed to bulk assign remediations:', error);
      throw new BadRequestException('Failed to bulk assign remediations');
    }
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const remediation = await this.findOne(id, organizationId);
    
    if (remediation.status === RemediationStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot delete in-progress remediations');
    }

    // Use soft delete
    await this.remediationRepository.softDelete(id);
    
    // Clear cache
    await this.cacheManager.del(`remediation:${id}`);
    
    // Emit deletion event
    await this.eventEmitter.emit('remediation.deleted', {
      remediationId: id,
      organizationId,
    });
  }
}