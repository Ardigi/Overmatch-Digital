import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import type {
  OpaInput,
  OpaData,
  OpaMetrics,
} from '../shared/types';

export interface PolicyEvaluationRequest {
  input: OpaInput;
  data?: OpaData;
  unknowns?: string[];
}

export interface PolicyEvaluationResult {
  result: any;
  decision_id?: string;
  metrics?: {
    timer_rego_query_eval_ns?: number;
    timer_rego_query_compile_ns?: number;
    timer_server_handler_ns?: number;
  };
}

export interface PolicyCompilationResult {
  result: {
    errors?: Array<{
      code: string;
      message: string;
      location?: {
        file: string;
        row: number;
        col: number;
      };
    }>;
    metrics?: OpaMetrics;
  };
}

export interface OpaPolicy {
  package: string;
  rules: string;
}

@Injectable()
export class OpaService {
  private readonly logger = new Logger(OpaService.name);
  private readonly opaUrl: string;
  private readonly policyPath: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    const opaConfig = this.configService.get('policyService.opa');
    this.opaUrl = opaConfig.url;
    this.policyPath = opaConfig.policyPath;
    this.timeout = opaConfig.timeout;
    this.maxRetries = opaConfig.retries;
  }

  async evaluatePolicy(
    policyPath: string,
    input: OpaInput,
    data?: OpaData
  ): Promise<PolicyEvaluationResult> {
    const url = `${this.opaUrl}/v1/data${policyPath}`;
    const payload: PolicyEvaluationRequest = { input };

    if (data) {
      payload.data = data;
    }

    try {
      const response = await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.post<PolicyEvaluationResult>(url, payload, {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
      );

      return response.data;
    } catch (error) {
      this.handleOpaError(error, 'evaluate policy');
    }
  }

  async compilePolicy(policy: string): Promise<PolicyCompilationResult> {
    const url = `${this.opaUrl}/v1/compile`;
    const payload = {
      query: policy,
      unknowns: ['data.soc2', 'input'],
      options: {
        disableInlining: [],
      },
    };

    try {
      const response = await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.post<PolicyCompilationResult>(url, payload, {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
      );

      return response.data;
    } catch (error) {
      this.handleOpaError(error, 'compile policy');
    }
  }

  async uploadPolicy(policyId: string, policy: OpaPolicy): Promise<void> {
    const url = `${this.opaUrl}/v1/policies/${policyId}`;
    const policyContent = this.buildPolicyContent(policy);

    try {
      await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.put(url, policyContent, {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'text/plain',
            },
          })
        )
      );

      this.logger.log(`Successfully uploaded policy ${policyId} to OPA`);
    } catch (error) {
      this.handleOpaError(error, 'upload policy');
    }
  }

  async deletePolicy(policyId: string): Promise<void> {
    const url = `${this.opaUrl}/v1/policies/${policyId}`;

    try {
      await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.delete(url, {
            timeout: this.timeout,
          })
        )
      );

      this.logger.log(`Successfully deleted policy ${policyId} from OPA`);
    } catch (error) {
      this.handleOpaError(error, 'delete policy');
    }
  }

  async getPolicy(policyId: string): Promise<string> {
    const url = `${this.opaUrl}/v1/policies/${policyId}`;

    try {
      const response = await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.get<{ result: { raw: string } }>(url, {
            timeout: this.timeout,
          })
        )
      );

      return response.data.result.raw;
    } catch (error) {
      this.handleOpaError(error, 'get policy');
    }
  }

  async queryData(path: string): Promise<any> {
    const url = `${this.opaUrl}/v1/data${path}`;

    try {
      const response = await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.get(url, {
            timeout: this.timeout,
          })
        )
      );

      return response.data.result;
    } catch (error) {
      this.handleOpaError(error, 'query data');
    }
  }

  async pushData(path: string, data: any): Promise<void> {
    const url = `${this.opaUrl}/v1/data${path}`;

    try {
      await this.executeWithRetry(() =>
        firstValueFrom(
          this.httpService.put(url, data, {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        )
      );

      this.logger.log(`Successfully pushed data to ${path}`);
    } catch (error) {
      this.handleOpaError(error, 'push data');
    }
  }

  async batchEvaluate(
    evaluations: Array<{
      policyPath: string;
      input: OpaInput;
    }>
  ): Promise<PolicyEvaluationResult[]> {
    const results = await Promise.all(
      evaluations.map(async (evaluation) => {
        try {
          return await this.evaluatePolicy(evaluation.policyPath, evaluation.input);
        } catch (error) {
          this.logger.error(`Failed to evaluate policy ${evaluation.policyPath}:`, error);
          return {
            result: {
              allowed: false,
              reasons: ['Policy evaluation failed'],
            },
          };
        }
      })
    );

    return results;
  }

  generatePolicyId(organizationId: string, policyNumber: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${organizationId}-${policyNumber}`)
      .digest('hex')
      .substring(0, 8);

    return `policy_${policyNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hash}`;
  }

  buildPolicyContent(policy: OpaPolicy): string {
    const imports = [
      'import data.common.controls',
      'import data.common.functions',
      'import input',
    ].join('\n');

    return `package ${policy.package}\n\n${imports}\n\n${policy.rules}`;
  }

  validateRegoSyntax(policy: string): { valid: boolean; errors?: string[] } {
    // Basic Rego syntax validation
    const errors: string[] = [];

    // Check for package declaration
    if (!policy.match(/^package\s+[\w.]+/m)) {
      errors.push('Missing package declaration');
    }

    // Check for unclosed brackets
    const openBrackets = (policy.match(/\{/g) || []).length;
    const closeBrackets = (policy.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Mismatched curly brackets');
    }

    // Check for unclosed square brackets
    const openSquare = (policy.match(/\[/g) || []).length;
    const closeSquare = (policy.match(/\]/g) || []).length;
    if (openSquare !== closeSquare) {
      errors.push('Mismatched square brackets');
    }

    // Check for unclosed parentheses
    const openParen = (policy.match(/\(/g) || []).length;
    const closeParen = (policy.match(/\)/g) || []).length;
    if (openParen !== closeParen) {
      errors.push('Mismatched parentheses');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async executeWithRetry<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const delay = 2 ** retryCount * 1000; // Exponential backoff
        this.logger.warn(
          `Retrying OPA operation (attempt ${retryCount + 1}/${this.maxRetries}) after ${delay}ms`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, retryCount + 1);
      }

      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return (
        !status || // Network error
        status === 429 || // Too many requests
        status === 502 || // Bad gateway
        status === 503 || // Service unavailable
        status === 504 // Gateway timeout
      );
    }
    return false;
  }

  private handleOpaError(error: any, operation: string): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message;
      const details = error.response?.data || {};

      this.logger.error(`OPA ${operation} failed: ${message}`, {
        status,
        details,
        url: error.config?.url,
      });

      throw new HttpException(
        {
          statusCode: status,
          message: `Failed to ${operation}: ${message}`,
          error: 'OPA_ERROR',
          details,
        },
        status
      );
    }

    throw error;
  }
}
