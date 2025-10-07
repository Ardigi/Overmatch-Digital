import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SagaState } from './entities/saga-state.entity';
import { SagaStep } from './entities/saga-step.entity';
import { EnhancedKafkaService } from '../events/enhanced-kafka.service';

export enum SagaStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPENSATING = 'compensating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum StepStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  COMPENSATION_FAILED = 'compensation_failed',
}

export interface SagaDefinition {
  name: string;
  steps: StepDefinition[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface StepDefinition {
  name: string;
  service: string;
  action: string;
  compensateAction?: string;
  input?: Record<string, any>;
  timeout?: number;
  retryable?: boolean;
  maxRetries?: number;
  dependsOn?: string[];
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialInterval: number;
  maxInterval: number;
}

export interface SagaContext {
  sagaId: string;
  correlationId: string;
  initiator: string;
  organizationId: string;
  userId: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
}

export interface StepResult {
  stepName: string;
  status: StepStatus;
  output?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
}

@Injectable()
export class SagaOrchestratorService {
  private readonly logger = new Logger(SagaOrchestratorService.name);
  private readonly activeSagas = new Map<string, SagaDefinition>();
  private readonly stepHandlers = new Map<string, Function>();
  private readonly compensationHandlers = new Map<string, Function>();

  constructor(
    @InjectRepository(SagaState)
    private sagaStateRepository: Repository<SagaState>,
    @InjectRepository(SagaStep)
    private sagaStepRepository: Repository<SagaStep>,
    private eventEmitter: EventEmitter2,
    private kafkaService: EnhancedKafkaService,
  ) {
    this.registerBuiltInSagas();
    this.startSagaMonitoring();
  }

  /**
   * Start a new saga execution
   */
  async startSaga(
    definition: SagaDefinition,
    context: Partial<SagaContext>,
  ): Promise<string> {
    const sagaId = uuidv4();
    const correlationId = context.correlationId || uuidv4();

    // Create saga state
    const sagaState = this.sagaStateRepository.create({
      id: sagaId,
      name: definition.name,
      status: SagaStatus.PENDING,
      correlationId,
      context: {
        ...context,
        sagaId,
        correlationId,
      } as SagaContext,
      startedAt: new Date(),
      timeout: definition.timeout || 3600000, // 1 hour default
    });

    await this.sagaStateRepository.save(sagaState);

    // Create steps
    const steps = await this.createSagaSteps(sagaId, definition.steps);

    // Start execution
    this.executeSaga(sagaId, definition, sagaState.context as SagaContext).catch(error => {
      this.logger.error(`Saga execution failed: ${sagaId}`, error);
      this.handleSagaFailure(sagaId, error);
    });

    this.logger.log(`Saga started: ${sagaId} - ${definition.name}`);

    // Emit saga started event
    await this.kafkaService.publishEvent({
      eventType: 'saga.started',
      entityId: sagaId,
      organizationId: context.organizationId,
      userId: context.userId,
      correlationId,
      payload: {
        sagaName: definition.name,
        context,
      },
    });

    return sagaId;
  }

  /**
   * Execute saga steps
   */
  private async executeSaga(
    sagaId: string,
    definition: SagaDefinition,
    context: SagaContext,
  ): Promise<void> {
    const saga = await this.sagaStateRepository.findOne({
      where: { id: sagaId },
      relations: ['steps'],
    });

    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    // Update status to running
    saga.status = SagaStatus.RUNNING;
    await this.sagaStateRepository.save(saga);

    const steps = await this.sagaStepRepository.find({
      where: { sagaId },
      order: { sequence: 'ASC' },
    });

    const stepResults: Map<string, StepResult> = new Map();

    try {
      // Execute steps sequentially (could be enhanced for parallel execution)
      for (const step of steps) {
        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          const dependenciesMet = step.dependsOn.every(dep => {
            const depResult = stepResults.get(dep);
            return depResult && depResult.status === StepStatus.COMPLETED;
          });

          if (!dependenciesMet) {
            throw new Error(`Dependencies not met for step: ${step.name}`);
          }
        }

        // Execute step
        const result = await this.executeStep(step, context, stepResults);
        stepResults.set(step.name, result);

        if (result.status === StepStatus.FAILED) {
          throw new Error(`Step failed: ${step.name} - ${result.error}`);
        }
      }

      // All steps completed successfully
      saga.status = SagaStatus.COMPLETED;
      saga.completedAt = new Date();
      saga.result = Object.fromEntries(stepResults);
      await this.sagaStateRepository.save(saga);

      // Emit completion event
      await this.kafkaService.publishEvent({
        eventType: 'saga.completed',
        entityId: sagaId,
        organizationId: context.organizationId,
        userId: context.userId,
        correlationId: context.correlationId,
        payload: {
          sagaName: definition.name,
          results: saga.result,
        },
      });

      this.logger.log(`Saga completed: ${sagaId}`);
    } catch (error) {
      this.logger.error(`Saga failed: ${sagaId}`, error);
      
      // Start compensation
      await this.compensateSaga(sagaId, definition, context, stepResults);
      
      // Update saga status
      saga.status = SagaStatus.FAILED;
      saga.failedAt = new Date();
      saga.error = error.message;
      await this.sagaStateRepository.save(saga);

      // Emit failure event
      await this.kafkaService.publishEvent({
        eventType: 'saga.failed',
        entityId: sagaId,
        organizationId: context.organizationId,
        userId: context.userId,
        correlationId: context.correlationId,
        payload: {
          sagaName: definition.name,
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Execute a single saga step
   */
  private async executeStep(
    step: SagaStep,
    context: SagaContext,
    previousResults: Map<string, StepResult>,
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = step.maxRetries || 3;

    step.status = StepStatus.EXECUTING;
    step.startedAt = new Date();
    await this.sagaStepRepository.save(step);

    while (retryCount <= maxRetries) {
      try {
        // Prepare step input
        const input = this.prepareStepInput(step, context, previousResults);

        // Execute step action
        const output = await this.executeStepAction(step, input, context);

        // Update step status
        step.status = StepStatus.COMPLETED;
        step.completedAt = new Date();
        step.output = output;
        step.retryCount = retryCount;
        await this.sagaStepRepository.save(step);

        return {
          stepName: step.name,
          status: StepStatus.COMPLETED,
          output,
          executionTime: Date.now() - startTime,
          retryCount,
        };
      } catch (error) {
        retryCount++;
        
        if (retryCount > maxRetries || !step.retryable) {
          step.status = StepStatus.FAILED;
          step.failedAt = new Date();
          step.error = error.message;
          step.retryCount = retryCount;
          await this.sagaStepRepository.save(step);

          return {
            stepName: step.name,
            status: StepStatus.FAILED,
            error: error.message,
            executionTime: Date.now() - startTime,
            retryCount,
          };
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.logger.warn(`Retrying step ${step.name} (attempt ${retryCount}/${maxRetries})`);
      }
    }

    throw new Error(`Step ${step.name} failed after ${maxRetries} retries`);
  }

  /**
   * Execute step action via Kafka or direct handler
   */
  private async executeStepAction(
    step: SagaStep,
    input: any,
    context: SagaContext,
  ): Promise<any> {
    // Check for local handler
    const handlerKey = `${step.service}.${step.action}`;
    const handler = this.stepHandlers.get(handlerKey);

    if (handler) {
      return await handler(input, context);
    }

    // Execute via Kafka event
    const eventType = `saga.step.${step.service}.${step.action}`;
    await this.kafkaService.publishEvent({
      eventType,
      correlationId: context.correlationId,
      causationId: context.sagaId,
      organizationId: context.organizationId,
      userId: context.userId,
      payload: {
        sagaId: context.sagaId,
        stepName: step.name,
        action: step.action,
        input,
      },
    });

    // Wait for response (with timeout)
    return await this.waitForStepResponse(context.sagaId, step.name, step.timeout || 30000);
  }

  /**
   * Compensate failed saga
   */
  private async compensateSaga(
    sagaId: string,
    definition: SagaDefinition,
    context: SagaContext,
    executedSteps: Map<string, StepResult>,
  ): Promise<void> {
    this.logger.warn(`Starting saga compensation: ${sagaId}`);

    const saga = await this.sagaStateRepository.findOne({
      where: { id: sagaId },
    });

    if (!saga) return;

    saga.status = SagaStatus.COMPENSATING;
    await this.sagaStateRepository.save(saga);

    // Get completed steps in reverse order
    const stepsToCompensate = Array.from(executedSteps.entries())
      .filter(([_, result]) => result.status === StepStatus.COMPLETED)
      .reverse();

    for (const [stepName, stepResult] of stepsToCompensate) {
      const stepDef = definition.steps.find(s => s.name === stepName);
      if (!stepDef || !stepDef.compensateAction) continue;

      try {
        await this.executeCompensation(stepDef, stepResult, context);
        
        // Update step status
        const step = await this.sagaStepRepository.findOne({
          where: { sagaId, name: stepName },
        });
        if (step) {
          step.status = StepStatus.COMPENSATED;
          step.compensatedAt = new Date();
          await this.sagaStepRepository.save(step);
        }
      } catch (error) {
        this.logger.error(`Compensation failed for step ${stepName}:`, error);
        
        // Update step status
        const step = await this.sagaStepRepository.findOne({
          where: { sagaId, name: stepName },
        });
        if (step) {
          step.status = StepStatus.COMPENSATION_FAILED;
          step.compensationError = error.message;
          await this.sagaStepRepository.save(step);
        }
      }
    }

    // Emit compensation completed event
    await this.kafkaService.publishEvent({
      eventType: 'saga.compensated',
      entityId: sagaId,
      organizationId: context.organizationId,
      userId: context.userId,
      correlationId: context.correlationId,
      payload: {
        sagaName: definition.name,
      },
    });
  }

  /**
   * Execute compensation action
   */
  private async executeCompensation(
    stepDef: StepDefinition,
    stepResult: StepResult,
    context: SagaContext,
  ): Promise<void> {
    const handlerKey = `${stepDef.service}.${stepDef.compensateAction}`;
    const handler = this.compensationHandlers.get(handlerKey);

    if (handler) {
      await handler(stepResult.output, context);
      return;
    }

    // Execute via Kafka event
    const eventType = `saga.compensate.${stepDef.service}.${stepDef.compensateAction}`;
    await this.kafkaService.publishEvent({
      eventType,
      correlationId: context.correlationId,
      causationId: context.sagaId,
      organizationId: context.organizationId,
      userId: context.userId,
      payload: {
        sagaId: context.sagaId,
        stepName: stepDef.name,
        action: stepDef.compensateAction,
        originalOutput: stepResult.output,
      },
    });

    // Wait for compensation response
    await this.waitForCompensationResponse(context.sagaId, stepDef.name, 30000);
  }

  /**
   * Wait for step response
   */
  private async waitForStepResponse(
    sagaId: string,
    stepName: string,
    timeout: number,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventEmitter.off(`saga.step.response.${sagaId}.${stepName}`, responseHandler);
        reject(new Error(`Step response timeout: ${stepName}`));
      }, timeout);

      const responseHandler = (data: any) => {
        clearTimeout(timer);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.output);
        }
      };

      this.eventEmitter.once(`saga.step.response.${sagaId}.${stepName}`, responseHandler);
    });
  }

  /**
   * Wait for compensation response
   */
  private async waitForCompensationResponse(
    sagaId: string,
    stepName: string,
    timeout: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventEmitter.off(`saga.compensation.response.${sagaId}.${stepName}`, responseHandler);
        reject(new Error(`Compensation response timeout: ${stepName}`));
      }, timeout);

      const responseHandler = (data: any) => {
        clearTimeout(timer);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve();
        }
      };

      this.eventEmitter.once(`saga.compensation.response.${sagaId}.${stepName}`, responseHandler);
    });
  }

  /**
   * Handle step response from Kafka
   */
  async handleStepResponse(sagaId: string, stepName: string, output: any, error?: string) {
    this.eventEmitter.emit(`saga.step.response.${sagaId}.${stepName}`, {
      output,
      error,
    });
  }

  /**
   * Handle compensation response from Kafka
   */
  async handleCompensationResponse(sagaId: string, stepName: string, error?: string) {
    this.eventEmitter.emit(`saga.compensation.response.${sagaId}.${stepName}`, {
      error,
    });
  }

  /**
   * Create saga steps in database
   */
  private async createSagaSteps(sagaId: string, stepDefinitions: StepDefinition[]): Promise<SagaStep[]> {
    const steps: SagaStep[] = [];

    for (let i = 0; i < stepDefinitions.length; i++) {
      const def = stepDefinitions[i];
      const step = this.sagaStepRepository.create({
        sagaId,
        name: def.name,
        service: def.service,
        action: def.action,
        compensateAction: def.compensateAction,
        status: StepStatus.PENDING,
        sequence: i,
        input: def.input,
        timeout: def.timeout || 30000,
        retryable: def.retryable !== false,
        maxRetries: def.maxRetries || 3,
        dependsOn: def.dependsOn,
      });

      steps.push(await this.sagaStepRepository.save(step));
    }

    return steps;
  }

  /**
   * Prepare step input with context and previous results
   */
  private prepareStepInput(
    step: SagaStep,
    context: SagaContext,
    previousResults: Map<string, StepResult>,
  ): any {
    const input = {
      ...step.input,
      context: {
        sagaId: context.sagaId,
        correlationId: context.correlationId,
        organizationId: context.organizationId,
        userId: context.userId,
      },
      previousResults: {},
    };

    // Add outputs from previous steps
    for (const [stepName, result] of previousResults) {
      if (result.status === StepStatus.COMPLETED) {
        input.previousResults[stepName] = result.output;
      }
    }

    return input;
  }

  /**
   * Register built-in saga definitions
   */
  private registerBuiltInSagas() {
    // Compliance assessment saga
    const complianceAssessmentSaga: SagaDefinition = {
      name: 'compliance-assessment',
      steps: [
        {
          name: 'gather-evidence',
          service: 'evidence',
          action: 'collect',
          compensateAction: 'release',
          timeout: 60000,
        },
        {
          name: 'evaluate-controls',
          service: 'control',
          action: 'evaluate',
          compensateAction: 'reset',
          dependsOn: ['gather-evidence'],
        },
        {
          name: 'check-policies',
          service: 'policy',
          action: 'validate',
          compensateAction: 'revert',
          dependsOn: ['evaluate-controls'],
        },
        {
          name: 'generate-report',
          service: 'reporting',
          action: 'generate',
          compensateAction: 'delete',
          dependsOn: ['check-policies'],
        },
        {
          name: 'notify-stakeholders',
          service: 'notification',
          action: 'send',
          dependsOn: ['generate-report'],
          retryable: false,
        },
      ],
    };

    this.activeSagas.set('compliance-assessment', complianceAssessmentSaga);

    // Audit preparation saga
    const auditPreparationSaga: SagaDefinition = {
      name: 'audit-preparation',
      steps: [
        {
          name: 'freeze-evidence',
          service: 'evidence',
          action: 'freeze',
          compensateAction: 'unfreeze',
        },
        {
          name: 'create-audit-workspace',
          service: 'audit',
          action: 'createWorkspace',
          compensateAction: 'deleteWorkspace',
        },
        {
          name: 'compile-documentation',
          service: 'reporting',
          action: 'compileDocuments',
          compensateAction: 'purgeDocuments',
          dependsOn: ['freeze-evidence', 'create-audit-workspace'],
        },
        {
          name: 'grant-auditor-access',
          service: 'auth',
          action: 'grantAccess',
          compensateAction: 'revokeAccess',
          dependsOn: ['create-audit-workspace'],
        },
      ],
    };

    this.activeSagas.set('audit-preparation', auditPreparationSaga);
  }

  /**
   * Register step handler
   */
  registerStepHandler(service: string, action: string, handler: Function) {
    const key = `${service}.${action}`;
    this.stepHandlers.set(key, handler);
    this.logger.log(`Registered step handler: ${key}`);
  }

  /**
   * Register compensation handler
   */
  registerCompensationHandler(service: string, action: string, handler: Function) {
    const key = `${service}.${action}`;
    this.compensationHandlers.set(key, handler);
    this.logger.log(`Registered compensation handler: ${key}`);
  }

  /**
   * Get saga status
   */
  async getSagaStatus(sagaId: string): Promise<SagaState | null> {
    return await this.sagaStateRepository.findOne({
      where: { id: sagaId },
      relations: ['steps'],
    });
  }

  /**
   * Cancel running saga
   */
  async cancelSaga(sagaId: string, reason: string): Promise<void> {
    const saga = await this.sagaStateRepository.findOne({
      where: { id: sagaId },
    });

    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    if (saga.status !== SagaStatus.RUNNING) {
      throw new Error(`Cannot cancel saga in status: ${saga.status}`);
    }

    saga.status = SagaStatus.CANCELLED;
    saga.cancelledAt = new Date();
    saga.cancellationReason = reason;
    await this.sagaStateRepository.save(saga);

    // Start compensation for completed steps
    const definition = this.activeSagas.get(saga.name);
    if (definition) {
      const steps = await this.sagaStepRepository.find({
        where: { sagaId, status: StepStatus.COMPLETED },
      });

      const stepResults = new Map<string, StepResult>();
      for (const step of steps) {
        stepResults.set(step.name, {
          stepName: step.name,
          status: StepStatus.COMPLETED,
          output: step.output,
          executionTime: 0,
          retryCount: step.retryCount,
        });
      }

      await this.compensateSaga(sagaId, definition, saga.context as SagaContext, stepResults);
    }

    this.logger.log(`Saga cancelled: ${sagaId} - ${reason}`);
  }

  /**
   * Handle saga failure
   */
  private async handleSagaFailure(sagaId: string, error: Error): Promise<void> {
    const saga = await this.sagaStateRepository.findOne({
      where: { id: sagaId },
    });

    if (!saga) return;

    saga.status = SagaStatus.FAILED;
    saga.failedAt = new Date();
    saga.error = error.message;
    await this.sagaStateRepository.save(saga);

    this.logger.error(`Saga failed: ${sagaId}`, error);
  }

  /**
   * Monitor and cleanup stale sagas
   */
  private startSagaMonitoring() {
    setInterval(async () => {
      // Find timed out sagas
      const cutoffTime = new Date(Date.now() - 3600000); // 1 hour ago
      const staleSagas = await this.sagaStateRepository.find({
        where: [
          { status: SagaStatus.RUNNING, startedAt: cutoffTime },
          { status: SagaStatus.PENDING, startedAt: cutoffTime },
        ],
      });

      for (const saga of staleSagas) {
        this.logger.warn(`Found stale saga: ${saga.id}`);
        await this.cancelSaga(saga.id, 'Timeout');
      }
    }, 60000); // Check every minute
  }

  /**
   * Get saga definition
   */
  getSagaDefinition(name: string): SagaDefinition | undefined {
    return this.activeSagas.get(name);
  }

  /**
   * List active saga definitions
   */
  listSagaDefinitions(): string[] {
    return Array.from(this.activeSagas.keys());
  }
}