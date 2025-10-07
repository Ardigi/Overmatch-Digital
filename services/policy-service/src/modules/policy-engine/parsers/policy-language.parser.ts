import { Injectable, Logger } from '@nestjs/common';
import type { PolicyAction, PolicyRule } from '../interfaces/policy-engine.interface';
import type { ParsedParameters } from '../../shared/types';

@Injectable()
export class PolicyLanguageParser {
  private readonly logger = new Logger(PolicyLanguageParser.name);

  /**
   * Parse policy code into a PolicyRule
   *
   * Example policy format:
   * ```
   * policy "require-mfa-for-admins" {
   *   description = "Require MFA for admin users"
   *
   *   condition = user.role == "admin" && !user.mfaEnabled
   *
   *   action {
   *     type = "require"
   *     target = "mfa"
   *     message = "MFA is required for admin users"
   *   }
   * }
   * ```
   */
  async parse(policyCode: string): Promise<PolicyRule> {
    try {
      // Remove comments
      const cleanCode = this.removeComments(policyCode);

      // Extract policy block
      const policyMatch = cleanCode.match(/policy\s+"([^"]+)"\s*{([^}]+)}/);
      if (!policyMatch) {
        throw new Error('Invalid policy format: missing policy block');
      }

      const policyName = policyMatch[1];
      const policyBody = policyMatch[2];

      // Extract fields
      const description = this.extractField(policyBody, 'description');
      const condition = this.extractField(policyBody, 'condition');
      const actions = this.extractActions(policyBody);

      if (!condition) {
        throw new Error('Policy must have a condition');
      }

      if (actions.length === 0) {
        throw new Error('Policy must have at least one action');
      }

      return {
        id: this.generatePolicyId(policyName),
        name: policyName,
        description: description || '',
        condition,
        actions,
      };
    } catch (error) {
      this.logger.error('Failed to parse policy:', error);
      throw new Error(`Policy parsing error: ${error.message}`);
    }
  }

  private removeComments(code: string): string {
    // Remove single-line comments
    code = code.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    return code.trim();
  }

  private extractField(body: string, fieldName: string): string | null {
    const regex = new RegExp(`${fieldName}\\s*=\\s*"([^"]*)"`, 'i');
    const match = body.match(regex);
    return match ? match[1] : null;
  }

  private extractActions(body: string): PolicyAction[] {
    const actions: PolicyAction[] = [];
    const actionRegex = /action\s*{([^}]+)}/g;
    let match;

    while ((match = actionRegex.exec(body)) !== null) {
      const actionBody = match[1];
      const action = this.parseAction(actionBody);
      actions.push(action);
    }

    return actions;
  }

  private parseAction(actionBody: string): PolicyAction {
    const typeString = this.extractField(actionBody, 'type');
    const target = this.extractField(actionBody, 'target');
    const message = this.extractField(actionBody, 'message');

    // Extract parameters
    const parametersMatch = actionBody.match(/parameters\s*=\s*{([^}]+)}/);
    const parameters = parametersMatch ? this.parseParameters(parametersMatch[1]) : undefined;

    // Validate and cast type
    if (!typeString || !this.isValidActionType(typeString)) {
      throw new Error('Invalid action type');
    }

    const type = typeString as PolicyAction['type'];

    return {
      type,
      target: target || undefined,
      message: message || undefined,
      parameters,
    };
  }

  private isValidActionType(type: string): type is PolicyAction['type'] {
    return ['allow', 'deny', 'require', 'notify', 'remediate'].includes(type);
  }

  private parseParameters(paramsBody: string): ParsedParameters {
    const params: ParsedParameters = {};
    const lines = paramsBody
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    for (const line of lines) {
      const match = line.match(/(\w+)\s*=\s*(.+)/);
      if (match) {
        const key = match[1];
        const value = this.parseValue(match[2]);
        params[key] = value;
      }
    }

    return params;
  }

  private parseValue(value: string): any {
    value = value.trim();

    // String
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }

    // Number
    if (/^\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Boolean
    if (value === 'true' || value === 'false') {
      return value === 'true';
    }

    // Array
    if (value.startsWith('[') && value.endsWith(']')) {
      return JSON.parse(value);
    }

    // Object
    if (value.startsWith('{') && value.endsWith('}')) {
      return JSON.parse(value);
    }

    // Default to string
    return value;
  }

  private generatePolicyId(name: string): string {
    return `policy-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  }

  /**
   * Validate policy syntax without fully parsing
   */
  async validate(policyCode: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check for policy block
      if (!policyCode.includes('policy')) {
        errors.push('Missing policy declaration');
      }

      // Check for condition
      if (!policyCode.includes('condition')) {
        errors.push('Missing condition statement');
      }

      // Check for action
      if (!policyCode.includes('action')) {
        errors.push('Missing action block');
      }

      // Check for balanced braces
      const openBraces = (policyCode.match(/{/g) || []).length;
      const closeBraces = (policyCode.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces');
      }

      // Check for balanced quotes
      const quotes = (policyCode.match(/"/g) || []).length;
      if (quotes % 2 !== 0) {
        errors.push('Unbalanced quotes');
      }

      // Try to parse if no errors so far
      if (errors.length === 0) {
        await this.parse(policyCode);
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        valid: false,
        errors,
      };
    }
  }
}
