import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { Evidence } from '../evidence/entities/evidence.entity';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  validate: (evidence: Evidence) => Promise<ValidationResult>;
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  message?: string;
  details?: any;
}

interface ControlServiceResponse {
  data?: {
    isValid: boolean;
    score: number;
    message: string;
    details: Record<string, any>;
    id?: string;
    expectedEvidenceTypes?: string[];
  };
}

interface PolicyServiceResponse {
  data?: {
    score: number;
  };
}

export interface EvidenceScore {
  overallScore: number; // 0-100
  categoryScores: Record<string, number>;
  validationResults: Array<{
    ruleId: string;
    ruleName: string;
    result: ValidationResult;
    weight: number;
  }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  metadata: {
    validatedAt: Date;
    validationDuration: number;
    rulesApplied: number;
    rulesPassed: number;
  };
}

@Injectable()
export class EvidenceValidationService {
  private readonly logger = new Logger(EvidenceValidationService.name);
  private validationRules = new Map<string, ValidationRule>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceDiscovery: ServiceDiscoveryService
  ) {
    this.initializeValidationRules();
  }

  private initializeValidationRules() {
    // Completeness Rules
    this.addRule({
      id: 'completeness-title',
      name: 'Title Completeness',
      description: 'Evidence must have a meaningful title',
      category: 'completeness',
      weight: 5,
      validate: async evidence => ({
        passed: !!(evidence.title && evidence.title.length >= 10),
        score: evidence.title?.length >= 10 ? 100 : 0,
        message: evidence.title?.length < 10 ? 'Title too short' : 'Title is complete',
      }),
    });

    this.addRule({
      id: 'completeness-description',
      name: 'Description Completeness',
      description: 'Evidence must have a detailed description',
      category: 'completeness',
      weight: 10,
      validate: async evidence => {
        const length = evidence.description?.length || 0;
        const score = Math.min(100, (length / 100) * 100);
        return {
          passed: length >= 50,
          score,
          message: length < 50 ? 'Description too brief' : 'Description is adequate',
        };
      },
    });

    this.addRule({
      id: 'completeness-content',
      name: 'Content Completeness',
      description: 'Evidence must have substantial content',
      category: 'completeness',
      weight: 20,
      validate: async evidence => {
        const hasContent = evidence.metadata && Object.keys(evidence.metadata).length > 0;
        const contentSize = JSON.stringify(evidence.metadata || {}).length;
        const score = hasContent ? Math.min(100, (contentSize / 500) * 100) : 0;
        return {
          passed: Boolean(hasContent && contentSize > 100),
          score,
          message: !hasContent ? 'No content provided' : 'Content is present',
        };
      },
    });

    // Accuracy Rules
    this.addRule({
      id: 'accuracy-source',
      name: 'Source Verification',
      description: 'Evidence must have a verifiable source',
      category: 'accuracy',
      weight: 15,
      validate: async evidence => ({
        passed: Boolean(evidence.source),
        score: evidence.source ? 100 : 0,
        message: !evidence.source ? 'Source not specified' : 'Source is verified',
      }),
    });

    this.addRule({
      id: 'accuracy-timestamp',
      name: 'Timestamp Accuracy',
      description: 'Evidence must have accurate timestamps',
      category: 'accuracy',
      weight: 10,
      validate: async evidence => {
        const hasTimestamp = !!evidence.collectionDate;
        const isRecent =
          evidence.collectionDate &&
          new Date().getTime() - evidence.collectionDate.getTime() < 24 * 60 * 60 * 1000;
        return {
          passed: Boolean(hasTimestamp),
          score: hasTimestamp ? (isRecent ? 100 : 80) : 0,
          message: !hasTimestamp ? 'Missing collection timestamp' : 'Timestamp verified',
        };
      },
    });

    // Relevance Rules
    this.addRule({
      id: 'relevance-framework',
      name: 'Framework Relevance',
      description: 'Evidence must be relevant to compliance frameworks',
      category: 'relevance',
      weight: 15,
      validate: async evidence => {
        const hasTags = evidence.tags && evidence.tags.length > 0;
        const hasFrameworkTags = evidence.tags?.some(tag =>
          ['SOC2', 'ISO27001', 'HIPAA', 'PCI-DSS', 'GDPR'].includes(tag.toUpperCase())
        );
        return {
          passed: Boolean(hasFrameworkTags),
          score: hasFrameworkTags ? 100 : hasTags ? 50 : 0,
          message: !hasFrameworkTags ? 'No framework tags found' : 'Framework relevance confirmed',
        };
      },
    });

    this.addRule({
      id: 'relevance-category',
      name: 'Category Alignment',
      description: 'Evidence must align with expected categories',
      category: 'relevance',
      weight: 10,
      validate: async evidence => {
        const validCategories = [
          'Access Control',
          'Data Protection',
          'Network Security',
          'Logging & Monitoring',
          'Change Management',
          'Incident Response',
          'Business Continuity',
          'Risk Management',
        ];
        const hasCategory = evidence.tags?.some(tag => validCategories.includes(tag)) || false;
        const isValid = !!hasCategory;
        return {
          passed: Boolean(isValid),
          score: isValid ? 100 : 0,
          message: !isValid ? 'Invalid category' : 'Category is valid',
        };
      },
    });

    // Timeliness Rules
    this.addRule({
      id: 'timeliness-age',
      name: 'Evidence Age',
      description: 'Evidence should be recent',
      category: 'timeliness',
      weight: 10,
      validate: async evidence => {
        const age = evidence.collectionDate
          ? (new Date().getTime() - evidence.collectionDate.getTime()) / (1000 * 60 * 60 * 24)
          : 999;
        const score = age <= 1 ? 100 : age <= 7 ? 80 : age <= 30 ? 60 : age <= 90 ? 40 : 0;
        return {
          passed: age <= 90,
          score,
          message: age > 90 ? 'Evidence is stale' : `Evidence is ${Math.floor(age)} days old`,
        };
      },
    });

    this.addRule({
      id: 'timeliness-expiration',
      name: 'Expiration Check',
      description: 'Evidence should not be expired',
      category: 'timeliness',
      weight: 5,
      validate: async evidence => {
        const isExpired = evidence.isExpired;
        const daysUntilExpiration = evidence.expirationDate
          ? Math.floor(
              (evidence.expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            )
          : 999;
        const score = isExpired
          ? 0
          : daysUntilExpiration > 30
            ? 100
            : daysUntilExpiration > 7
              ? 70
              : 40;
        return {
          passed: Boolean(!isExpired),
          score,
          message: isExpired
            ? 'Evidence has expired'
            : `Evidence expires in ${daysUntilExpiration} days`,
        };
      },
    });

    // Control Validation Rules
    this.addRule({
      id: 'control-requirements',
      name: 'Control Requirements Validation',
      description: 'Evidence must meet control requirements',
      category: 'control-compliance',
      weight: 25,
      validate: async evidence => {
        if (!evidence.controlId) {
          return {
            passed: false,
            score: 0,
            message: 'No control associated with evidence',
          };
        }

        try {
          const controlRequirements = await this.validateControlRequirements(
            evidence.controlId,
            evidence
          );
          return {
            passed: controlRequirements.isValid,
            score: controlRequirements.score,
            message: controlRequirements.message,
            details: controlRequirements.details,
          };
        } catch (error) {
          return {
            passed: false,
            score: 0,
            message: 'Failed to validate control requirements',
            details: { error: error.message },
          };
        }
      },
    });

    // Control Mapping Validation
    this.addRule({
      id: 'control-mapping',
      name: 'Control Mapping Validation',
      description: 'Evidence must be properly mapped to controls',
      category: 'control-compliance',
      weight: 15,
      validate: async evidence => {
        if (!evidence.controlId && !evidence.complianceMapping?.frameworks?.length) {
          return {
            passed: false,
            score: 0,
            message: 'Evidence not mapped to any controls',
          };
        }

        try {
          const mappingScore = await this.validateControlMapping(evidence);
          return {
            passed: mappingScore >= 70,
            score: mappingScore,
            message:
              mappingScore >= 70
                ? 'Control mapping is adequate'
                : 'Control mapping needs improvement',
          };
        } catch (_error) {
          return {
            passed: false,
            score: 0,
            message: 'Failed to validate control mapping',
          };
        }
      },
    });
  }

  private addRule(rule: ValidationRule) {
    this.validationRules.set(rule.id, rule);
  }

  async validateEvidence(evidence: Evidence): Promise<EvidenceScore> {
    const startTime = Date.now();
    const validationResults = [];
    const categoryScores: Record<string, { total: number; weight: number }> = {};

    this.logger.log(`Validating evidence: ${evidence.id}`);

    // Apply all validation rules
    for (const [ruleId, rule] of this.validationRules) {
      try {
        const result = await rule.validate(evidence);
        validationResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          result,
          weight: rule.weight,
        });

        // Accumulate category scores
        if (!categoryScores[rule.category]) {
          categoryScores[rule.category] = { total: 0, weight: 0 };
        }
        categoryScores[rule.category].total += result.score * rule.weight;
        categoryScores[rule.category].weight += rule.weight;
      } catch (error) {
        this.logger.error(`Error applying rule ${ruleId}:`, error);
        validationResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          result: {
            passed: false,
            score: 0,
            message: `Validation error: ${error.message}`,
          },
          weight: rule.weight,
        });
      }
    }

    // Calculate scores
    const overallScore = this.calculateOverallScore(validationResults);
    const normalizedCategoryScores = this.normalizeCategoryScores(categoryScores);
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(validationResults);
    const recommendations = this.generateRecommendations(validationResults, evidence);

    const score: EvidenceScore = {
      overallScore,
      categoryScores: normalizedCategoryScores,
      validationResults,
      strengths,
      weaknesses,
      recommendations,
      metadata: {
        validatedAt: new Date(),
        validationDuration: Date.now() - startTime,
        rulesApplied: validationResults.length,
        rulesPassed: validationResults.filter(r => r.result.passed).length,
      },
    };

    // Update evidence with validation score
    await this.updateEvidenceScore(evidence, score);

    // Emit validation event
    await this.eventEmitter.emit('evidence.validated', {
      evidenceId: evidence.id,
      score: overallScore,
      passed: overallScore >= 70,
      validatedAt: score.metadata.validatedAt,
    });

    return score;
  }

  private calculateOverallScore(results: any[]): number {
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const weightedSum = results.reduce((sum, r) => sum + r.result.score * r.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }

  private normalizeCategoryScores(
    categoryScores: Record<string, { total: number; weight: number }>
  ): Record<string, number> {
    const normalized: Record<string, number> = {};

    for (const [category, scores] of Object.entries(categoryScores)) {
      normalized[category] = Math.round(scores.total / scores.weight);
    }

    return normalized;
  }

  private identifyStrengthsWeaknesses(results: any[]): {
    strengths: string[];
    weaknesses: string[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const result of results) {
      if (result.result.score >= 90) {
        strengths.push(`${result.ruleName}: ${result.result.message}`);
      } else if (result.result.score < 50) {
        weaknesses.push(`${result.ruleName}: ${result.result.message}`);
      }
    }

    return { strengths, weaknesses };
  }

  private generateRecommendations(results: any[], evidence: Evidence): string[] {
    const recommendations: string[] = [];

    // Check for specific issues
    const titleResult = results.find(r => r.ruleId === 'completeness-title');
    if (titleResult && titleResult.result.score < 100) {
      recommendations.push('Improve evidence title to be more descriptive (minimum 10 characters)');
    }

    const descriptionResult = results.find(r => r.ruleId === 'completeness-description');
    if (descriptionResult && descriptionResult.result.score < 80) {
      recommendations.push(
        'Expand evidence description to provide more context (recommended 100+ characters)'
      );
    }

    const frameworkResult = results.find(r => r.ruleId === 'relevance-framework');
    if (frameworkResult && frameworkResult.result.score < 100) {
      recommendations.push(
        'Add framework tags (SOC2, ISO27001, etc.) to improve compliance mapping'
      );
    }

    const ageResult = results.find(r => r.ruleId === 'timeliness-age');
    if (ageResult && ageResult.result.score < 80) {
      recommendations.push('Consider refreshing this evidence as it may be outdated');
    }

    const expirationResult = results.find(r => r.ruleId === 'timeliness-expiration');
    if (expirationResult && expirationResult.result.score < 70) {
      recommendations.push('Evidence is approaching expiration - schedule renewal');
    }

    // General recommendations based on overall score
    const overallScore = this.calculateOverallScore(results);
    if (overallScore < 70) {
      recommendations.push(
        'Overall evidence quality needs improvement - review validation failures'
      );
    }

    return recommendations;
  }

  private async updateEvidenceScore(evidence: Evidence, score: EvidenceScore): Promise<void> {
    // In production, would update the evidence entity with the score
    // For now, just log it
    this.logger.log(`Evidence ${evidence.id} validated with score: ${score.overallScore}`);
  }

  // Bulk validation
  async validateMultipleEvidence(evidenceList: Evidence[]): Promise<Map<string, EvidenceScore>> {
    const scores = new Map<string, EvidenceScore>();

    for (const evidence of evidenceList) {
      try {
        const score = await this.validateEvidence(evidence);
        scores.set(evidence.id, score);
      } catch (error) {
        this.logger.error(`Failed to validate evidence ${evidence.id}:`, error);
      }
    }

    return scores;
  }

  // Get validation rules
  getValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  // Get validation rule by ID
  getValidationRule(ruleId: string): ValidationRule | undefined {
    return this.validationRules.get(ruleId);
  }

  // Service Discovery Methods

  /**
   * Validate control requirements against evidence
   */
  private async validateControlRequirements(
    controlId: string,
    evidence: Evidence
  ): Promise<{
    isValid: boolean;
    score: number;
    message: string;
    details?: any;
  }> {
    try {
      const response = await this.serviceDiscovery.callService(
        'control-service',
        'POST',
        `/controls/${controlId}/validate-evidence`,
        {
          evidenceId: evidence.id,
          evidenceType: evidence.type,
          evidenceMetadata: evidence.metadata,
          evidenceTitle: evidence.title,
          evidenceDescription: evidence.description,
          evidenceTags: evidence.tags,
          evidenceSource: evidence.source,
          complianceMapping: evidence.complianceMapping,
        }
      );

      const controlResponse = response as ControlServiceResponse;
      return {
        isValid: controlResponse?.data?.isValid || false,
        score: controlResponse?.data?.score || 0,
        message: controlResponse?.data?.message || 'Control requirements validation completed',
        details: controlResponse?.data?.details || {},
      };
    } catch (error) {
      this.logger.warn(`Failed to validate control requirements for ${controlId}:`, error.message);
      return {
        isValid: false,
        score: 0,
        message: 'Unable to validate control requirements - service unavailable',
        details: { error: error.message },
      };
    }
  }

  /**
   * Validate control mapping quality
   */
  private async validateControlMapping(evidence: Evidence): Promise<number> {
    try {
      // First validate primary control if exists
      let primaryControlScore = 0;
      if (evidence.controlId) {
        const controlResponse = await this.serviceDiscovery.callService(
          'control-service',
          'GET',
          `/controls/${evidence.controlId}`,
          null
        );

        const typedControlResponse = controlResponse as ControlServiceResponse;
        if (typedControlResponse?.data?.id === evidence.controlId) {
          primaryControlScore = 40; // Base score for valid primary control

          // Check if evidence type matches control expectations
          if (typedControlResponse?.data?.expectedEvidenceTypes?.includes(evidence.type)) {
            primaryControlScore += 20;
          }
        }
      }

      // Validate framework mappings
      let frameworkScore = 0;
      if (evidence.complianceMapping?.frameworks?.length) {
        const frameworkValidations = await Promise.all(
          evidence.complianceMapping.frameworks.map(async framework => {
            try {
              const response = await this.serviceDiscovery.callService(
                'control-service',
                'POST',
                `/controls/validate-framework-mapping`,
                {
                  framework: framework.name,
                  controls: framework.controls,
                  evidenceType: evidence.type,
                  evidenceMetadata: evidence.metadata,
                }
              );
              const policyResponse = response as PolicyServiceResponse;
              return policyResponse?.data?.score || 0;
            } catch (error) {
              this.logger.warn(
                `Failed to validate framework mapping for ${framework.name}:`,
                error.message
              );
              return 0;
            }
          })
        );

        frameworkScore =
          frameworkValidations.length > 0
            ? frameworkValidations.reduce((sum, score) => sum + score, 0) /
              frameworkValidations.length
            : 0;

        frameworkScore = Math.min(40, frameworkScore); // Cap at 40 points
      }

      return Math.min(100, primaryControlScore + frameworkScore);
    } catch (error) {
      this.logger.warn('Failed to validate control mapping:', error.message);
      return 0;
    }
  }
}
