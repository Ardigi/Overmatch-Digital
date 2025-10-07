import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Workflow, WorkflowStatus } from '../entities/workflow.entity';
import { InstanceStatus, WorkflowInstance } from '../entities/workflow-instance.entity';
import { ExecutionStatus, WorkflowStepExecution } from '../entities/workflow-step-execution.entity';
import { StepExecutorService } from './step-executor.service';
import { WorkflowEngineService } from './workflow-engine.service';

// Mock factories
const createMockRepository = <T = any>(): jest.Mocked<Repository<T>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    })),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  }) as any;

const createMockQueue = (): any => ({
  add: jest.fn(),
  process: jest.fn(),
  on: jest.fn(),
  removeOnComplete: jest.fn(),
  removeOnFail: jest.fn(),
  clean: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  getJobCounts: jest.fn(),
  getCompletedCount: jest.fn(),
  getFailedCount: jest.fn(),
  getDelayedCount: jest.fn(),
  getActiveCount: jest.fn(),
  getWaitingCount: jest.fn(),
  getPausedCount: jest.fn(),
  getRepeatableJobs: jest.fn(),
  removeRepeatableByKey: jest.fn(),
  removeRepeatable: jest.fn(),
  isReady: jest.fn(),
});

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

describe('WorkflowEngineService', () => {
  let service: WorkflowEngineService;
  let workflowRepository: any;
  let instanceRepository: any;
  let executionRepository: any;
  let workflowQueue: any;
  let stepExecutor: any;
  let eventEmitter: any;
  let serviceDiscovery: any;

  const mockWorkflow = {
    id: 'workflow-123',
    name: 'Document Approval',
    organizationId: 'org-123',
    status: WorkflowStatus.ACTIVE,
    steps: [
      {
        id: 'step-1',
        name: 'Submit Document',
        type: 'user_task',
        order: 1,
        config: {
          assignees: ['submitter'],
        },
        nextStepId: 'step-2',
        isActive: true,
        getNextStepId: jest.fn().mockReturnValue('step-2'),
      },
      {
        id: 'step-2',
        name: 'Manager Approval',
        type: 'approval',
        order: 2,
        config: {
          approvers: ['manager'],
          approvalType: 'single',
        },
        nextStepId: 'step-3',
        isActive: true,
        getNextStepId: jest.fn().mockReturnValue('step-3'),
      },
      {
        id: 'step-3',
        name: 'Complete',
        type: 'system_task',
        order: 3,
        config: {
          action: 'notify_completion',
        },
        isActive: true,
        getNextStepId: jest.fn().mockReturnValue(null),
      },
    ],
    canExecute: true,
    canUserExecute: jest.fn().mockReturnValue(true),
    validateInputs: jest.fn().mockReturnValue(true),
    validateStep: jest.fn().mockReturnValue(true),
  };

  const mockWorkflowInstance = {
    id: 'instance-123',
    workflowId: 'workflow-123',
    workflow: mockWorkflow,
    organizationId: 'org-123',
    name: 'Document Approval - 2024-01-15',
    status: InstanceStatus.RUNNING,
    currentStepId: 'step-1',
    context: {
      inputs: { document: 'report.pdf' },
      variables: {},
      outputs: {},
      metadata: {},
    },
    totalSteps: 3,
    completedSteps: 0,
    triggerInfo: {
      type: 'manual',
      user: 'user-123',
    },
    startedAt: new Date(),
    executionTime: 0,
    priority: 5,
    initiatedBy: 'user-123',
    canTransitionTo: jest.fn().mockReturnValue(true),
    updateContext: jest.fn(),
  };

  const mockStepExecution = {
    id: 'execution-123',
    instanceId: 'instance-123',
    stepId: 'step-1',
    status: ExecutionStatus.PENDING,
    inputs: {},
    outputs: {},
    error: null,
    startedAt: null,
    completedAt: null,
    executionTime: 0,
    retryCount: 0,
    approvals: [],
    canRetry: jest.fn().mockReturnValue(true),
    updateExecutionTime: jest.fn(),
  };

  const mockContext = {
    organizationId: 'org-123',
    userId: 'user-123',
    userRoles: ['admin', 'manager'],
    clientId: 'client-456',
    metadata: { source: 'web' },
  };

  beforeEach(() => {
    // Create mocks
    workflowRepository = createMockRepository();
    instanceRepository = createMockRepository();
    executionRepository = createMockRepository();
    workflowQueue = createMockQueue();
    stepExecutor = {
      executeStep: jest.fn(),
    } as any;
    eventEmitter = createMockEventEmitter();
    serviceDiscovery = {
      getService: jest.fn(),
      getServiceUrl: jest.fn(),
      registerService: jest.fn(),
    } as any;

    // Manual instantiation
    service = new WorkflowEngineService(
      workflowRepository,
      instanceRepository,
      executionRepository,
      workflowQueue,
      stepExecutor,
      eventEmitter,
      serviceDiscovery
    );

    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('should start workflow successfully', async () => {
      const inputs = {
        document: 'report.pdf',
        description: 'Monthly report',
      };

      workflowRepository.findOne.mockResolvedValue(mockWorkflow);
      instanceRepository.create.mockReturnValue(mockWorkflowInstance);
      instanceRepository.save.mockResolvedValue(mockWorkflowInstance);

      const result = await service.startWorkflow('workflow-123', inputs, mockContext);

      expect(workflowRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'workflow-123' },
        relations: ['steps'],
      });
      expect(mockWorkflow.canUserExecute).toHaveBeenCalledWith(
        mockContext.userId,
        mockContext.userRoles
      );
      expect(mockWorkflow.validateInputs).toHaveBeenCalledWith(inputs);
      expect(instanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'workflow-123',
          organizationId: mockContext.organizationId,
          status: InstanceStatus.PENDING,
          context: expect.objectContaining({
            inputs,
          }),
        })
      );
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        {
          instanceId: mockWorkflowInstance.id,
          context: mockContext,
        },
        {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );
      expect(result).toBe(mockWorkflowInstance.id);
    });

    it('should throw error if workflow not found', async () => {
      workflowRepository.findOne.mockResolvedValue(null);

      await expect(service.startWorkflow('non-existent', {}, mockContext)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error if workflow cannot be executed', async () => {
      const inactiveWorkflow = {
        ...mockWorkflow,
        canExecute: false,
      };
      workflowRepository.findOne.mockResolvedValue(inactiveWorkflow);

      await expect(service.startWorkflow('workflow-123', {}, mockContext)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw error if user lacks permission', async () => {
      mockWorkflow.canUserExecute.mockReturnValue(false);
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      await expect(service.startWorkflow('workflow-123', {}, mockContext)).rejects.toThrow(
        'User does not have permission'
      );
    });

    it('should throw error if inputs are invalid', async () => {
      mockWorkflow.canUserExecute.mockReturnValue(true); // User has permission
      mockWorkflow.validateInputs.mockReturnValue(false); // But inputs are invalid
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      await expect(
        service.startWorkflow('workflow-123', { invalid: true }, mockContext)
      ).rejects.toThrow('Invalid workflow inputs');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow steps sequentially', async () => {
      const pendingInstance = {
        ...mockWorkflowInstance,
        status: InstanceStatus.PENDING, // Start as PENDING
        startedAt: null,
        currentStepId: null, // No current step yet
      };
      instanceRepository.findOne.mockResolvedValue(pendingInstance);
      instanceRepository.save.mockImplementation((instance) => Promise.resolve(instance));
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockResolvedValue(mockStepExecution);
      executionRepository.findOne.mockResolvedValue(null); // No previous execution
      stepExecutor.executeStep.mockResolvedValue({
        success: true,
        outputs: { result: 'completed' },
        nextStepId: 'step-2',
      });

      await service.executeWorkflow('instance-123');

      expect(instanceRepository.findOne).toHaveBeenCalled();
      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.RUNNING,
          currentStepId: mockWorkflow.steps[0].id,
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.started',
        expect.objectContaining({
          instanceId: 'instance-123',
          workflowId: 'workflow-123',
        })
      );
      expect(stepExecutor.executeStep).toHaveBeenCalled();
    });

    it('should handle step execution failure', async () => {
      const runningInstance = {
        ...mockWorkflowInstance,
        currentStepId: null,
      };
      instanceRepository.findOne.mockResolvedValue(runningInstance);
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockResolvedValue(mockStepExecution);
      executionRepository.findOne.mockResolvedValue(null);
      stepExecutor.executeStep.mockResolvedValue({
        success: false,
        error: 'Step failed',
        shouldRetry: true,
      });

      await service.executeWorkflow('instance-123');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.step.failed',
        expect.objectContaining({
          instanceId: 'instance-123',
          stepId: expect.any(String),
          error: 'Step failed',
        })
      );
    });

    it('should complete workflow when all steps are done', async () => {
      const completedInstance = {
        ...mockWorkflowInstance,
        currentStepId: 'step-3',
        completedSteps: 2,
      };
      instanceRepository.findOne.mockResolvedValue(completedInstance);
      
      // Simulate that step-3 has completed
      const completedExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.COMPLETED,
        stepId: 'step-3',
      };
      executionRepository.findOne.mockResolvedValue(completedExecution);
      
      // No more steps after step-3
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockResolvedValue(mockStepExecution);

      await service.executeWorkflow('instance-123');

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.COMPLETED,
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.completed',
        expect.objectContaining({
          type: 'workflow.completed',
          organizationId: 'org-123',
        })
      );
    });
  });

  describe('pauseWorkflow', () => {
    it('should pause running workflow', async () => {
      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      instanceRepository.save.mockResolvedValue({
        ...mockWorkflowInstance,
        status: InstanceStatus.PAUSED,
      });

      const result = await service.pauseWorkflow('instance-123', 'user-123', 'Manual pause');

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.PAUSED,
          pausedBy: 'user-123',
          pausedAt: expect.any(Date),
          pauseReason: 'Manual pause',
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.paused',
        expect.objectContaining({
          instanceId: 'instance-123',
          pausedBy: 'user-123',
          reason: 'Manual pause',
        })
      );
    });

    it('should throw error if workflow not running', async () => {
      const completedInstance = {
        ...mockWorkflowInstance,
        status: InstanceStatus.COMPLETED,
        canTransitionTo: jest.fn().mockReturnValue(false),
      };
      instanceRepository.findOne.mockResolvedValue(completedInstance);

      await expect(service.pauseWorkflow('instance-123', 'user-123')).rejects.toThrow(
        'Workflow is not in a pausable state'
      );
    });
  });

  describe('resumeWorkflow', () => {
    it('should resume paused workflow', async () => {
      const pausedInstance = {
        ...mockWorkflowInstance,
        status: InstanceStatus.PAUSED,
        pausedAt: new Date(),
        pausedBy: 'user-123',
      };
      instanceRepository.findOne.mockResolvedValue(pausedInstance);
      instanceRepository.save.mockResolvedValue({
        ...pausedInstance,
        status: InstanceStatus.RUNNING,
      });

      await service.resumeWorkflow('instance-123', 'user-456');

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.RUNNING,
          pausedBy: null,
          pausedAt: null,
          pauseReason: null,
        })
      );
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        { instanceId: 'instance-123' }
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.resumed',
        expect.objectContaining({
          instanceId: 'instance-123',
          resumedBy: 'user-456',
        })
      );
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel running workflow', async () => {
      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      instanceRepository.save.mockResolvedValue({
        ...mockWorkflowInstance,
        status: InstanceStatus.CANCELLED,
      });

      await service.cancelWorkflow('instance-123', 'user-123');

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.CANCELLED,
          cancelledBy: 'user-123',
          cancelledAt: expect.any(Date),
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.cancelled',
        expect.objectContaining({
          instanceId: 'instance-123',
          cancelledBy: 'user-123',
        })
      );
    });

    it('should not cancel completed workflow', async () => {
      const completedInstance = {
        ...mockWorkflowInstance,
        status: InstanceStatus.COMPLETED,
        canTransitionTo: jest.fn().mockReturnValue(false),
      };
      instanceRepository.findOne.mockResolvedValue(completedInstance);

      await expect(service.cancelWorkflow('instance-123', 'user-123')).rejects.toThrow(
        'Cannot cancel workflow in current state'
      );
    });
  });

  describe('retryStep', () => {
    it('should retry failed step', async () => {
      const failedExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.FAILED,
        error: 'Network error',
        retryCount: 1,
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.findOne.mockResolvedValue(failedExecution);
      executionRepository.save.mockResolvedValue({
        ...failedExecution,
        status: ExecutionStatus.PENDING,
      });

      await service.retryStep('instance-123', 'step-1', 'user-123');

      expect(executionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.PENDING,
          error: null,
          retryCount: 2,
        })
      );
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'execute-step',
        expect.objectContaining({
          instanceId: 'instance-123',
          stepId: 'step-1',
        }),
        expect.any(Object)
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.step.retried',
        expect.objectContaining({
          instanceId: 'instance-123',
          stepId: 'step-1',
          retriedBy: 'user-123',
        })
      );
    });

    it('should not retry successful step', async () => {
      const successfulExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.COMPLETED,
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.findOne.mockResolvedValue(successfulExecution);

      await expect(service.retryStep('instance-123', 'step-1', 'user-123')).rejects.toThrow(
        'Step is not in a retriable state'
      );
    });
  });

  describe('skipStep', () => {
    it('should skip current step', async () => {
      const runningExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.RUNNING,
        isTerminalState: jest.fn().mockReturnValue(false),
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.findOne.mockResolvedValue(runningExecution);
      executionRepository.save.mockResolvedValue({
        ...runningExecution,
        status: ExecutionStatus.SKIPPED,
      });

      await service.skipStep('instance-123', 'step-1', 'user-123', 'Not applicable');

      expect(executionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.SKIPPED,
          skippedBy: 'user-123',
          skipReason: 'Not applicable',
        })
      );
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        { instanceId: 'instance-123' }
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.step.skipped',
        expect.objectContaining({
          instanceId: 'instance-123',
          stepId: 'step-1',
          skippedBy: 'user-123',
          reason: 'Not applicable',
        })
      );
    });
  });

  describe('submitApproval', () => {
    it('should submit approval decision', async () => {
      const approvalExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.WAITING_APPROVAL,
        stepType: 'approval',
        approvals: [],
        addApproval: jest.fn(),
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.findOne.mockResolvedValue(approvalExecution);
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      const mockStep = mockWorkflow.steps.find((s) => s.id === 'step-2');
      mockStep.validateApprover = jest.fn().mockReturnValue(true);

      approvalExecution.addApproval = jest.fn();
      
      await service.submitApproval('instance-123', 'step-2', 'user-123', 'approved', 'Looks good', {
        score: 5,
      });

      expect(executionRepository.save).toHaveBeenCalled();
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'process-approval',
        expect.objectContaining({
          instanceId: 'instance-123',
          stepId: 'step-2',
          executionId: 'execution-123',
        }),
        { priority: 5 }
      );
    });

    it('should reject invalid approver', async () => {
      const approvalExecution = {
        ...mockStepExecution,
        status: ExecutionStatus.WAITING_APPROVAL,
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.findOne.mockResolvedValue(approvalExecution);
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      const mockStep = mockWorkflow.steps.find((s) => s.id === 'step-2');
      mockStep.validateApprover = jest.fn().mockReturnValue(false);

      await expect(
        service.submitApproval('instance-123', 'step-2', 'unauthorized-user', 'approved')
      ).rejects.toThrow('User is not authorized to approve this step');
    });
  });

  describe('getWorkflowState', () => {
    it('should return workflow state', async () => {
      const executions = [
        {
          ...mockStepExecution,
          status: ExecutionStatus.COMPLETED,
          outputs: { data: 'value1' },
        },
        {
          ...mockStepExecution,
          id: 'execution-124',
          stepId: 'step-2',
          status: ExecutionStatus.RUNNING,
        },
      ];

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      executionRepository.find.mockResolvedValue(executions);

      const result = await service.getWorkflowState('instance-123');

      expect(result).toEqual({
        instanceId: 'instance-123',
        status: mockWorkflowInstance.status,
        currentStepId: mockWorkflowInstance.currentStepId,
        context: mockWorkflowInstance.context,
        steps: expect.objectContaining({
          'step-1': expect.objectContaining({
            status: ExecutionStatus.COMPLETED,
            outputs: { data: 'value1' },
          }),
          'step-2': expect.objectContaining({
            status: ExecutionStatus.RUNNING,
          }),
        }),
      });
    });
  });

  describe('updateWorkflowState', () => {
    it('should update workflow state', async () => {
      const newState = {
        variables: {
          priority: 'high',
          assignee: 'user-456',
        },
      };

      instanceRepository.findOne.mockResolvedValue(mockWorkflowInstance);
      instanceRepository.save.mockResolvedValue({
        ...mockWorkflowInstance,
        context: {
          ...mockWorkflowInstance.context,
          variables: newState.variables,
        },
      });

      await service.updateWorkflowState('instance-123', newState);

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            variables: newState.variables,
          }),
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'workflow.state.updated',
        expect.objectContaining({
          instanceId: 'instance-123',
          updates: newState,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle workflow execution timeout', async () => {
      const timedOutInstance = {
        ...mockWorkflowInstance,
        startedAt: new Date(Date.now() - 100000000), // Started long ago
        workflow: {
          ...mockWorkflow,
          maxExecutionTime: 3600, // 1 hour timeout
        },
      };

      instanceRepository.findOne.mockResolvedValue(timedOutInstance);

      await service.executeWorkflow('instance-123');

      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InstanceStatus.TIMEOUT,
          error: expect.stringContaining('timeout'),
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.timeout', expect.any(Object));
    });

    it('should handle step execution errors with retry', async () => {
      const errorInstance = {
        ...mockWorkflowInstance,
        currentStepId: null,
      };
      instanceRepository.findOne.mockResolvedValue(errorInstance);
      executionRepository.findOne.mockResolvedValue(null);
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockImplementation(exec => Promise.resolve(exec));
      stepExecutor.executeStep.mockRejectedValue(new Error('Network error'));

      await service.executeWorkflow('instance-123');

      expect(executionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.FAILED,
          error: expect.stringContaining('Network error'),
        })
      );
    });
  });

  describe('Conditional Logic', () => {
    it('should handle conditional step transitions', async () => {
      const conditionalStep = {
        ...mockWorkflow.steps[1],
        config: {
          ...mockWorkflow.steps[1].config,
          conditions: {
            approved: 'step-3',
            rejected: 'step-error',
          },
        },
      };

      const workflowWithConditions = {
        ...mockWorkflow,
        steps: [mockWorkflow.steps[0], conditionalStep, mockWorkflow.steps[2]],
      };

      const conditionalInstance = {
        ...mockWorkflowInstance,
        workflow: workflowWithConditions,
        currentStepId: null,
      };
      
      instanceRepository.findOne.mockResolvedValue(conditionalInstance);
      executionRepository.findOne.mockResolvedValue(null);
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockResolvedValue(mockStepExecution);
      stepExecutor.executeStep.mockResolvedValue({
        success: true,
        outputs: { decision: 'rejected' },
        nextStepId: 'step-error',
      });

      await service.executeWorkflow('instance-123');

      // It should set the currentStepId to the first step initially
      expect(instanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStepId: mockWorkflow.steps[0].id,
        })
      );
    });
  });

  describe('Parallel Execution', () => {
    it('should handle parallel step execution', async () => {
      const parallelSteps = [
        { ...mockWorkflow.steps[0], parallel: true, parallelGroup: 'group1' },
        { ...mockWorkflow.steps[1], parallel: true, parallelGroup: 'group1' },
      ];

      const workflowWithParallel = {
        ...mockWorkflow,
        steps: parallelSteps,
      };

      const parallelInstance = {
        ...mockWorkflowInstance,
        workflow: workflowWithParallel,
        currentStepId: null,
      };
      
      instanceRepository.findOne.mockResolvedValue(parallelInstance);
      executionRepository.findOne.mockResolvedValue(null);
      executionRepository.create.mockReturnValue(mockStepExecution);
      executionRepository.save.mockResolvedValue(mockStepExecution);
      stepExecutor.executeStep.mockResolvedValue({
        success: true,
        outputs: {},
      });

      await service.executeWorkflow('instance-123');

      // Should create execution for the first step found
      expect(executionRepository.create).toHaveBeenCalledTimes(1);
      expect(workflowQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.any(Object)
      );
    });
  });
});
