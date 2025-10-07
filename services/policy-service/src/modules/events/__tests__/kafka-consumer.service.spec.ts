import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Consumer, type EachMessagePayload, Kafka } from 'kafkajs';
import { Repository } from 'typeorm';
import { TestDataBuilder } from '../../../../test/utils/test-helpers';
import { Control, ImplementationStatus } from '../../compliance/entities/control.entity';
import { ComplianceFramework } from '../../compliance/entities/framework.entity';
import { Policy } from '../../policies/entities/policy.entity';
import { Risk, RiskCategory, RiskLevel, RiskStatus } from '../../risks/entities/risk.entity';
import { KafkaConsumerService } from '../kafka-consumer.service';

// Mock Kafka
jest.mock('kafkajs', () => {
  const mockConsumer = {
    connect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockKafka = {
    consumer: jest.fn(() => mockConsumer),
  };

  return {
    Kafka: jest.fn(() => mockKafka),
    Consumer: jest.fn(),
  };
});

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let configService: ConfigService;
  let mockConsumer: any;
  let mockEachMessageHandler: (payload: EachMessagePayload) => Promise<void>;

  // Helper function to create mock Kafka messages
  const createMockMessage = (event: any): EachMessagePayload => ({
    topic: 'compliance-events',
    partition: 0,
    message: {
      value: Buffer.from(JSON.stringify(event)),
      key: null,
      timestamp: new Date().toISOString(),
      headers: {},
      offset: '0',
    },
    heartbeat: jest.fn(),
    pause: jest.fn(),
  } as unknown as EachMessagePayload);

  // Mock repositories following TypeORM/Jest pattern
  const mockPolicyRepository = TestDataBuilder.createMockRepository();
  const mockControlRepository = TestDataBuilder.createMockRepository();
  const mockRiskRepository = TestDataBuilder.createMockRepository();
  const mockFrameworkRepository = TestDataBuilder.createMockRepository();

  const mockConfigService = {
    get: jest.fn().mockReturnValue('localhost:9092'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaConsumerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'PolicyRepository',
          useValue: mockPolicyRepository,
        },
        {
          provide: 'ControlRepository',
          useValue: mockControlRepository,
        },
        {
          provide: 'RiskRepository',
          useValue: mockRiskRepository,
        },
        {
          provide: 'FrameworkRepository',
          useValue: mockFrameworkRepository,
        },
      ],
    }).compile();

    service = module.get<KafkaConsumerService>(KafkaConsumerService);
    configService = module.get<ConfigService>(ConfigService);

    // Get the mock consumer instance
    const kafka = new Kafka({ clientId: 'test', brokers: ['localhost:9092'] });
    mockConsumer = kafka.consumer({ groupId: 'test-group' });

    // Capture the eachMessage handler
    mockConsumer.run.mockImplementation(({ eachMessage }) => {
      mockEachMessageHandler = eachMessage;
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize Kafka consumer on module init', async () => {
      await service.onModuleInit();

      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topics: ['compliance-events', 'control-events', 'risk-events'],
        fromBeginning: false,
      });
      expect(mockConsumer.run).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockConsumer.connect.mockRejectedValue(new Error('Connection failed'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect Kafka consumer')
      );
    });

    it('should disconnect consumer on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockConsumer.disconnect).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    describe('compliance.control.implemented', () => {
      it('should update control status when control is implemented', async () => {
        const mockControl = {
          id: 'control-123',
          implementationStatus: ImplementationStatus.NOT_STARTED,
          version: 1,
          changeHistory: [],
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);

        const event = {
          type: 'compliance.control.implemented',
          timestamp: new Date(),
          userId: 'user-123',
          organizationId: 'org-123',
          metadata: {
            controlId: 'control-123',
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControlRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'control-123' },
        });

        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            implementationStatus: ImplementationStatus.IMPLEMENTED,
            implementationDate: expect.any(Date),
            version: 2,
            changeHistory: expect.arrayContaining([
              expect.objectContaining({
                version: 2,
                changedBy: 'user-123',
                changes: { implementationStatus: ImplementationStatus.IMPLEMENTED },
                reason: 'Control implemented via event',
              }),
            ]),
          })
        );
      });

      it('should handle missing control gracefully', async () => {
        mockControlRepository.findOne.mockResolvedValue(null);
        const loggerSpy = jest.spyOn(Logger.prototype, 'log');

        const event = {
          type: 'compliance.control.implemented',
          timestamp: new Date(),
          metadata: { controlId: 'non-existent' },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControlRepository.save).not.toHaveBeenCalled();
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Processing control implemented')
        );
      });

      it('should handle database errors', async () => {
        mockControlRepository.findOne.mockRejectedValue(new Error('DB error'));
        const loggerSpy = jest.spyOn(Logger.prototype, 'error');

        const event = {
          type: 'compliance.control.implemented',
          timestamp: new Date(),
          metadata: { controlId: 'control-123' },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error updating control'));
      });
    });

    describe('compliance.control.failed', () => {
      it('should create a new risk when control fails', async () => {
        const mockControl = {
          id: 'control-123',
          title: 'Access Control',
          implementationStatus: ImplementationStatus.IMPLEMENTED,
          organizationId: 'org-123',
          ownerId: 'owner-123',
          ownerName: 'John Doe',
          ownerEmail: 'john@example.com',
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);
        mockRiskRepository.findOne.mockResolvedValue(null); // No existing risk

        const event = {
          type: 'compliance.control.failed',
          timestamp: new Date(),
          userId: 'user-123',
          organizationId: 'org-123',
          metadata: {
            controlId: 'control-123',
            reason: 'Failed security audit',
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockRiskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Control Failure: Access Control',
            description: expect.stringContaining('Failed security audit'),
            category: RiskCategory.COMPLIANCE,
            status: RiskStatus.IDENTIFIED,
            organizationId: 'org-123',
            assessment: expect.objectContaining({
              inherentRisk: expect.objectContaining({
                level: RiskLevel.MEDIUM,
              }),
            }),
          })
        );

        expect(mockRiskRepository.save).toHaveBeenCalled();
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            implementationStatus: ImplementationStatus.NOT_IMPLEMENTED,
          })
        );
      });

      it('should not create duplicate risks', async () => {
        const existingRisk = { id: 'risk-123' };
        mockRiskRepository.findOne.mockResolvedValue(existingRisk);

        const event = {
          type: 'compliance.control.failed',
          timestamp: new Date(),
          organizationId: 'org-123',
          metadata: {
            controlId: 'control-123',
            reason: 'Failed again',
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockRiskRepository.create).not.toHaveBeenCalled();
        expect(mockRiskRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('compliance.control.tested', () => {
      it('should update control with test results - pass', async () => {
        const mockControl = {
          id: 'control-123',
          implementationStatus: ImplementationStatus.IMPLEMENTED,
          addTestResult: jest.fn(),
          updateEffectiveness: jest.fn(),
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);

        const event = {
          type: 'compliance.control.tested',
          timestamp: new Date(),
          userId: 'tester-123',
          metadata: {
            controlId: 'control-123',
            testResult: 'pass',
            findings: [],
            samplesTested: 100,
            evidenceIds: ['evidence-1', 'evidence-2'],
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControl.addTestResult).toHaveBeenCalledWith({
          tester: 'tester-123',
          result: 'pass',
          findings: [],
          exceptions: undefined,
          samplesTested: 100,
          evidenceIds: ['evidence-1', 'evidence-2'],
        });

        expect(mockControl.updateEffectiveness).toHaveBeenCalledWith(90, []);
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            implementationStatus: ImplementationStatus.IMPLEMENTED,
          })
        );
      });

      it('should handle partial test results', async () => {
        const mockControl = {
          id: 'control-123',
          addTestResult: jest.fn(),
          updateEffectiveness: jest.fn(),
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);

        const event = {
          type: 'compliance.control.tested',
          timestamp: new Date(),
          metadata: {
            controlId: 'control-123',
            testResult: 'partial',
            findings: ['Minor issue found'],
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControl.updateEffectiveness).toHaveBeenCalledWith(60, ['Minor issue found']);
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            implementationStatus: ImplementationStatus.PARTIAL,
          })
        );
      });

      it('should handle failed test results', async () => {
        const mockControl = {
          id: 'control-123',
          addTestResult: jest.fn(),
          updateEffectiveness: jest.fn(),
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);

        const event = {
          type: 'compliance.control.tested',
          timestamp: new Date(),
          metadata: {
            controlId: 'control-123',
            testResult: 'fail',
            findings: ['Critical security gap', 'No evidence provided'],
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControl.updateEffectiveness).toHaveBeenCalledWith(20, [
          'Critical security gap',
          'No evidence provided',
        ]);
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            implementationStatus: ImplementationStatus.NOT_IMPLEMENTED,
          })
        );
      });
    });

    describe('compliance.evidence.collected', () => {
      it('should update multiple controls with evidence data', async () => {
        const mockControls = [
          { id: 'control-1', evidenceIds: [], changeHistory: [], version: 1 },
          { id: 'control-2', evidenceIds: ['existing-evidence'], changeHistory: [], version: 2 },
        ];

        mockControlRepository.findOne
          .mockResolvedValueOnce(mockControls[0])
          .mockResolvedValueOnce(mockControls[1]);

        const event = {
          type: 'compliance.evidence.collected',
          timestamp: new Date(),
          userId: 'collector-123',
          metadata: {
            evidenceId: 'evidence-new',
            controlIds: ['control-1', 'control-2'],
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControlRepository.save).toHaveBeenCalledTimes(2);
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'control-1',
            evidenceIds: ['evidence-new'],
            version: 2,
          })
        );
        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'control-2',
            evidenceIds: ['existing-evidence', 'evidence-new'],
            version: 3,
          })
        );
      });
    });

    describe('compliance.risk.identified', () => {
      it('should update control risk assessments', async () => {
        const mockControl = {
          id: 'control-123',
          riskAssessment: null,
        };

        mockControlRepository.findOne.mockResolvedValue(mockControl);

        const event = {
          type: 'compliance.risk.identified',
          timestamp: new Date(),
          metadata: {
            riskId: 'risk-new',
            controlIds: ['control-123'],
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockControlRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            riskAssessment: expect.objectContaining({
              inherentRisk: expect.any(Object),
              residualRisk: expect.any(Object),
              risksAddressed: ['risk-new'],
            }),
          })
        );
      });
    });

    describe('compliance.policy.updated', () => {
      it('should create risk for major policy changes', async () => {
        const mockPolicy = {
          id: 'policy-123',
          title: 'Security Policy',
          organizationId: 'org-123',
          ownerId: 'owner-123',
          ownerName: 'Policy Owner',
        };

        mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);

        const event = {
          type: 'compliance.policy.updated',
          timestamp: new Date(),
          userId: 'updater-123',
          organizationId: 'org-123',
          metadata: {
            policyId: 'policy-123',
            changeType: 'major',
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockRiskRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Policy Change Risk: Security Policy',
            category: RiskCategory.COMPLIANCE,
            status: RiskStatus.IDENTIFIED,
            assessment: expect.objectContaining({
              inherentRisk: expect.objectContaining({
                level: RiskLevel.MEDIUM,
              }),
            }),
          })
        );

        expect(mockRiskRepository.save).toHaveBeenCalled();
      });

      it('should not create risk for minor policy changes', async () => {
        const event = {
          type: 'compliance.policy.updated',
          timestamp: new Date(),
          metadata: {
            policyId: 'policy-123',
            changeType: 'minor',
          },
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(mockRiskRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle malformed messages', async () => {
        const loggerSpy = jest.spyOn(Logger.prototype, 'error');

        const malformedMessage = {
          topic: 'compliance-events',
          partition: 0,
          message: {
            value: Buffer.from('invalid json'),
            key: null,
            timestamp: new Date().toISOString(),
            headers: {},
            offset: '0',
          },
          heartbeat: jest.fn(),
          pause: jest.fn(),
        };

        await mockEachMessageHandler(malformedMessage as any);

        expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing message'));
      });

      it('should log warning for unhandled event types', async () => {
        const loggerSpy = jest.spyOn(Logger.prototype, 'warn');

        const event = {
          type: 'unknown.event.type',
          timestamp: new Date(),
        };

        await mockEachMessageHandler(createMockMessage(event));

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Unhandled event type: unknown.event.type')
        );
      });

      it('should continue processing after individual message errors', async () => {
        mockControlRepository.findOne.mockRejectedValueOnce(new Error('DB error'));
        mockControlRepository.findOne.mockResolvedValueOnce({ id: 'control-2' });

        const events = [
          {
            type: 'compliance.control.implemented',
            metadata: { controlId: 'control-1' },
          },
          {
            type: 'compliance.control.implemented',
            metadata: { controlId: 'control-2' },
          },
        ];

        for (const event of events) {
          await mockEachMessageHandler(createMockMessage(event));
        }

        expect(mockControlRepository.findOne).toHaveBeenCalledTimes(2);
        expect(mockControlRepository.save).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Security and Compliance', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should validate event source organization matches resource organization', async () => {
      const mockControl = {
        id: 'control-123',
        organizationId: 'org-123',
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const event = {
        type: 'compliance.control.implemented',
        timestamp: new Date(),
        organizationId: 'different-org-456', // Different org
        metadata: { controlId: 'control-123' },
      };

      await mockEachMessageHandler(createMockMessage(event));

      // Should not update control from different organization
      expect(mockControlRepository.save).not.toHaveBeenCalled();
    });

    it('should sanitize user input in event metadata', async () => {
      const event = {
        type: 'compliance.control.failed',
        timestamp: new Date(),
        metadata: {
          controlId: 'control-123',
          reason: '<script>alert("XSS")</script>Malicious input',
        },
      };

      await mockEachMessageHandler(createMockMessage(event));

      // The service should handle this gracefully
      // In a real implementation, you'd want to sanitize the input
      expect(mockRiskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.not.stringContaining('<script>'),
        })
      );
    });

    it('should maintain audit trail for all changes', async () => {
      const mockControl = {
        id: 'control-123',
        changeHistory: [],
        version: 1,
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const event = {
        type: 'compliance.control.implemented',
        timestamp: new Date(),
        userId: 'user-123',
        metadata: { controlId: 'control-123' },
      };

      await mockEachMessageHandler(createMockMessage(event));

      expect(mockControlRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          changeHistory: expect.arrayContaining([
            expect.objectContaining({
              changedBy: 'user-123',
              changedAt: expect.any(Date),
              reason: expect.any(String),
            }),
          ]),
        })
      );
    });
  });

  describe('Performance', () => {
    it('should handle high message throughput', async () => {
      await service.onModuleInit();

      const messages = Array.from({ length: 1000 }, (_, i) => ({
        type: 'compliance.control.implemented',
        timestamp: new Date(),
        metadata: { controlId: `control-${i}` },
      }));

      mockControlRepository.findOne.mockResolvedValue({ id: 'control-123' });

      const startTime = Date.now();

      for (const message of messages) {
        await mockEachMessageHandler(createMockMessage(message));
      }

      const duration = Date.now() - startTime;

      // Should process 1000 messages reasonably quickly
      expect(duration).toBeLessThan(5000); // 5 seconds for 1000 messages
    });
  });
});
