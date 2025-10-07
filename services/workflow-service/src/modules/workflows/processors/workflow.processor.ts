import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStepExecution } from '../entities/workflow-step-execution.entity';
import type { StepExecutorService } from '../services/step-executor.service';
import type { WorkflowEngineService } from '../services/workflow-engine.service';

@Processor('workflow')
export class WorkflowProcessor {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(
    private workflowEngine: WorkflowEngineService,
    private stepExecutor: StepExecutorService,
    @InjectRepository(WorkflowInstance)
    private instanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowStepExecution)
    private executionRepository: Repository<WorkflowStepExecution>,
  ) {}

  @Process('execute-workflow')
  async handleWorkflowExecution(job: Job<{ instanceId: string; context?: any }>) {
    const { instanceId, context } = job.data;
    this.logger.log(`Processing workflow execution for instance: ${instanceId}`);

    try {
      await this.workflowEngine.executeWorkflow(instanceId);
      this.logger.log(`Workflow execution completed for instance: ${instanceId}`);
    } catch (error) {
      this.logger.error(`Error executing workflow ${instanceId}: ${error.message}`, error.stack);
      throw error; // Let Bull handle retry
    }
  }

  @Process('execute-step')
  async handleStepExecution(job: Job<{ instanceId: string; stepId: string }>) {
    const { instanceId, stepId } = job.data;
    this.logger.log(`Processing step execution: ${stepId} for instance: ${instanceId}`);

    try {
      const instance = await this.instanceRepository.findOne({
        where: { id: instanceId },
        relations: ['workflow', 'workflow.steps'],
      });

      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const step = instance.workflow.steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }

      const execution = await this.executionRepository.findOne({
        where: { instanceId, stepId },
        order: { createdAt: 'DESC' },
      });

      if (!execution) {
        throw new Error(`Step execution not found`);
      }

      await this.stepExecutor.executeStep(step, instance, execution);
      this.logger.log(`Step execution completed: ${stepId}`);
    } catch (error) {
      this.logger.error(`Error executing step ${stepId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('retry-step')
  async handleStepRetry(job: Job<{ instanceId: string; stepId: string }>) {
    const { instanceId, stepId } = job.data;
    this.logger.log(`Retrying step: ${stepId} for instance: ${instanceId}`);

    try {
      await this.workflowEngine.retryStep(instanceId, stepId, 'system');
      this.logger.log(`Step retry initiated: ${stepId}`);
    } catch (error) {
      this.logger.error(`Error retrying step ${stepId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('process-approval')
  async handleApprovalProcessing(job: Job<{ 
    instanceId: string; 
    stepId: string; 
    executionId: string;
  }>) {
    const { instanceId, stepId, executionId } = job.data;
    this.logger.log(`Processing approval for step: ${stepId}`);

    try {
      const execution = await this.executionRepository.findOne({
        where: { id: executionId },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

      const decision = execution.getApprovalDecision();
      
      if (decision !== 'pending') {
        // Approval complete, continue workflow
        await this.workflowEngine.executeWorkflow(instanceId);
      }

      this.logger.log(`Approval processing completed for step: ${stepId}`);
    } catch (error) {
      this.logger.error(`Error processing approval: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('timeout-check')
  async handleTimeoutCheck(job: Job<{ instanceId: string }>) {
    const { instanceId } = job.data;
    this.logger.log(`Checking timeout for instance: ${instanceId}`);

    try {
      const instance = await this.instanceRepository.findOne({
        where: { id: instanceId },
        relations: ['workflow'],
      });

      if (!instance || !instance.workflow.maxExecutionTime) {
        return;
      }

      const elapsed = Date.now() - instance.startedAt.getTime();
      const maxTime = instance.workflow.maxExecutionTime * 1000;

      if (elapsed > maxTime) {
        await this.workflowEngine.cancelWorkflow(
          instanceId,
          'system',
          'Execution timeout exceeded'
        );
      }
    } catch (error) {
      this.logger.error(`Error checking timeout: ${error.message}`, error.stack);
    }
  }

  @Process('cleanup-completed')
  async handleCleanupCompleted(job: Job<{ olderThan: Date }>) {
    const { olderThan } = job.data;
    this.logger.log(`Cleaning up completed workflows older than: ${olderThan}`);

    try {
      // Implement cleanup logic
      // This could archive old completed instances to cold storage
      this.logger.log('Cleanup completed');
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error.message}`, error.stack);
    }
  }
}