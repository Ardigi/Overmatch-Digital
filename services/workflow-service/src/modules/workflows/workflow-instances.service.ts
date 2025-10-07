import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  InstanceStatus, 
  type InstanceContext,
  WorkflowInstance 
} from './entities/workflow-instance.entity';
import { 
  ExecutionStatus,
  WorkflowStepExecution 
} from './entities/workflow-step-execution.entity';
import { Workflow } from './entities/workflow.entity';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowStateMachineService, StateTransitionEvent } from './services/workflow-state-machine.service';

export interface FindInstancesOptions {
  status?: InstanceStatus;
  workflowId?: string;
  organizationId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class WorkflowInstancesService {
  private readonly logger = new Logger(WorkflowInstancesService.name);

  constructor(
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStepExecution)
    private readonly stepExecutionRepository: Repository<WorkflowStepExecution>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly engineService: WorkflowEngineService,
    private readonly stateMachine: WorkflowStateMachineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(options: FindInstancesOptions): Promise<{
    data: WorkflowInstance[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.instanceRepository.createQueryBuilder('instance');

    if (options.status) {
      queryBuilder.andWhere('instance.status = :status', { status: options.status });
    }

    if (options.workflowId) {
      queryBuilder.andWhere('instance.workflowId = :workflowId', { 
        workflowId: options.workflowId 
      });
    }

    if (options.organizationId) {
      queryBuilder.andWhere('instance.organizationId = :organizationId', {
        organizationId: options.organizationId,
      });
    }

    queryBuilder.orderBy('instance.startedAt', 'DESC');

    const skip = (options.page - 1) * options.limit;
    queryBuilder.skip(skip).take(options.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async findOne(id: string): Promise<WorkflowInstance> {
    const instance = await this.instanceRepository.findOne({
      where: { id },
      relations: ['workflow'],
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${id} not found`);
    }

    return instance;
  }

  async getStepExecutions(instanceId: string): Promise<WorkflowStepExecution[]> {
    await this.findOne(instanceId); // Verify instance exists

    return this.stepExecutionRepository.find({
      where: { instanceId },
      order: { order: 'ASC' },
    });
  }

  async pause(id: string): Promise<WorkflowInstance> {
    const instance = await this.findOne(id);

    if (instance.status !== InstanceStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot pause instance in status ${instance.status}`,
      );
    }

    const canTransition = await this.stateMachine.canTransition(
      instance.status,
      InstanceStatus.PAUSED,
      StateTransitionEvent.PAUSE,
      { instanceId: id, currentState: instance.status, event: StateTransitionEvent.PAUSE },
    );

    if (!canTransition) {
      throw new BadRequestException('Cannot pause instance at this time');
    }

    instance.status = InstanceStatus.PAUSED;
    const updatedInstance = await this.instanceRepository.save(instance);

    await this.eventEmitter.emit('workflow.paused', {
      instanceId: id,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
    });

    this.logger.log(`Paused workflow instance ${id}`);

    return updatedInstance;
  }

  async resume(id: string): Promise<WorkflowInstance> {
    const instance = await this.findOne(id);

    if (instance.status !== InstanceStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot resume instance in status ${instance.status}`,
      );
    }

    const canTransition = await this.stateMachine.canTransition(
      instance.status,
      InstanceStatus.RUNNING,
      StateTransitionEvent.RESUME,
      { instanceId: id, currentState: instance.status, event: StateTransitionEvent.RESUME },
    );

    if (!canTransition) {
      throw new BadRequestException('Cannot resume instance at this time');
    }

    instance.status = InstanceStatus.RUNNING;
    const updatedInstance = await this.instanceRepository.save(instance);

    // Resume workflow execution
    await this.engineService.executeWorkflow(updatedInstance);

    await this.eventEmitter.emit('workflow.resumed', {
      instanceId: id,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
    });

    this.logger.log(`Resumed workflow instance ${id}`);

    return updatedInstance;
  }

  async cancel(id: string, reason?: string): Promise<WorkflowInstance> {
    const instance = await this.findOne(id);

    if ([
      InstanceStatus.COMPLETED,
      InstanceStatus.CANCELLED,
      InstanceStatus.FAILED,
    ].includes(instance.status)) {
      throw new BadRequestException(
        `Cannot cancel instance in status ${instance.status}`,
      );
    }

    const canTransition = await this.stateMachine.canTransition(
      instance.status,
      InstanceStatus.CANCELLED,
      StateTransitionEvent.CANCEL,
      { 
        instanceId: id, 
        currentState: instance.status, 
        event: StateTransitionEvent.CANCEL,
        reason,
      },
    );

    if (!canTransition) {
      throw new BadRequestException('Cannot cancel instance at this time');
    }

    instance.status = InstanceStatus.CANCELLED;
    instance.completedAt = new Date();
    instance.error = reason || 'Cancelled by user';

    const updatedInstance = await this.instanceRepository.save(instance);

    // Cancel any running step executions
    await this.stepExecutionRepository.update(
      { 
        instanceId: id,
        status: ExecutionStatus.RUNNING,
      },
      {
        status: ExecutionStatus.CANCELLED,
        completedAt: new Date(),
        error: reason || 'Workflow cancelled',
      },
    );

    await this.eventEmitter.emit('workflow.cancelled', {
      instanceId: id,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
      reason,
    });

    this.logger.log(`Cancelled workflow instance ${id}${reason ? `: ${reason}` : ''}`);

    return updatedInstance;
  }

  async retry(id: string): Promise<WorkflowInstance> {
    const instance = await this.findOne(id);

    if (instance.status !== InstanceStatus.FAILED) {
      throw new BadRequestException(
        `Cannot retry instance in status ${instance.status}`,
      );
    }

    // Find the failed step
    const failedStep = await this.stepExecutionRepository.findOne({
      where: {
        instanceId: id,
        status: ExecutionStatus.FAILED,
      },
      order: { order: 'DESC' },
    });

    if (!failedStep) {
      throw new BadRequestException('No failed step found to retry');
    }

    // Reset instance status
    instance.status = InstanceStatus.RUNNING;
    instance.completedAt = null;
    instance.error = null;
    instance.retryCount = (instance.retryCount || 0) + 1;

    const updatedInstance = await this.instanceRepository.save(instance);

    // Reset failed step
    failedStep.status = ExecutionStatus.PENDING;
    failedStep.error = null;
    failedStep.completedAt = null;
    failedStep.retryCount = (failedStep.retryCount || 0) + 1;
    await this.stepExecutionRepository.save(failedStep);

    // Resume execution from failed step
    await this.engineService.executeWorkflow(updatedInstance);

    await this.eventEmitter.emit('workflow.retried', {
      instanceId: id,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
      retryCount: instance.retryCount,
    });

    this.logger.log(`Retrying workflow instance ${id} (attempt ${instance.retryCount})`);

    return updatedInstance;
  }

  async getHistory(instanceId: string): Promise<any[]> {
    await this.findOne(instanceId); // Verify instance exists

    const stepExecutions = await this.stepExecutionRepository.find({
      where: { instanceId },
      order: { startedAt: 'ASC' },
    });

    return stepExecutions.map(step => ({
      stepId: step.stepId,
      stepName: step.stepName,
      stepType: step.stepType,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      executionTime: step.executionTime,
      error: step.error,
      retryCount: step.retryCount,
      approvals: step.approvals,
      output: step.output,
    }));
  }

  async getContext(instanceId: string): Promise<InstanceContext> {
    const instance = await this.findOne(instanceId);
    return instance.context;
  }

  async updateContext(
    instanceId: string,
    contextUpdate: Partial<InstanceContext>,
  ): Promise<WorkflowInstance> {
    const instance = await this.findOne(instanceId);

    instance.context = {
      ...instance.context,
      ...contextUpdate,
      metadata: {
        ...instance.context.metadata,
        ...(contextUpdate.metadata || {}),
      },
    };

    const updatedInstance = await this.instanceRepository.save(instance);

    this.logger.log(`Updated context for workflow instance ${instanceId}`);

    return updatedInstance;
  }

  async remove(id: string): Promise<void> {
    const instance = await this.findOne(id);

    if ([InstanceStatus.RUNNING, InstanceStatus.PAUSED].includes(instance.status)) {
      throw new BadRequestException(
        `Cannot delete instance in status ${instance.status}`,
      );
    }

    // Delete step executions first
    await this.stepExecutionRepository.delete({ instanceId: id });

    // Delete instance
    await this.instanceRepository.delete(id);

    await this.eventEmitter.emit('workflow.deleted', {
      instanceId: id,
      workflowId: instance.workflowId,
      organizationId: instance.organizationId,
    });

    this.logger.log(`Deleted workflow instance ${id}`);
  }
}