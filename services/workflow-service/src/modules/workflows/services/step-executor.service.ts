import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Control, ErrorResponse, type Evidence, Policy } from '@soc-compliance/contracts';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { firstValueFrom } from 'rxjs';
import type { WorkflowInstance } from '../entities/workflow-instance.entity';
import type { WorkflowStep } from '../entities/workflow-step.entity';
import {
  ExecutionStatus,
  type WorkflowStepExecution,
} from '../entities/workflow-step-execution.entity';

export interface StepExecutionResult {
  success: boolean;
  outputs?: Record<string, any>;
  variables?: Record<string, any>;
  error?: string;
  errorDetails?: Record<string, any>;
  nextStepId?: string;
  shouldRetry?: boolean;
}

@Injectable()
export class StepExecutorService {
  private readonly logger = new Logger(StepExecutorService.name);

  constructor(
    private httpService: HttpService,
    private eventEmitter: EventEmitter2,
    private serviceDiscovery: ServiceDiscoveryService
  ) {}

  async executeStep(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    this.logger.log(`Executing step ${step.name} (${step.type}) for instance ${instance.id}`);

    try {
      // Route to appropriate step handler based on type
      switch (step.type) {
        case 'user_task':
          return await this.executeUserTask(step, instance, execution);

        case 'approval':
          return await this.executeApproval(step, instance, execution);

        case 'system_task':
          return await this.executeSystemTask(step, instance, execution);

        case 'email':
          return await this.executeEmail(step, instance, execution);

        case 'condition':
          return await this.executeCondition(step, instance, execution);

        case 'wait':
          return await this.executeWait(step, instance, execution);

        case 'http':
          return await this.executeHttp(step, instance, execution);

        case 'data_collection':
          return await this.executeDataCollection(step, instance, execution);

        case 'compliance_check':
          return await this.executeComplianceCheck(step, instance, execution);

        case 'evidence_validation':
          return await this.executeEvidenceValidation(step, instance, execution);

        default:
          return await this.executeCustomStep(step, instance, execution);
      }
    } catch (error) {
      this.logger.error(`Error executing step ${step.name}: ${error.message}`, error.stack);

      return {
        success: false,
        error: error.message,
        errorDetails: { stack: error.stack },
        shouldRetry: this.shouldRetryError(error),
      };
    }
  }

  private async executeUserTask(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    // User tasks require manual completion
    // Set to waiting status and emit event
    execution.status = ExecutionStatus.WAITING_APPROVAL;

    this.eventEmitter.emit('workflow.user-task.created', {
      instanceId: instance.id,
      stepId: step.id,
      assignees: step.config?.assignees || [],
      form: step.config?.form,
    });

    return {
      success: true,
      outputs: {
        status: 'waiting_for_user',
        assignees: step.config?.assignees || [],
      },
    };
  }

  private async executeApproval(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    // Check if approval is already complete
    const decision = execution.getApprovalDecision();

    if (decision === 'pending') {
      // Set to waiting for approval
      execution.status = ExecutionStatus.WAITING_APPROVAL;

      this.eventEmitter.emit('workflow.approval.requested', {
        instanceId: instance.id,
        stepId: step.id,
        approvers: step.config?.approvers || [],
        approvalType: step.config?.approvalType || 'single',
      });

      return {
        success: true,
        outputs: {
          status: 'waiting_for_approval',
          approvers: step.config?.approvers || [],
        },
      };
    }

    // Approval decision made
    const approved = decision === 'approved';

    return {
      success: true,
      outputs: {
        decision,
        approved,
        approvals: execution.approvals,
      },
      variables: {
        [`${step.name}_approved`]: approved,
        [`${step.name}_decision`]: decision,
      },
      nextStepId: this.getApprovalNextStep(step, approved),
    };
  }

  private getApprovalNextStep(step: WorkflowStep, approved: boolean): string | undefined {
    if (step.config?.conditions) {
      const condition = approved ? 'approved' : 'rejected';
      return step.config.conditions[condition];
    }

    if (!approved && step.errorStepIds?.length > 0) {
      return step.errorStepIds[0];
    }

    return step.nextStepId;
  }

  private async executeSystemTask(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const action = step.config?.action;
    const parameters = step.config?.parameters || {};

    switch (action) {
      case 'notify_completion':
        return await this.executeNotifyCompletion(step, instance, parameters);

      case 'update_status':
        return await this.executeUpdateStatus(step, instance, parameters);

      case 'calculate':
        return await this.executeCalculation(step, instance, parameters);

      case 'transform_data':
        return await this.executeDataTransformation(step, instance, parameters);

      default:
        // Emit event for custom system tasks
        this.eventEmitter.emit(`workflow.system-task.${action}`, {
          instanceId: instance.id,
          stepId: step.id,
          parameters,
        });

        return {
          success: true,
          outputs: { action, parameters },
        };
    }
  }

  private async executeNotifyCompletion(
    step: WorkflowStep,
    instance: WorkflowInstance,
    parameters: Record<string, any>
  ): Promise<StepExecutionResult> {
    const recipients = parameters.recipients || [];

    this.eventEmitter.emit('workflow.notification.send', {
      type: 'workflow_completed',
      recipients,
      data: {
        workflowName: instance.workflow?.name,
        instanceId: instance.id,
        completedAt: new Date(),
        outputs: instance.outputs,
      },
    });

    return {
      success: true,
      outputs: {
        notified: recipients,
        timestamp: new Date(),
      },
    };
  }

  private async executeUpdateStatus(
    step: WorkflowStep,
    instance: WorkflowInstance,
    parameters: Record<string, any>
  ): Promise<StepExecutionResult> {
    const { entity, entityId, status, fields } = parameters;

    try {
      // Map entity to service and endpoint with proper typing
      const serviceMap: Record<string, { service: string; endpoint: string; type: string }> = {
        control: { service: 'control-service', endpoint: '/api/controls', type: 'Control' },
        evidence: { service: 'evidence-service', endpoint: '/api/evidence', type: 'Evidence' },
        policy: { service: 'policy-service', endpoint: '/api/policies', type: 'Policy' },
        client: { service: 'client-service', endpoint: '/api/clients', type: 'Client' },
        audit: { service: 'audit-service', endpoint: '/api/audits', type: 'Audit' },
      };

      const serviceInfo = serviceMap[entity.toLowerCase()];
      if (!serviceInfo) {
        throw new Error(
          `Unknown entity type: ${entity}. Supported types: ${Object.keys(serviceMap).join(', ')}`
        );
      }

      // Make actual HTTP call to update the entity using ServiceDiscoveryService
      const response = await this.serviceDiscovery.callService<any>(
        serviceInfo.service,
        'PATCH',
        `${serviceInfo.endpoint}/${entityId}`,
        {
          status,
          ...fields,
          // Add workflow context for audit trail
          workflowContext: {
            instanceId: instance.id,
            stepName: step.name,
            updatedAt: new Date(),
          },
        }
      );

      if (!response.success) {
        const errorMsg = response.error?.message || 'Service call failed';
        this.logger.error(`Failed to update ${entity} ${entityId}: ${errorMsg}`, {
          entity,
          entityId,
          updates: { status, ...fields },
          error: response.error,
        });
        throw new Error(errorMsg);
      }

      // Emit event for audit trail with enhanced data
      this.eventEmitter.emit('workflow.entity.updated', {
        entity,
        entityId,
        entityType: serviceInfo.type,
        updates: { status, ...fields },
        workflowInstanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        organizationId: instance.organizationId,
        userId: instance.context.userId,
        response: response.data,
        timestamp: new Date(),
      });

      return {
        success: true,
        outputs: {
          entity,
          entityId,
          updatedFields: { status, ...fields },
          response: response.data,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update ${entity} ${entityId}: ${error.message}`);

      return {
        success: false,
        error: error.message,
        errorDetails: {
          entity,
          entityId,
          attempted: { status, ...fields },
        },
      };
    }
  }

  private async executeCalculation(
    step: WorkflowStep,
    instance: WorkflowInstance,
    parameters: Record<string, any>
  ): Promise<StepExecutionResult> {
    // Simple calculation implementation
    // In production, use a proper expression evaluator
    const { expression, inputs } = parameters;

    try {
      // This is a placeholder - implement actual calculation logic
      const result = this.evaluateExpression(expression, {
        ...instance.inputs,
        ...instance.variables,
        ...inputs,
      });

      return {
        success: true,
        outputs: { result },
        variables: { [parameters.outputVariable || 'calculationResult']: result },
      };
    } catch (error) {
      return {
        success: false,
        error: `Calculation failed: ${error.message}`,
      };
    }
  }

  private async executeDataTransformation(
    step: WorkflowStep,
    instance: WorkflowInstance,
    parameters: Record<string, any>
  ): Promise<StepExecutionResult> {
    const { mapping, source } = parameters;
    const sourceData = source === 'inputs' ? instance.inputs : instance.outputs;

    try {
      const transformed = this.transformData(sourceData, mapping);

      return {
        success: true,
        outputs: transformed,
        variables: transformed,
      };
    } catch (error) {
      return {
        success: false,
        error: `Data transformation failed: ${error.message}`,
      };
    }
  }

  private async executeEmail(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    const recipients = this.resolveRecipients(config.recipients || [], instance);
    const template = config.template || 'default';

    this.eventEmitter.emit('workflow.email.send', {
      instanceId: instance.id,
      stepId: step.id,
      recipients,
      template,
      data: {
        ...instance.inputs,
        ...instance.outputs,
        workflowName: instance.workflow?.name,
      },
    });

    return {
      success: true,
      outputs: {
        recipients,
        template,
        sentAt: new Date(),
      },
    };
  }

  private async executeCondition(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const conditions = step.config?.conditions || [];

    for (const condition of conditions) {
      if (this.evaluateCondition(condition.expression, instance)) {
        return {
          success: true,
          outputs: {
            matchedCondition: condition.expression,
            nextStep: condition.nextStepId,
          },
          nextStepId: condition.nextStepId,
        };
      }
    }

    // No condition matched - use default next step
    return {
      success: true,
      outputs: {
        matchedCondition: null,
        nextStep: step.nextStepId,
      },
      nextStepId: step.nextStepId,
    };
  }

  private async executeWait(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    const duration = config.duration || 0; // seconds
    const until = config.until; // timestamp or expression

    // Calculate wait time
    let waitUntil: Date;
    if (until) {
      waitUntil = new Date(until);
    } else {
      waitUntil = new Date(Date.now() + duration * 1000);
    }

    // Check if wait is complete
    if (new Date() >= waitUntil) {
      return {
        success: true,
        outputs: {
          waitCompleted: true,
          completedAt: new Date(),
        },
      };
    }

    // Still waiting
    execution.status = ExecutionStatus.RUNNING;
    execution.metadata = { waitUntil };

    // Schedule continuation
    this.eventEmitter.emit('workflow.wait.schedule', {
      instanceId: instance.id,
      stepId: step.id,
      waitUntil,
    });

    return {
      success: true,
      outputs: {
        waiting: true,
        waitUntil,
      },
    };
  }

  private async executeHttp(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    let { url, method = 'GET', headers = {}, body, timeout = 30000, service } = config;

    try {
      let response;

      // If service name is provided, use ServiceDiscoveryService
      if (service) {
        // Replace variables in URL, headers, and body
        url = this.replaceVariables(url, instance);
        headers = this.replaceVariablesInObject(headers, instance);
        if (body) {
          body = this.replaceVariablesInObject(body, instance);
        }

        // Log the request
        this.logger.log(`Executing HTTP ${method} request to ${service}${url}`);

        // Use ServiceDiscoveryService for inter-service communication
        const serviceResponse = await this.serviceDiscovery.callService(
          service.toLowerCase().includes('-service') ? service : `${service}-service`,
          method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            timeout,
          }
        );

        if (!serviceResponse.success) {
          throw new Error(serviceResponse.error?.message || 'Service call failed');
        }

        response = {
          status: 200, // ServiceDiscoveryService doesn't return HTTP status codes
          data: serviceResponse.data,
          headers: {},
        };
      } else {
        // External HTTP request - use HttpService directly
        // Replace variables in URL, headers, and body
        url = this.replaceVariables(url, instance);
        headers = this.replaceVariablesInObject(headers, instance);
        if (body) {
          body = this.replaceVariablesInObject(body, instance);
        }

        // Log the request
        this.logger.log(`Executing HTTP ${method} request to ${url}`);

        // Make the actual HTTP request
        response = await firstValueFrom(
          this.httpService.request({
            url,
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            data: body,
            timeout,
          })
        );
      }

      // Emit success event
      this.eventEmitter.emit('workflow.http.success', {
        instanceId: instance.id,
        stepId: step.id,
        request: { url, method, headers, body },
        response: {
          status: response.status,
          data: response.data,
        },
      });

      return {
        success: true,
        outputs: {
          status: response.status,
          data: response.data,
          headers: response.headers,
        },
      };
    } catch (error) {
      this.logger.error(`HTTP request failed: ${error.message}`, error.stack);

      // Emit failure event
      this.eventEmitter.emit('workflow.http.failed', {
        instanceId: instance.id,
        stepId: step.id,
        request: { url, method, headers, body },
        error: error.message,
      });

      return {
        success: false,
        error: `HTTP request failed: ${error.message}`,
        shouldRetry: true,
      };
    }
  }

  private async executeCustomStep(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    // Emit event for custom step types
    this.eventEmitter.emit(`workflow.custom-step.${step.type}`, {
      instanceId: instance.id,
      stepId: step.id,
      config: step.config,
      context: {
        inputs: instance.inputs,
        outputs: instance.outputs,
        variables: instance.variables,
      },
    });

    return {
      success: true,
      outputs: {
        type: step.type,
        executed: true,
      },
    };
  }

  private resolveRecipients(recipients: string[], instance: WorkflowInstance): string[] {
    return recipients.map((recipient) => {
      // Handle variable substitution
      if (recipient.startsWith('{{') && recipient.endsWith('}}')) {
        const variable = recipient.slice(2, -2).trim();
        return this.getVariableValue(variable, instance) || recipient;
      }
      return recipient;
    });
  }

  private getVariableValue(path: string, instance: WorkflowInstance): any {
    const parts = path.split('.');
    let value: any = {
      inputs: instance.inputs,
      outputs: instance.outputs,
      variables: instance.variables,
    };

    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) break;
    }

    return value;
  }

  private evaluateCondition(expression: string, instance: WorkflowInstance): boolean {
    // Simple placeholder - use proper expression evaluator in production
    try {
      // This is a simplified implementation
      // In production, use a safe expression evaluator like expr-eval
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  private evaluateExpression(expression: string, context: Record<string, any>): any {
    // Simple placeholder - use proper expression evaluator in production
    // This would evaluate mathematical or logical expressions safely
    return 0; // Placeholder
  }

  private transformData(data: any, mapping: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string' && value.startsWith('$.')) {
        // JSONPath-like mapping
        const path = value.slice(2);
        result[key] = this.getValueByPath(data, path);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }

  private shouldRetryError(error: any): boolean {
    // Determine if error is retryable
    const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'Network Error'];

    return retryableErrors.some((msg) => error.message?.includes(msg) || error.code === msg);
  }

  private replaceVariables(str: string, instance: WorkflowInstance): string {
    const context = {
      ...instance.context.inputs,
      ...instance.context.outputs,
      ...instance.context.variables,
      ...instance.context.metadata,
    };

    // Replace {{variable}} patterns
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  private replaceVariablesInObject(obj: any, instance: WorkflowInstance): any {
    if (typeof obj === 'string') {
      return this.replaceVariables(obj, instance);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replaceVariablesInObject(item, instance));
    }

    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariablesInObject(value, instance);
      }
      return result;
    }

    return obj;
  }

  // ==========================================
  // Enhanced Service Integration Methods
  // ==========================================

  /**
   * Execute data collection step with real service calls
   */
  private async executeDataCollection(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    const { source, endpoint, method = 'GET', filters } = config;

    if (!source || !endpoint) {
      return {
        success: false,
        error: 'Data collection step requires source and endpoint configuration',
      };
    }

    try {
      // Build query parameters from filters and instance context
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          const resolvedValue = this.replaceVariables(String(value), instance);
          params.append(key, resolvedValue);
        });
      }

      // Add organization context
      params.append('organizationId', instance.organizationId);

      const queryString = params.toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await this.serviceDiscovery.callService<any>(
        source.toLowerCase().includes('-service') ? source : `${source}-service`,
        method as 'GET' | 'POST',
        fullEndpoint
      );

      if (!response.success) {
        return {
          success: false,
          error: `Data collection failed: ${response.error?.message || 'Unknown error'}`,
          shouldRetry: true,
        };
      }

      return {
        success: true,
        outputs: {
          data: response.data,
          source,
          endpoint: fullEndpoint,
          collectedAt: new Date(),
          recordCount: Array.isArray(response.data?.items)
            ? response.data.items.length
            : Array.isArray(response.data)
              ? response.data.length
              : 1,
        },
        variables: {
          [`${step.name}_data`]: response.data,
          [`${step.name}_count`]: Array.isArray(response.data?.items)
            ? response.data.items.length
            : Array.isArray(response.data)
              ? response.data.length
              : 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Data collection error: ${error.message}`,
        shouldRetry: this.shouldRetryError(error),
      };
    }
  }

  /**
   * Execute compliance check step with real service calls
   */
  private async executeComplianceCheck(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    const { controlIds, frameworks, checkType = 'implementation' } = config;

    try {
      // Get organization controls
      const controlsResponse = await this.serviceDiscovery.callService<{ items: Control[] }>(
        'control-service',
        'GET',
        `/api/controls?organizationId=${instance.organizationId}&limit=100`
      );

      if (!controlsResponse.success) {
        return {
          success: false,
          error: 'Failed to retrieve controls for compliance check',
          shouldRetry: true,
        };
      }

      const controls = controlsResponse.data?.items || [];

      // Filter controls based on configuration
      let relevantControls = controls;
      if (controlIds && controlIds.length > 0) {
        relevantControls = controls.filter((c) => controlIds.includes(c.id));
      }
      if (frameworks && frameworks.length > 0) {
        relevantControls = relevantControls.filter(
          (c) => c.frameworks && c.frameworks.some((f) => frameworks.includes(f))
        );
      }

      // Calculate compliance metrics
      const totalControls = relevantControls.length;
      const implementedControls = relevantControls.filter(
        (c) => c.implementationStatus === 'IMPLEMENTED'
      ).length;
      const effectiveControls = relevantControls.filter(
        (c) => c.effectiveness === 'EFFECTIVE'
      ).length;

      const implementationScore =
        totalControls > 0 ? (implementedControls / totalControls) * 100 : 0;
      const effectivenessScore = totalControls > 0 ? (effectiveControls / totalControls) * 100 : 0;
      const overallScore = (implementationScore + effectivenessScore) / 2;

      // Determine pass/fail based on threshold
      const threshold = config.threshold || 80;
      const passed = overallScore >= threshold;

      return {
        success: true,
        outputs: {
          checkType,
          totalControls,
          implementedControls,
          effectiveControls,
          implementationScore: Math.round(implementationScore * 100) / 100,
          effectivenessScore: Math.round(effectivenessScore * 100) / 100,
          overallScore: Math.round(overallScore * 100) / 100,
          threshold,
          passed,
          checkedAt: new Date(),
          controls: relevantControls.map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            implementationStatus: c.implementationStatus,
            effectiveness: c.effectiveness,
          })),
        },
        variables: {
          [`${step.name}_score`]: overallScore,
          [`${step.name}_passed`]: passed,
          [`${step.name}_total_controls`]: totalControls,
        },
        nextStepId: this.getComplianceNextStep(step, passed),
      };
    } catch (error) {
      return {
        success: false,
        error: `Compliance check error: ${error.message}`,
        shouldRetry: this.shouldRetryError(error),
      };
    }
  }

  private getComplianceNextStep(step: WorkflowStep, passed: boolean): string | undefined {
    if (step.config?.conditions) {
      const condition = passed ? 'passed' : 'failed';
      return step.config.conditions[condition];
    }

    if (!passed && step.errorStepIds?.length > 0) {
      return step.errorStepIds[0];
    }

    return step.nextStepId;
  }

  /**
   * Execute evidence validation step
   */
  private async executeEvidenceValidation(
    step: WorkflowStep,
    instance: WorkflowInstance,
    execution: WorkflowStepExecution
  ): Promise<StepExecutionResult> {
    const config = step.config || {};
    const { controlIds, projectId } = config;

    try {
      // Get evidence for the project/controls
      const params = new URLSearchParams();
      if (projectId) {
        params.append('projectId', projectId);
      }
      if (controlIds && controlIds.length > 0) {
        controlIds.forEach((id) => params.append('controlIds', id));
      }

      const evidenceResponse = await this.serviceDiscovery.callService<{ items: Evidence[] }>(
        'evidence-service',
        'GET',
        `/api/evidence?${params.toString()}`
      );

      if (!evidenceResponse.success) {
        return {
          success: false,
          error: 'Failed to retrieve evidence for validation',
          shouldRetry: true,
        };
      }

      const evidence = evidenceResponse.data?.items || [];

      // Validate evidence
      const totalEvidence = evidence.length;
      const verifiedEvidence = evidence.filter((e) => e.verified).length;
      const automatedEvidence = evidence.filter((e) => e.isAutomated).length;
      const expiredEvidence = evidence.filter(
        (e) => e.expiryDate && new Date(e.expiryDate) < new Date()
      ).length;

      const verificationRate = totalEvidence > 0 ? (verifiedEvidence / totalEvidence) * 100 : 0;
      const automationRate = totalEvidence > 0 ? (automatedEvidence / totalEvidence) * 100 : 0;

      // Determine validation result
      const minVerificationRate = config.minVerificationRate || 90;
      const maxExpiredRate = config.maxExpiredRate || 10;
      const expiredRate = totalEvidence > 0 ? (expiredEvidence / totalEvidence) * 100 : 0;

      const validationPassed =
        verificationRate >= minVerificationRate && expiredRate <= maxExpiredRate;

      return {
        success: true,
        outputs: {
          totalEvidence,
          verifiedEvidence,
          automatedEvidence,
          expiredEvidence,
          verificationRate: Math.round(verificationRate * 100) / 100,
          automationRate: Math.round(automationRate * 100) / 100,
          expiredRate: Math.round(expiredRate * 100) / 100,
          validationPassed,
          validatedAt: new Date(),
          evidenceSummary: evidence.map((e) => ({
            id: e.id,
            title: e.title,
            type: e.type,
            verified: e.verified,
            isAutomated: e.isAutomated,
            collectedDate: e.collectedDate,
            expiryDate: e.expiryDate,
          })),
        },
        variables: {
          [`${step.name}_validation_passed`]: validationPassed,
          [`${step.name}_verification_rate`]: verificationRate,
          [`${step.name}_total_evidence`]: totalEvidence,
        },
        nextStepId: this.getValidationNextStep(step, validationPassed),
      };
    } catch (error) {
      return {
        success: false,
        error: `Evidence validation error: ${error.message}`,
        shouldRetry: this.shouldRetryError(error),
      };
    }
  }

  private getValidationNextStep(step: WorkflowStep, passed: boolean): string | undefined {
    if (step.config?.conditions) {
      const condition = passed ? 'passed' : 'failed';
      return step.config.conditions[condition];
    }

    if (!passed && step.errorStepIds?.length > 0) {
      return step.errorStepIds[0];
    }

    return step.nextStepId;
  }
}
