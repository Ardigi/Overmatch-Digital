import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from '../policies/entities/policy.entity';
import { PolicyEvaluator } from './evaluators/policy.evaluator';
import {
  type IPolicyEngine,
  PolicyAction,
  type PolicyContext,
  type PolicyEvaluationResult,
  type PolicyRule,
  type PolicySet,
} from './interfaces/policy-engine.interface';
import { PolicyLanguageParser } from './parsers/policy-language.parser';

@Injectable()
export class PolicyEngineService implements IPolicyEngine {
  private readonly logger = new Logger(PolicyEngineService.name);
  private policyCache = new Map<string, PolicyRule>();
  private policySetCache = new Map<string, PolicySet>();

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    private readonly eventEmitter: EventEmitter2,
    private readonly parser: PolicyLanguageParser,
    private readonly evaluator: PolicyEvaluator,
  ) {}

  async evaluatePolicy(
    policyId: string,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    
    try {
      // Get policy from cache or database
      const policyRule = await this.getPolicyRule(policyId);
      
      if (!policyRule) {
        throw new Error(`Policy ${policyId} not found`);
      }

      // Evaluate the policy
      const result = await this.evaluator.evaluate(policyRule, context);
      
      // Add evaluation time
      result.evaluationTime = Date.now() - startTime;

      // Emit evaluation event
      await this.eventEmitter.emit('policy.evaluated', {
        policyId,
        context,
        result,
        timestamp: new Date(),
      });

      // Log evaluation
      this.logger.log(
        `Policy ${policyId} evaluated: ${result.allowed ? 'ALLOWED' : 'DENIED'} ` +
        `(${result.evaluationTime}ms)`
      );

      return result;
    } catch (error) {
      this.logger.error(`Error evaluating policy ${policyId}:`, error);
      
      // Return deny result on error
      return {
        allowed: false,
        ruleSatisfied: false,
        ruleId: policyId,
        ruleName: 'Error',
        actions: [{ type: 'deny', message: error.message }],
        reasons: [`Policy evaluation error: ${error.message}`],
        evaluationTime: Date.now() - startTime,
      };
    }
  }

  async evaluatePolicySet(
    policySetId: string,
    context: PolicyContext,
  ): Promise<PolicyEvaluationResult[]> {
    const policySet = await this.getPolicySet(policySetId);
    
    if (!policySet) {
      throw new Error(`Policy set ${policySetId} not found`);
    }

    const results: PolicyEvaluationResult[] = [];

    switch (policySet.combiningAlgorithm) {
      case 'all':
        // All policies must be satisfied
        for (const rule of policySet.rules) {
          const result = await this.evaluator.evaluate(rule, context);
          results.push(result);
          
          if (!result.allowed) {
            break; // Short circuit on first deny
          }
        }
        break;
        
      case 'any':
        // At least one policy must be satisfied
        for (const rule of policySet.rules) {
          const result = await this.evaluator.evaluate(rule, context);
          results.push(result);
          
          if (result.allowed) {
            break; // Short circuit on first allow
          }
        }
        break;
        
      case 'first-applicable':
        // Use the first applicable policy
        for (const rule of policySet.rules) {
          const result = await this.evaluator.evaluate(rule, context);
          
          if (result.ruleSatisfied) {
            results.push(result);
            break;
          }
        }
        break;
    }

    await this.eventEmitter.emit('policy.set.evaluated', {
      policySetId,
      context,
      results,
      timestamp: new Date(),
    });

    return results;
  }

  async validatePolicy(policyCode: string): Promise<boolean> {
    try {
      await this.parser.parse(policyCode);
      return true;
    } catch (error) {
      this.logger.error('Policy validation failed:', error);
      return false;
    }
  }

  async compilePolicy(policyCode: string): Promise<PolicyRule> {
    return await this.parser.parse(policyCode);
  }

  private async getPolicyRule(policyId: string): Promise<PolicyRule | null> {
    // Check cache
    if (this.policyCache.has(policyId)) {
      return this.policyCache.get(policyId);
    }

    // Load from database
    const policy = await this.policyRepository.findOne({
      where: { id: policyId },
    });

    if (!policy || !policy.policyAsCode) {
      return null;
    }

    // Compile policy
    const rule = await this.compilePolicy(policy.policyAsCode);
    
    // Cache the compiled rule
    this.policyCache.set(policyId, rule);

    return rule;
  }

  private async getPolicySet(policySetId: string): Promise<PolicySet | null> {
    // Check cache
    if (this.policySetCache.has(policySetId)) {
      return this.policySetCache.get(policySetId);
    }

    // For now, create a sample policy set
    // In production, would load from database
    const policySet: PolicySet = {
      id: policySetId,
      name: 'Sample Policy Set',
      description: 'Sample policy set for testing',
      version: '1.0.0',
      combiningAlgorithm: 'all',
      enabled: true,
      rules: [],
    };

    // Cache the policy set
    this.policySetCache.set(policySetId, policySet);

    return policySet;
  }

  // Clear caches when policies are updated
  async invalidateCache(policyId?: string): Promise<void> {
    if (policyId) {
      this.policyCache.delete(policyId);
    } else {
      this.policyCache.clear();
      this.policySetCache.clear();
    }
  }
}