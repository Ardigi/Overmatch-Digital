import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '../entities/workflow.entity';
import { InstanceStatus } from '../entities/workflow-instance.entity';
import { WorkflowsController } from './workflows.controller';

describe('WorkflowsController', () => {
  let controller: WorkflowsController;
  let mockWorkflowsService: any;
  let mockWorkflowEngine: any;
  let mockWorkflowScheduler: any;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'workflow_admin'],
  };

  const mockRequest = {
    user: mockUser,
  };

  const mockWorkflow = {
    id: 'workflow-123',
    organizationId: 'org-123',
    name: 'Document Approval Workflow',
    description: 'Workflow for document approval process',
    category: 'approval',
    version: 1,
    status: WorkflowStatus.ACTIVE,
    isDraft: false,
    isTemplate: false,
    maxExecutionTime: 86400, // 24 hours
    retryConfig: {
      maxRetries: 3,
      retryDelay: 60,
      backoffMultiplier: 2,
    },
    steps: [
      {
        id: 'step-1',
        name: 'Submit Document',
        type: 'user_task',
        order: 1,
        config: {
          assignees: ['submitter'],
          form: {
            fields: [
              { name: 'document', type: 'file', required: true },
              { name: 'description', type: 'text', required: true },
            ],
          },
        },
        nextStepId: 'step-2',
      },
      {
        id: 'step-2',
        name: 'Manager Approval',
        type: 'approval',
        order: 2,
        config: {
          approvers: ['manager'],
          approvalType: 'single',
          timeoutHours: 48,
        },
        nextStepId: 'step-3',
        errorStepIds: ['step-4'],
      },
    ],
    triggers: {
      manual: true,
      events: ['document.uploaded'],
    },
    metadata: {
      compliance: ['SOC2', 'ISO27001'],
      department: 'Finance',
    },
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkflowInstance = {
    id: 'instance-123',
    workflowId: 'workflow-123',
    workflow: mockWorkflow,
    organizationId: 'org-123',
    status: InstanceStatus.RUNNING,
    currentStepId: 'step-2',
    inputs: {
      document: 'document.pdf',
      description: 'Q4 Financial Report',
    },
    outputs: {},
    state: {
      approvals: [],
      variables: {},
    },
    context: {
      userId: 'user-123',
      clientId: 'client-456',
      correlationId: 'corr-789',
    },
    startedAt: new Date(),
    completedAt: null,
    error: null,
    executionTime: 3600,
    steps: [],
  };

  const mockWorkflowTemplate = {
    id: 'template-123',
    organizationId: 'org-123',
    name: 'Standard Approval Template',
    description: 'Template for standard approval workflows',
    category: 'approval',
    version: 1,
    isPublic: true,
    config: {
      steps: mockWorkflow.steps,
      defaultInputs: {},
      customizable: ['approvers', 'timeouts'],
    },
    usage: {
      count: 25,
      lastUsed: new Date(),
    },
    createdBy: 'user-123',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockWorkflowsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      publish: jest.fn(),
      archive: jest.fn(),
      clone: jest.fn(),
      getInstances: jest.fn(),
      getInstance: jest.fn(),
      createTemplate: jest.fn(),
      getTemplates: jest.fn(),
      createFromTemplate: jest.fn(),
    };

    mockWorkflowEngine = {
      startWorkflow: jest.fn(),
      pauseWorkflow: jest.fn(),
      resumeWorkflow: jest.fn(),
      cancelWorkflow: jest.fn(),
      retryStep: jest.fn(),
      skipStep: jest.fn(),
      submitApproval: jest.fn(),
      getWorkflowState: jest.fn(),
      updateWorkflowState: jest.fn(),
    };

    mockWorkflowScheduler = {
      getSchedules: jest.fn(),
      scheduleWorkflow: jest.fn(),
      cancelSchedule: jest.fn(),
    };

    // Manual instantiation
    controller = new WorkflowsController(
      mockWorkflowsService,
      mockWorkflowEngine,
      mockWorkflowScheduler
    );

    jest.clearAllMocks();
  });

  describe('Workflow Management', () => {
    describe('create', () => {
      it('should create new workflow', async () => {
        const createDto = {
          name: 'New Approval Workflow',
          description: 'Workflow for document approvals',
          category: 'approval',
          steps: mockWorkflow.steps,
          triggers: mockWorkflow.triggers,
          metadata: mockWorkflow.metadata,
        };

        mockWorkflowsService.create.mockResolvedValue(mockWorkflow);

        const result = await controller.create(mockRequest, createDto);

        expect(mockWorkflowsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            ...createDto,
            organizationId: mockUser.organizationId,
            createdBy: mockUser.id,
          })
        );
        expect(result).toEqual(mockWorkflow);
      });

      it('should handle creation conflicts', async () => {
        const createDto = {
          name: 'Existing Workflow',
          description: 'This name already exists',
          category: 'approval',
          steps: mockWorkflow.steps,
        };

        mockWorkflowsService.create.mockRejectedValue(
          new ConflictException('Workflow with this name already exists')
        );

        await expect(
          controller.create(mockRequest, createDto)
        ).rejects.toThrow(ConflictException);
      });
    });

    describe('findAll', () => {
      it('should return paginated workflows', async () => {
        const query = { page: 1, limit: 10 };
        const mockResult = {
          items: [mockWorkflow],
          total: 1,
          page: 1,
          limit: 10,
        };

        mockWorkflowsService.findAll.mockResolvedValue(mockResult);

        const result = await controller.findAll(mockRequest, query);

        expect(mockWorkflowsService.findAll).toHaveBeenCalledWith({
          ...query,
          organizationId: mockUser.organizationId,
        });
        expect(result).toEqual(mockResult);
      });

      it('should filter workflows by status', async () => {
        const query = {
          page: 1,
          limit: 10,
          status: WorkflowStatus.ACTIVE,
        };

        mockWorkflowsService.findAll.mockResolvedValue({
          items: [mockWorkflow],
          total: 1,
          page: 1,
          limit: 10,
        });

        await controller.findAll(mockRequest, query);

        expect(mockWorkflowsService.findAll).toHaveBeenCalledWith({
          ...query,
          organizationId: mockUser.organizationId,
        });
      });
    });

    describe('findOne', () => {
      it('should return workflow by id', async () => {
        mockWorkflowsService.findOne.mockResolvedValue(mockWorkflow);

        const result = await controller.findOne(
          mockRequest,
          'workflow-123'
        );

        expect(mockWorkflowsService.findOne).toHaveBeenCalledWith(
          'workflow-123',
          mockUser.organizationId
        );
        expect(result).toEqual(mockWorkflow);
      });

      it('should throw NotFoundException when workflow not found', async () => {
        mockWorkflowsService.findOne.mockRejectedValue(new NotFoundException('Workflow not found'));

        await expect(
          controller.findOne(mockRequest, 'invalid-id')
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('update', () => {
      it('should update workflow', async () => {
        const updateDto = {
          name: 'Updated Workflow Name',
          description: 'Updated description',
        };

        const updatedWorkflow = { ...mockWorkflow, ...updateDto };
        mockWorkflowsService.update.mockResolvedValue(updatedWorkflow);

        const result = await controller.update(
          mockRequest,
          'workflow-123',
          updateDto
        );

        expect(mockWorkflowsService.update).toHaveBeenCalledWith(
          'workflow-123',
          {
            ...updateDto,
            modifiedBy: mockUser.id,
          },
          mockUser.organizationId
        );
        expect(result).toEqual(updatedWorkflow);
      });
    });

    describe('publish', () => {
      it('should publish draft workflow', async () => {
        const draftWorkflow = {
          ...mockWorkflow,
          isDraft: true,
          status: WorkflowStatus.DRAFT,
        };
        const publishedWorkflow = {
          ...draftWorkflow,
          isDraft: false,
          status: WorkflowStatus.ACTIVE,
        };

        mockWorkflowsService.publish.mockResolvedValue(publishedWorkflow);

        const result = await controller.publish(
          mockRequest,
          'workflow-123'
        );

        expect(mockWorkflowsService.publish).toHaveBeenCalledWith(
          'workflow-123',
          mockUser.id,
          mockUser.organizationId
        );
        expect(result).toEqual(publishedWorkflow);
      });
    });
  });

  describe('Workflow Execution', () => {
    describe('startWorkflow', () => {
      it('should start workflow instance', async () => {
        const startDto = {
          inputs: {
            document: 'report.pdf',
            description: 'Monthly report',
          },
          context: {
            clientId: 'client-123',
          },
        };

        mockWorkflowEngine.startWorkflow.mockResolvedValue('instance-123');

        const result = await controller.startWorkflow(
          mockRequest,
          'workflow-123',
          startDto
        );

        expect(mockWorkflowEngine.startWorkflow).toHaveBeenCalledWith(
          'workflow-123',
          startDto.inputs,
          {
            organizationId: mockUser.organizationId,
            userId: mockUser.id,
            userRoles: mockUser.roles,
            clientId: startDto.context?.clientId,
            correlationId: startDto.context?.correlationId,
            metadata: { ...startDto.metadata, ...startDto.context?.metadata },
          }
        );
        expect(result).toEqual({ 
          id: 'instance-123',
          workflowId: 'workflow-123',
          status: 'pending',
          context: { clientId: 'client-123' }
        });
      });
    });

    describe('getInstances', () => {
      it('should return workflow instances', async () => {
        const query = { page: 1, limit: 10 };
        const mockResult = {
          items: [mockWorkflowInstance],
          total: 1,
          page: 1,
          limit: 10,
        };

        mockWorkflowsService.getInstances.mockResolvedValue(mockResult);

        const result = await controller.getInstances(
          mockRequest,
          'workflow-123',
          query
        );

        expect(mockWorkflowsService.getInstances).toHaveBeenCalledWith(
          'workflow-123',
          mockUser.organizationId,
          query
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('getInstance', () => {
      it('should return workflow instance', async () => {
        mockWorkflowsService.getInstance.mockResolvedValue(mockWorkflowInstance);

        const result = await controller.getInstance(
          mockRequest,
          'instance-123'
        );

        expect(mockWorkflowsService.getInstance).toHaveBeenCalledWith(
          'instance-123',
          mockUser.organizationId
        );
        expect(result).toEqual(mockWorkflowInstance);
      });
    });

    describe('pauseInstance', () => {
      it('should pause running instance', async () => {
        const pauseDto = {
          reason: 'User requested pause',
        };
        const pausedInstance = {
          ...mockWorkflowInstance,
          status: InstanceStatus.PAUSED,
        };

        mockWorkflowEngine.pauseWorkflow.mockResolvedValue(pausedInstance);

        const result = await controller.pauseInstance(
          mockRequest,
          'instance-123',
          pauseDto
        );

        expect(mockWorkflowEngine.pauseWorkflow).toHaveBeenCalledWith(
          'instance-123',
          mockUser.id,
          pauseDto.reason
        );
        expect(result).toEqual(pausedInstance);
      });
    });

    describe('resumeInstance', () => {
      it('should resume paused instance', async () => {
        const resumedInstance = {
          ...mockWorkflowInstance,
          status: InstanceStatus.RUNNING,
        };

        mockWorkflowEngine.resumeWorkflow.mockResolvedValue(resumedInstance);

        const result = await controller.resumeInstance(
          mockRequest,
          'instance-123'
        );

        expect(mockWorkflowEngine.resumeWorkflow).toHaveBeenCalledWith('instance-123', mockUser.id);
        expect(result).toEqual(resumedInstance);
      });
    });

    describe('cancelInstance', () => {
      it('should cancel running instance', async () => {
        const cancelDto = { reason: 'No longer needed' };
        const cancelledInstance = {
          ...mockWorkflowInstance,
          status: InstanceStatus.CANCELLED,
        };

        mockWorkflowEngine.cancelWorkflow.mockResolvedValue(cancelledInstance);

        const result = await controller.cancelInstance(
          mockRequest,
          'instance-123',
          cancelDto
        );

        expect(mockWorkflowEngine.cancelWorkflow).toHaveBeenCalledWith(
          'instance-123',
          mockUser.id,
          cancelDto.reason
        );
        expect(result).toEqual(cancelledInstance);
      });
    });

    describe('submitApproval', () => {
      it('should submit approval decision', async () => {
        const approvalDto = {
          decision: 'approved',
          comments: 'Looks good',
        };

        const updatedInstance = {
          ...mockWorkflowInstance,
          state: {
            ...mockWorkflowInstance.state,
            approvals: [
              {
                stepId: 'step-2',
                userId: mockUser.id,
                decision: 'approved',
                comments: 'Looks good',
                timestamp: new Date(),
              },
            ],
          },
        };

        mockWorkflowEngine.submitApproval.mockResolvedValue(updatedInstance);

        const result = await controller.submitApproval(
          mockRequest,
          'instance-123',
          'step-2',
          approvalDto
        );

        expect(mockWorkflowEngine.submitApproval).toHaveBeenCalledWith(
          'instance-123',
          'step-2',
          mockUser.id,
          approvalDto.decision,
          approvalDto.comments,
          undefined
        );
        expect(result).toEqual({ success: true, submittedBy: mockUser.id });
      });
    });
  });

  describe('Workflow Templates', () => {
    describe('createTemplate', () => {
      it('should create workflow template', async () => {
        const createTemplateDto = {
          name: 'Approval Template',
          description: 'Standard approval workflow template',
          category: 'approval',
          config: {
            steps: mockWorkflow.steps,
            defaultInputs: {},
            customizable: ['approvers'],
          },
          isPublic: true,
        };

        mockWorkflowsService.createTemplate.mockResolvedValue(mockWorkflowTemplate);

        const result = await controller.createTemplate(
          mockRequest,
          createTemplateDto
        );

        expect(mockWorkflowsService.createTemplate).toHaveBeenCalledWith({
          ...createTemplateDto,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.id,
        });
        expect(result).toEqual(mockWorkflowTemplate);
      });
    });

    describe('getTemplates', () => {
      it('should return workflow templates', async () => {
        const query = { page: 1, limit: 10, category: 'approval' };
        const mockResult = {
          items: [mockWorkflowTemplate],
          total: 1,
          page: 1,
          limit: 10,
        };

        mockWorkflowsService.getTemplates.mockResolvedValue(mockResult);

        const result = await controller.getTemplates(mockRequest, query);

        expect(mockWorkflowsService.getTemplates).toHaveBeenCalledWith(
          mockUser.organizationId,
          query
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('createFromTemplate', () => {
      it('should create workflow from template', async () => {
        const createFromTemplateDto = {
          name: 'Document Approval from Template',
          description: 'Created from standard template',
          customizations: {
            approvers: ['manager-123', 'director-456'],
          },
        };

        mockWorkflowsService.createFromTemplate.mockResolvedValue(mockWorkflow);

        const result = await controller.createFromTemplate(
          mockRequest,
          'template-123',
          createFromTemplateDto
        );

        expect(mockWorkflowsService.createFromTemplate).toHaveBeenCalledWith(
          'template-123',
          createFromTemplateDto,
          mockUser.id,
          mockUser.organizationId
        );
        expect(result).toEqual(mockWorkflow);
      });
    });
  });

  describe('Workflow Scheduling', () => {
    describe('getSchedules', () => {
      it('should return workflow schedules', async () => {
        const mockSchedules = [
          {
            id: 'schedule-123',
            workflowId: 'workflow-123',
            cron: '0 9 * * MON',
            enabled: true,
            nextRun: new Date(),
          },
        ];

        mockWorkflowScheduler.getSchedules.mockResolvedValue(mockSchedules);

        const result = await controller.getSchedules(
          mockRequest,
          'workflow-123'
        );

        expect(mockWorkflowScheduler.getSchedules).toHaveBeenCalledWith(
          'workflow-123',
          mockUser.organizationId
        );
        expect(result).toEqual(mockSchedules);
      });
    });

    describe('scheduleWorkflow', () => {
      it('should schedule workflow', async () => {
        const scheduleDto = {
          cronExpression: '0 10 * * *',
          inputs: {
            report: 'daily-report',
          },
          enabled: true,
        };

        const mockSchedule = {
          id: 'schedule-456',
          workflowId: 'workflow-123',
          cron: scheduleDto.cronExpression,
          inputs: scheduleDto.inputs,
          enabled: true,
          createdAt: new Date(),
        };

        mockWorkflowScheduler.scheduleWorkflow.mockResolvedValue(mockSchedule);

        const result = await controller.scheduleWorkflow(
          mockRequest,
          'workflow-123',
          scheduleDto
        );

        expect(mockWorkflowScheduler.scheduleWorkflow).toHaveBeenCalledWith(
          'workflow-123',
          scheduleDto.cronExpression,
          scheduleDto.inputs,
          {
            organizationId: mockUser.organizationId,
            userId: mockUser.id,
            userRoles: mockUser.roles,
            metadata: {}
          }
        );
        expect(result).toEqual(mockSchedule);
      });
    });

    describe('cancelSchedule', () => {
      it('should cancel workflow schedule', async () => {
        mockWorkflowScheduler.cancelSchedule.mockResolvedValue({
          success: true,
        });

        const result = await controller.cancelSchedule(
          mockRequest,
          'schedule-123'
        );

        expect(mockWorkflowScheduler.cancelSchedule).toHaveBeenCalledWith(
          'schedule-123',
          mockUser.organizationId
        );
        expect(result).toBeUndefined();
      });
    });
  });
});
