import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EventType,
  type WorkflowCompletedEvent,
  type WorkflowFailedEvent,
  WorkflowStartedEvent,
} from '@soc-compliance/events';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workflow, WorkflowStatus } from '../entities/workflow.entity';
import { 
  type InstanceContext, 
  InstanceStatus,
  WorkflowInstance 
} from '../entities/workflow-instance.entity';
import { 
  ExecutionStatus, 
  WorkflowStepExecution 
} from '../entities/workflow-step-execution.entity';
import type { StepExecutorService } from './step-executor.service';

export interface WorkflowContext {
  organizationId: string;
  userId: string;
  userRoles?: string[];
  clientId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  instanceId: string;
  status: InstanceStatus;
  currentStepId: string | null;
  context: InstanceContext;
  steps: Record<string, {
    status: ExecutionStatus;
    outputs?: Record<string, any>;
    error?: string;
  }>;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowInstance)
    private instanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStepExecution)
    private executionRepository: Repository<WorkflowStepExecution>,
    @InjectQueue('workflow')
    private workflowQueue: Queue,
    private stepExecutor: StepExecutorService,
    private eventEmitter: EventEmitter2,
    private serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async startWorkflow(
    workflowId: string,
    inputs: Record<string, any>,
    context: WorkflowContext
  ): Promise<string> {
    // Load workflow with steps
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId },
      relations: ['steps'],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (!workflow.canExecute) {
      throw new BadRequestException('Workflow cannot be executed');
    }

    if (!workflow.canUserExecute(context.userId, context.userRoles || [])) {
      throw new BadRequestException('User does not have permission to execute this workflow');
    }

    if (!workflow.validateInputs(inputs)) {
      throw new BadRequestException('Invalid workflow inputs');
    }

    // Create workflow instance
    const instance = this.instanceRepository.create({
      workflowId,
      organizationId: context.organizationId,
      name: `${workflow.name} - ${new Date().toISOString()}`,
      status: InstanceStatus.PENDING,
      context: {
        inputs,
        outputs: {},
        variables: {},
        metadata: context.metadata || {},
        userId: context.userId,
        organizationId: context.organizationId,
        clientId: context.clientId,
        correlationId: context.correlationId,
      },
      totalSteps: workflow.steps.length,
      completedSteps: 0,
      triggerInfo: {
        type: 'manual',
        user: context.userId,
      },
      priority: inputs.priority || 5,
      initiatedBy: context.userId,
      correlationId: context.correlationId,
    });

    const savedInstance = await this.instanceRepository.save(instance);

    // Queue workflow execution
    await this.workflowQueue.add(
      'execute-workflow',
      {
        instanceId: savedInstance.id,
        context,
      },
      {
        priority: savedInstance.priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    // Emit event
    this.eventEmitter.emit('workflow.instance.created', {
      instanceId: savedInstance.id,
      workflowId,
      initiatedBy: context.userId,
    });

    return savedInstance.id;
  }

  async executeWorkflow(instanceId: string): Promise<void> {
    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId },
      relations: ['workflow', 'workflow.steps'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    // Check for timeout
    if (this.isTimedOut(instance)) {
      await this.handleTimeout(instance);
      return;
    }

    // Update instance status
    if (instance.status === InstanceStatus.PENDING) {
      instance.status = InstanceStatus.RUNNING;
      instance.startedAt = new Date();
      await this.instanceRepository.save(instance);

      this.eventEmitter.emit('workflow.started', {
        instanceId: instance.id,
        workflowId: instance.workflowId,
      });
    }

    // Find next step to execute
    const nextStep = await this.findNextStep(instance);
    
    if (!nextStep) {
      // No more steps - complete workflow
      await this.completeWorkflow(instance);
      return;
    }

    // Update current step
    instance.currentStepId = nextStep.id;
    await this.instanceRepository.save(instance);

    // Create step execution
    const execution = this.executionRepository.create({
      instanceId: instance.id,
      stepId: nextStep.id,
      stepName: nextStep.name,
      stepType: nextStep.type,
      order: nextStep.order,
      status: ExecutionStatus.PENDING,
      inputs: instance.context.inputs,
    });

    const savedExecution = await this.executionRepository.save(execution);

    // Execute step
    try {
      execution.status = ExecutionStatus.RUNNING;
      execution.startedAt = new Date();
      await this.executionRepository.save(execution);

      const result = await this.stepExecutor.executeStep(
        nextStep,
        instance,
        execution
      );

      if (result.success) {
        await this.handleStepSuccess(instance, execution, result);
      } else {
        await this.handleStepFailure(instance, execution, result);
      }
    } catch (error) {
      await this.handleStepError(instance, execution, error);
    }
  }

  private async findNextStep(instance: WorkflowInstance): Promise<any> {
    const workflow = instance.workflow;
    
    if (!instance.currentStepId) {
      // First step
      return workflow.steps.find(s => s.order === 1);
    }

    // Get current step execution
    const currentExecution = await this.executionRepository.findOne({
      where: {
        instanceId: instance.id,
        stepId: instance.currentStepId,
      },
      order: { createdAt: 'DESC' },
    });

    const isTerminal = currentExecution && (
      currentExecution.status === ExecutionStatus.COMPLETED ||
      currentExecution.status === ExecutionStatus.SKIPPED ||
      currentExecution.status === ExecutionStatus.FAILED
    );
    
    if (!currentExecution || !isTerminal) {
      return null; // Current step not completed
    }

    // Find current step
    const currentStep = workflow.steps.find(s => s.id === instance.currentStepId);
    if (!currentStep) {
      return null;
    }

    // Determine next step based on outputs and conditions
    const nextStepId = currentStep.getNextStepId(currentExecution.outputs);
    
    if (!nextStepId) {
      // Check for steps with higher order
      const higherOrderSteps = workflow.steps
        .filter(s => s.order > currentStep.order && s.isActive)
        .sort((a, b) => a.order - b.order);
      
      return higherOrderSteps[0] || null;
    }

    return workflow.steps.find(s => s.id === nextStepId);
  }

  private async handleStepSuccess(
    instance: WorkflowInstance,
    execution: WorkflowStepExecution,
    result: any
  ): Promise<void> {
    execution.status = ExecutionStatus.COMPLETED;
    execution.completedAt = new Date();
    execution.outputs = result.outputs || {};
    execution.updateExecutionTime();
    await this.executionRepository.save(execution);

    // Update instance
    instance.completedSteps++;
    instance.context = {
      ...instance.context,
      outputs: { ...instance.context.outputs, [execution.stepId]: result.outputs },
      variables: { ...instance.context.variables, ...result.variables },
    };
    await this.instanceRepository.save(instance);

    this.eventEmitter.emit('workflow.step.completed', {
      instanceId: instance.id,
      stepId: execution.stepId,
      outputs: result.outputs,
    });

    // Continue workflow execution
    await this.workflowQueue.add('execute-workflow', { instanceId: instance.id });
  }

  private async handleStepFailure(
    instance: WorkflowInstance,
    execution: WorkflowStepExecution,
    result: any
  ): Promise<void> {
    execution.status = ExecutionStatus.FAILED;
    execution.error = result.error;
    execution.errorDetails = result.errorDetails;
    execution.updateExecutionTime();
    await this.executionRepository.save(execution);

    this.eventEmitter.emit('workflow.step.failed', {
      instanceId: instance.id,
      stepId: execution.stepId,
      error: result.error,
    });

    if (result.shouldRetry && execution.canRetry()) {
      // Queue retry
      await this.workflowQueue.add(
        'retry-step',
        { instanceId: instance.id, stepId: execution.stepId },
        {
          delay: this.calculateRetryDelay(execution.retryCount),
          attempts: 1,
        }
      );
    } else {
      // Handle error path or fail workflow
      const step = instance.workflow.steps.find(s => s.id === execution.stepId);
      if (step?.errorStepIds?.length > 0) {
        instance.currentStepId = step.errorStepIds[0];
        await this.instanceRepository.save(instance);
        await this.workflowQueue.add('execute-workflow', { instanceId: instance.id });
      } else {
        await this.failWorkflow(instance, result.error);
      }
    }
  }

  private async handleStepError(
    instance: WorkflowInstance,
    execution: WorkflowStepExecution,
    error: Error
  ): Promise<void> {
    execution.status = ExecutionStatus.FAILED;
    execution.error = error.message;
    execution.errorDetails = { stack: error.stack };
    execution.updateExecutionTime();
    await this.executionRepository.save(execution);

    await this.handleStepFailure(instance, execution, {
      success: false,
      error: error.message,
      errorDetails: { stack: error.stack },
      shouldRetry: true,
    });
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 2000; // 2 seconds
    const multiplier = 2;
    return baseDelay * multiplier ** retryCount;
  }

  private async completeWorkflow(instance: WorkflowInstance): Promise<void> {
    instance.status = InstanceStatus.COMPLETED;
    instance.completedAt = new Date();
    instance.executionTime = Math.floor(
      (instance.completedAt.getTime() - instance.startedAt.getTime()) / 1000
    );
    await this.instanceRepository.save(instance);

    // Emit standardized workflow completed event
    const workflowCompletedEvent: WorkflowCompletedEvent = {
      id: uuidv4(),
      type: EventType.WORKFLOW_COMPLETED,
      timestamp: new Date(),
      version: '1.0',
      source: 'workflow-service',
      userId: instance.context?.userId || 'system',
      organizationId: instance.organizationId,
      payload: {
        workflowId: instance.workflowId,
        workflowType: instance.workflow?.category || 'unknown',
        organizationId: instance.organizationId,
        completedBy: instance.context?.userId || 'system',
        duration: instance.executionTime || 0,
        result: instance.context?.outputs || {},
      },
    };
    
    this.eventEmitter.emit('workflow.completed', workflowCompletedEvent);
    this.logger.log(`Emitted workflow.completed event for instance ${instance.id}`);
  }

  private async failWorkflow(instance: WorkflowInstance, error: string): Promise<void> {
    instance.status = InstanceStatus.FAILED;
    instance.error = error;
    instance.completedAt = new Date();
    instance.executionTime = Math.floor(
      (instance.completedAt.getTime() - instance.startedAt.getTime()) / 1000
    );
    await this.instanceRepository.save(instance);

    // Emit standardized workflow failed event
    const workflowFailedEvent: WorkflowFailedEvent = {
      id: uuidv4(),
      type: EventType.WORKFLOW_FAILED,
      timestamp: new Date(),
      version: '1.0',
      source: 'workflow-service',
      userId: instance.context?.userId || 'system',
      organizationId: instance.organizationId,
      payload: {
        workflowId: instance.workflowId,
        workflowType: instance.workflow?.category || 'unknown',
        organizationId: instance.organizationId,
        error,
        failedStep: instance.currentStepId || undefined,
        duration: instance.executionTime || 0,
      },
    };
    
    this.eventEmitter.emit('workflow.failed', workflowFailedEvent);
    this.logger.log(`Emitted workflow.failed event for instance ${instance.id}`);
  }

  private isTimedOut(instance: WorkflowInstance): boolean {
    if (!instance.workflow.maxExecutionTime || !instance.startedAt) {
      return false;
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - instance.startedAt.getTime()) / 1000
    );

    return elapsedSeconds > instance.workflow.maxExecutionTime;
  }

  private async handleTimeout(instance: WorkflowInstance): Promise<void> {
    instance.status = InstanceStatus.TIMEOUT;
    instance.error = 'Workflow execution timeout';
    instance.completedAt = new Date();
    await this.instanceRepository.save(instance);

    this.eventEmitter.emit('workflow.timeout', {
      instanceId: instance.id,
      workflowId: instance.workflowId,
    });
  }

  async pauseWorkflow(
    instanceId: string, 
    userId: string, 
    reason?: string
  ): Promise<WorkflowInstance> {
    const instance = await this.getInstanceWithValidation(instanceId);

    if (instance.status !== InstanceStatus.RUNNING && instance.status !== InstanceStatus.PENDING) {
      throw new BadRequestException('Workflow is not in a pausable state');
    }

    instance.status = InstanceStatus.PAUSED;
    instance.pausedAt = new Date();
    instance.pausedBy = userId;
    instance.pauseReason = reason;

    const savedInstance = await this.instanceRepository.save(instance);

    this.eventEmitter.emit('workflow.paused', {
      instanceId,
      pausedBy: userId,
      reason,
    });

    return savedInstance;
  }

  async resumeWorkflow(instanceId: string, userId: string): Promise<WorkflowInstance> {
    const instance = await this.getInstanceWithValidation(instanceId);

    if (instance.status !== InstanceStatus.PAUSED) {
      throw new BadRequestException('Workflow is not paused');
    }

    instance.status = InstanceStatus.RUNNING;
    instance.pausedAt = null;
    instance.pausedBy = null;
    instance.pauseReason = null;

    const savedInstance = await this.instanceRepository.save(instance);

    // Resume execution
    await this.workflowQueue.add('execute-workflow', { instanceId });

    this.eventEmitter.emit('workflow.resumed', {
      instanceId,
      resumedBy: userId,
    });

    return savedInstance;
  }

  async cancelWorkflow(
    instanceId: string, 
    userId: string, 
    reason?: string
  ): Promise<WorkflowInstance> {
    const instance = await this.getInstanceWithValidation(instanceId);

    const cancellableStatuses = [
      InstanceStatus.PENDING,
      InstanceStatus.RUNNING,
      InstanceStatus.PAUSED,
      InstanceStatus.WAITING_APPROVAL
    ];
    
    if (!cancellableStatuses.includes(instance.status)) {
      throw new BadRequestException('Cannot cancel workflow in current state');
    }

    instance.status = InstanceStatus.CANCELLED;
    instance.cancelledAt = new Date();
    instance.cancelledBy = userId;
    instance.cancelReason = reason;

    const savedInstance = await this.instanceRepository.save(instance);

    this.eventEmitter.emit('workflow.cancelled', {
      instanceId,
      cancelledBy: userId,
      reason,
    });

    return savedInstance;
  }

  async retryStep(
    instanceId: string, 
    stepId: string, 
    userId: string
  ): Promise<void> {
    const instance = await this.getInstanceWithValidation(instanceId);
    
    const execution = await this.executionRepository.findOne({
      where: {
        instanceId,
        stepId,
      },
      order: { createdAt: 'DESC' },
    });

    if (!execution) {
      throw new NotFoundException('Step execution not found');
    }

    if (execution.status !== ExecutionStatus.FAILED) {
      throw new BadRequestException('Step is not in a retriable state');
    }

    // Reset execution
    execution.status = ExecutionStatus.PENDING;
    execution.error = null;
    execution.errorDetails = null;
    execution.retryCount++;
    execution.lastRetryAt = new Date();
    await this.executionRepository.save(execution);

    // Queue step execution
    await this.workflowQueue.add(
      'execute-step',
      { instanceId, stepId },
      { priority: instance.priority }
    );

    this.eventEmitter.emit('workflow.step.retried', {
      instanceId,
      stepId,
      retriedBy: userId,
    });
  }

  async skipStep(
    instanceId: string, 
    stepId: string, 
    userId: string, 
    reason: string
  ): Promise<void> {
    const instance = await this.getInstanceWithValidation(instanceId);
    
    const execution = await this.executionRepository.findOne({
      where: {
        instanceId,
        stepId,
      },
      order: { createdAt: 'DESC' },
    });

    if (!execution) {
      throw new NotFoundException('Step execution not found');
    }

    const terminalStatuses = [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.SKIPPED,
      ExecutionStatus.FAILED
    ];
    
    if (terminalStatuses.includes(execution.status)) {
      throw new BadRequestException('Step has already completed');
    }

    // Skip execution
    execution.status = ExecutionStatus.SKIPPED;
    execution.skippedBy = userId;
    execution.skipReason = reason;
    execution.completedAt = new Date();
    await this.executionRepository.save(execution);

    // Continue workflow
    await this.workflowQueue.add('execute-workflow', { instanceId });

    this.eventEmitter.emit('workflow.step.skipped', {
      instanceId,
      stepId,
      skippedBy: userId,
      reason,
    });
  }

  async submitApproval(
    instanceId: string,
    stepId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
    formData?: Record<string, any>
  ): Promise<void> {
    const instance = await this.getInstanceWithValidation(instanceId);
    
    const execution = await this.executionRepository.findOne({
      where: {
        instanceId,
        stepId,
        status: ExecutionStatus.WAITING_APPROVAL,
      },
    });

    if (!execution) {
      throw new NotFoundException('Approval step not found or not waiting for approval');
    }

    // Load workflow to validate approver
    const workflow = await this.workflowRepository.findOne({
      where: { id: instance.workflowId },
      relations: ['steps'],
    });

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step || !step.validateApprover(userId, [])) {
      throw new BadRequestException('User is not authorized to approve this step');
    }

    // Add approval record
    if (!execution.approvals) {
      execution.approvals = [];
    }
    execution.approvals.push({
      userId,
      decision,
      comments,
      timestamp: new Date(),
      formData,
    });

    await this.executionRepository.save(execution);

    // Queue approval processing
    await this.workflowQueue.add(
      'process-approval',
      {
        instanceId,
        stepId,
        executionId: execution.id,
      },
      { priority: instance.priority }
    );

    this.eventEmitter.emit('workflow.approval.submitted', {
      instanceId,
      stepId,
      userId,
      decision,
    });
  }

  async getWorkflowState(instanceId: string): Promise<WorkflowState> {
    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId },
      relations: ['workflow'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    const executions = await this.executionRepository.find({
      where: { instanceId },
      order: { order: 'ASC' },
    });

    const steps: Record<string, any> = {};
    executions.forEach(execution => {
      steps[execution.stepId] = {
        status: execution.status,
        outputs: execution.outputs,
        error: execution.error,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        executionTime: execution.executionTime,
      };
    });

    return {
      instanceId: instance.id,
      status: instance.status,
      currentStepId: instance.currentStepId,
      context: instance.context,
      steps,
    };
  }

  async updateWorkflowState(
    instanceId: string,
    updates: Partial<InstanceContext>
  ): Promise<void> {
    const instance = await this.getInstanceWithValidation(instanceId);

    instance.context = {
      ...instance.context,
      ...updates,
    };
    await this.instanceRepository.save(instance);

    this.eventEmitter.emit('workflow.state.updated', {
      instanceId,
      updates,
    });
  }

  private async getInstanceWithValidation(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId },
      relations: ['workflow', 'workflow.steps'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    return instance;
  }
}