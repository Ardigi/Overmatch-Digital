import { Injectable, Logger } from '@nestjs/common';
const safeEval = require('safe-eval');
import type {
  PolicyContext,
  PolicyEvaluationResult,
  PolicyRule,
} from '../interfaces/policy-engine.interface';

@Injectable()
export class PolicyEvaluator {
  private readonly logger = new Logger(PolicyEvaluator.name);

  async evaluate(rule: PolicyRule, context: PolicyContext): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();

    try {
      // Build evaluation context
      const evalContext = this.buildEvaluationContext(context);

      // Evaluate the condition
      const conditionResult = await this.evaluateCondition(rule.condition, evalContext);

      // Determine if rule is satisfied
      const ruleSatisfied = conditionResult === true;

      // Determine if action is allowed
      let allowed = false;
      const applicableActions = [];

      if (ruleSatisfied) {
        for (const action of rule.actions) {
          applicableActions.push(action);

          if (action.type === 'allow') {
            allowed = true;
          } else if (action.type === 'deny') {
            allowed = false;
            break; // Deny takes precedence
          }
        }
      }

      // Build reasons
      const reasons = this.buildReasons(rule, ruleSatisfied, allowed);

      return {
        allowed,
        ruleSatisfied,
        ruleId: rule.id,
        ruleName: rule.name,
        actions: applicableActions,
        reasons,
        metadata: {
          condition: rule.condition,
          contextUsed: evalContext,
        },
        evaluationTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Error evaluating rule ${rule.id}:`, error);

      return {
        allowed: false,
        ruleSatisfied: false,
        ruleId: rule.id,
        ruleName: rule.name,
        actions: [{ type: 'deny', message: 'Evaluation error' }],
        reasons: [`Evaluation error: ${error.message}`],
        evaluationTime: Date.now() - startTime,
      };
    }
  }

  private buildEvaluationContext(context: PolicyContext): any {
    return {
      // Subject context
      user: context.subject.attributes,
      subject: context.subject,

      // Resource context
      resource: context.resource,

      // Action context
      action: context.action,

      // Environment context
      env: context.environment,
      environment: context.environment,

      // Additional data
      data: context.data || {},

      // Helper functions
      now: () => new Date(),
      contains: (array: any[], value: any) => array && array.includes(value),
      matches: (value: string, pattern: string) => new RegExp(pattern).test(value),
      between: (value: number, min: number, max: number) => value >= min && value <= max,
    };
  }

  private async evaluateCondition(condition: string, context: any): Promise<any> {
    try {
      // Sanitize the condition to prevent code injection
      const sanitizedCondition = this.sanitizeCondition(condition);
      
      // Use a safe expression evaluator instead of new Function()
      // This prevents arbitrary code execution
      const result = this.safeEvaluateExpression(sanitizedCondition, context);

      this.logger.debug(`Condition "${sanitizedCondition}" evaluated to: ${result}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to evaluate condition "${condition}":`, error);
      throw error;
    }
  }

  private sanitizeCondition(condition: string): string {
    // Remove potentially dangerous characters and patterns
    // Only allow safe operators and property access
    const dangerousPatterns = [
      /process\./gi,
      /require\(/gi,
      /import\(/gi,
      /eval\(/gi,
      /Function\(/gi,
      /setTimeout\(/gi,
      /setInterval\(/gi,
      /\bexec\b/gi,
      /\bspawn\b/gi,
      /\.__proto__/gi,
      /\bconstructor\b/gi,
      /\bprototype\b/gi,
    ];

    let sanitized = condition;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error(`Dangerous pattern detected in condition: ${pattern}`);
      }
    }

    return sanitized;
  }

  private safeEvaluateExpression(expression: string, context: any): any {
    // Create a restricted sandbox for evaluation
    const sandbox = {
      ...context,
      // Explicitly block dangerous globals
      process: undefined,
      require: undefined,
      module: undefined,
      exports: undefined,
      global: undefined,
      __dirname: undefined,
      __filename: undefined,
      Buffer: undefined,
      setImmediate: undefined,
      clearImmediate: undefined,
      setTimeout: undefined,
      clearTimeout: undefined,
      setInterval: undefined,
      clearInterval: undefined,
      eval: undefined,
      Function: undefined,
    };

    // Use a proper expression parser or safe-eval library
    // For now, we'll use a basic safe evaluation approach
    try {
      // Parse and validate the expression structure first
      this.validateExpressionStructure(expression);
      
      // Use a safe evaluation library or implement a custom parser
      // This is a simplified version - in production, use a proper expression evaluator
      return this.customSafeEvaluator(expression, sandbox);
    } catch (error) {
      throw new Error(`Safe evaluation failed: ${error.message}`);
    }
  }

  private validateExpressionStructure(expression: string): void {
    // Validate that the expression only contains allowed operators and patterns
    const allowedPattern = /^[a-zA-Z0-9_\.\s\(\)\[\]\{\}"'\+\-\*\/\%\=\!\<\>\&\|\?\:,]+$/;
    if (!allowedPattern.test(expression)) {
      throw new Error('Expression contains invalid characters');
    }
  }

  private customSafeEvaluator(expression: string, context: any): any {
    // This is a simplified safe evaluator
    // In production, use a proper expression parsing library like expr-eval or jsep
    
    // For now, we'll use a very restricted evaluation that only allows simple comparisons
    // This prevents code injection while still allowing policy evaluation
    
    // Parse simple comparisons (e.g., "user.role == 'admin'")
    const comparisonMatch = expression.match(/^([\w\.]+)\s*(==|!=|<|>|<=|>=)\s*["']?([^"']+)["']?$/);
    if (comparisonMatch) {
      const [, path, operator, value] = comparisonMatch;
      const leftValue = this.getValueFromPath(context, path);
      const rightValue = this.parseValue(value);
      
      switch (operator) {
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        case '<': return leftValue < rightValue;
        case '>': return leftValue > rightValue;
        case '<=': return leftValue <= rightValue;
        case '>=': return leftValue >= rightValue;
        default: throw new Error(`Unknown operator: ${operator}`);
      }
    }
    
    // Parse logical operations (e.g., "user.role == 'admin' && user.mfaEnabled")
    if (expression.includes('&&') || expression.includes('||')) {
      const parts = expression.split(/\s*(&&|\|\|)\s*/);
      let result = this.customSafeEvaluator(parts[0], context);
      
      for (let i = 1; i < parts.length; i += 2) {
        const operator = parts[i];
        const nextValue = this.customSafeEvaluator(parts[i + 1], context);
        
        if (operator === '&&') {
          result = result && nextValue;
        } else if (operator === '||') {
          result = result || nextValue;
        }
      }
      
      return result;
    }
    
    // Parse negation (e.g., "!user.mfaEnabled")
    if (expression.startsWith('!')) {
      return !this.customSafeEvaluator(expression.substring(1).trim(), context);
    }
    
    // Parse simple property access (e.g., "user.mfaEnabled")
    if (/^[\w\.]+$/.test(expression)) {
      return this.getValueFromPath(context, expression);
    }
    
    throw new Error(`Cannot evaluate expression: ${expression}`);
  }

  private getValueFromPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    
    return current;
  }

  private parseValue(value: string): any {
    // Remove quotes if present
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    
    // Parse numbers
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Parse booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;
    
    return trimmed;
  }

  private buildReasons(rule: PolicyRule, ruleSatisfied: boolean, allowed: boolean): string[] {
    const reasons: string[] = [];

    if (!ruleSatisfied) {
      reasons.push(`Rule condition not satisfied: ${rule.condition}`);
    } else {
      reasons.push(`Rule condition satisfied: ${rule.condition}`);
    }

    if (allowed) {
      reasons.push(`Access allowed by rule: ${rule.name}`);
    } else {
      reasons.push(`Access denied by rule: ${rule.name}`);
    }

    // Add action reasons
    for (const action of rule.actions) {
      if (action.message) {
        reasons.push(action.message);
      }
    }

    return reasons;
  }

  /**
   * Evaluate multiple conditions with logical operators
   */
  async evaluateCompoundCondition(
    conditions: string[],
    operator: 'AND' | 'OR',
    context: any
  ): Promise<boolean> {
    if (operator === 'AND') {
      for (const condition of conditions) {
        const result = await this.evaluateCondition(condition, context);
        if (!result) return false;
      }
      return true;
    } else {
      for (const condition of conditions) {
        const result = await this.evaluateCondition(condition, context);
        if (result) return true;
      }
      return false;
    }
  }
}
