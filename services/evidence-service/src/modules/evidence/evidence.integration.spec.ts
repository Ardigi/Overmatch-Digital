import express from 'express';
import request from 'supertest';
import { type Evidence, EvidenceStatus, EvidenceType } from './entities/evidence.entity';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

describe('Evidence Module Integration Tests', () => {
  let app: express.Application;
  let evidenceService: EvidenceService;
  let evidenceController: EvidenceController;
  let mockRepository: any;
  let mockEventEmitter: any;
  let mockStorageService: any;
  let mockLogger: any;

  // In-memory database
  let evidenceDb: Map<string, Evidence>;
  let evidenceIdCounter = 1;

  // Mock user for authentication
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    roles: ['compliance_manager'],
  };

  beforeAll(async () => {
    // Initialize in-memory database
    evidenceDb = new Map();

    // Create mock repository
    mockRepository = {
      create: jest.fn(dto => ({
        id: `evidence-${evidenceIdCounter++}`,
        ...dto,
        clientId: mockUser.organizationId,
        createdBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn(async entity => {
        if (Array.isArray(entity)) {
          return entity.map(e => {
            evidenceDb.set(e.id, e);
            return e;
          });
        }
        evidenceDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async options => {
        let results = Array.from(evidenceDb.values());

        if (options?.where) {
          // Simple filtering
          results = results.filter(evidence => {
            if (options.where.clientId && evidence.clientId !== options.where.clientId) {
              return false;
            }
            if (options.where.status && evidence.status !== options.where.status) {
              return false;
            }
            if (options.where.type && evidence.type !== options.where.type) {
              return false;
            }
            if (options.where.controlId && evidence.controlId !== options.where.controlId) {
              return false;
            }
            if (options.where.auditId && evidence.auditId !== options.where.auditId) {
              return false;
            }
            return true;
          });
        }

        // Simple pagination
        if (options?.skip !== undefined && options?.take !== undefined) {
          const start = options.skip;
          const end = start + options.take;
          results = results.slice(start, end);
        }

        return results;
      }),
      findOne: jest.fn(async options => {
        if (options?.where?.id) {
          return evidenceDb.get(options.where.id);
        }
        return null;
      }),
      update: jest.fn(async (id, updateDto) => {
        const evidence = evidenceDb.get(id);
        if (evidence) {
          Object.assign(evidence, updateDto, { updatedAt: new Date() });
          evidenceDb.set(id, evidence);
        }
        return { affected: evidence ? 1 : 0 };
      }),
      remove: jest.fn(async entity => {
        evidenceDb.delete(entity.id);
        return entity;
      }),
      count: jest.fn(async options => {
        if (options?.where) {
          return Array.from(evidenceDb.values()).filter(evidence => {
            if (options.where.clientId && evidence.clientId !== options.where.clientId) {
              return false;
            }
            if (options.where.status && evidence.status !== options.where.status) {
              return false;
            }
            return true;
          }).length;
        }
        return evidenceDb.size;
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => Array.from(evidenceDb.values())),
      })),
    };

    // Create mock event emitter
    mockEventEmitter = {
      emit: jest.fn(),
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    // Create mock storage service
    mockStorageService = {
      uploadFile: jest.fn().mockResolvedValue({
        key: 'evidence/test-file.pdf',
        url: 'https://storage.example.com/evidence/test-file.pdf',
        size: 1024,
      }),
      deleteFile: jest.fn().mockResolvedValue(true),
      getFileUrl: jest.fn(key => `https://storage.example.com/${key}`),
    };

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create service with mocks
    evidenceService = new EvidenceService(
      mockRepository,
      mockEventEmitter,
      mockStorageService,
      mockLogger
    );

    // Create controller
    evidenceController = new EvidenceController(evidenceService);

    // Create Express app
    app = express();
    app.use(express.json());

    // Simulate authentication middleware
    app.use((req, res, next) => {
      req['user'] = mockUser;
      next();
    });

    // Set up routes
    app.post('/evidence', async (req, res) => {
      try {
        const result = await evidenceController.create(req.body, req['user']);
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ message: 'Validation failed', error: error.message });
      }
    });

    app.get('/evidence', async (req, res) => {
      try {
        const result = await evidenceController.findAll(req.query, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/stats', async (req, res) => {
      try {
        const result = await evidenceController.getStatistics(req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/expiring', async (req, res) => {
      try {
        const daysAhead = parseInt(req.query.daysAhead as string) || 30;
        const result = await evidenceController.getExpiringEvidence(daysAhead, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/audit/:auditId', async (req, res) => {
      try {
        const result = await evidenceController.findByAudit(req.params.auditId, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/control/:controlId', async (req, res) => {
      try {
        const result = await evidenceController.findByControl(req.params.controlId, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/:id', async (req, res) => {
      try {
        const result = await evidenceController.findOne(req.params.id, req['user']);
        if (!result) {
          return res.status(404).json({ message: 'Evidence not found' });
        }
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/evidence/:id/history', async (req, res) => {
      try {
        const result = await evidenceController.getHistory(req.params.id, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.patch('/evidence/:id', async (req, res) => {
      try {
        const result = await evidenceController.update(req.params.id, req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/evidence/upload', async (req, res) => {
      // Simulate file upload
      const fileData = {
        ...req.body,
        metadata: {
          fileName: 'policy.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
        },
      };
      try {
        const result = await evidenceController.uploadEvidence(fileData, req['file'], req['user']);
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/evidence/:id/validate', async (req, res) => {
      try {
        const result = await evidenceController.validate(req.params.id, req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/evidence/bulk-update', async (req, res) => {
      try {
        const result = await evidenceController.bulkUpdate(req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/evidence/bulk-validate', async (req, res) => {
      try {
        const result = await evidenceController.bulkValidate(req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/evidence/bulk-delete', async (req, res) => {
      try {
        const result = await evidenceController.bulkDelete(req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    // Simulate role-based access
    app.use((req, res, next) => {
      if (req.method === 'POST' && req['user'].roles.includes('evidence_viewer')) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    });
  });

  afterEach(() => {
    // Clear database between tests
    evidenceDb.clear();
    evidenceIdCounter = 1;
    jest.clearAllMocks();
  });

  describe('Evidence Collection Workflow', () => {
    let createdEvidenceId: string;

    it('should create new evidence', async () => {
      const createDto = {
        title: 'SOC 2 Access Control Evidence',
        description: 'Screenshot of access control configuration',
        type: EvidenceType.SCREENSHOT,
        controlId: 'control-ac-001',
        metadata: {
          capturedDate: new Date().toISOString(),
          system: 'AWS IAM',
        },
      };

      const response = await request(app).post('/evidence').send(createDto).expect(201);

      expect(response.body).toMatchObject({
        title: createDto.title,
        type: createDto.type,
        status: EvidenceStatus.COLLECTED,
        createdBy: mockUser.id,
      });

      createdEvidenceId = response.body.id;
    });

    it('should upload evidence file', async () => {
      const response = await request(app)
        .post('/evidence/upload')
        .field('title', 'Policy Document Evidence')
        .field('description', 'Information Security Policy')
        .field('type', EvidenceType.DOCUMENT)
        .field('controlId', 'control-policy-001')
        .attach('file', Buffer.from('Test policy content'), 'policy.pdf')
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Policy Document Evidence',
        type: EvidenceType.DOCUMENT,
        metadata: expect.objectContaining({
          fileName: 'policy.pdf',
          mimeType: 'application/pdf',
        }),
      });
    });

    it('should retrieve evidence by ID', async () => {
      // Create evidence first
      const createResponse = await request(app).post('/evidence').send({
        title: 'Test Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-001',
      });

      const response = await request(app).get(`/evidence/${createResponse.body.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: createResponse.body.id,
        title: 'Test Evidence',
      });
    });

    it('should update evidence status', async () => {
      // Create evidence first
      const createResponse = await request(app).post('/evidence').send({
        title: 'Test Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-001',
      });

      const updateDto = {
        status: EvidenceStatus.UNDER_REVIEW,
        reviewComments: 'Evidence appears complete, reviewing details',
      };

      const response = await request(app)
        .patch(`/evidence/${createResponse.body.id}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.status).toBe(EvidenceStatus.UNDER_REVIEW);
    });

    it('should validate evidence', async () => {
      // Create evidence first
      const createResponse = await request(app).post('/evidence').send({
        title: 'Test Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-001',
      });

      const validateDto = {
        isValid: true,
        validationComments: 'Evidence meets SOC 2 requirements',
      };

      const response = await request(app)
        .post(`/evidence/${createResponse.body.id}/validate`)
        .send(validateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        status: EvidenceStatus.VALIDATED,
        validatedBy: mockUser.id,
      });
    });
  });

  describe('Evidence Query and Filtering', () => {
    beforeEach(async () => {
      // Create test data
      const evidenceData = [
        {
          title: 'Firewall Configuration',
          type: EvidenceType.SCREENSHOT,
          controlId: 'control-net-001',
          status: EvidenceStatus.COLLECTED,
        },
        {
          title: 'User Access Review',
          type: EvidenceType.DOCUMENT,
          controlId: 'control-ac-002',
          status: EvidenceStatus.VALIDATED,
        },
        {
          title: 'Backup Logs',
          type: EvidenceType.LOG,
          controlId: 'control-bc-001',
          status: EvidenceStatus.EXPIRED,
        },
      ];

      for (const data of evidenceData) {
        await request(app).post('/evidence').send(data);
      }
    });

    it('should filter evidence by status', async () => {
      const response = await request(app).get('/evidence?status=validated').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(EvidenceStatus.VALIDATED);
    });

    it('should filter evidence by type', async () => {
      const response = await request(app).get('/evidence?type=screenshot').expect(200);

      expect(response.body.data.every(e => e.type === EvidenceType.SCREENSHOT)).toBe(true);
    });

    it('should search evidence by text', async () => {
      const response = await request(app).get('/evidence?search=firewall').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toContain('Firewall');
    });

    it('should paginate results', async () => {
      const response = await request(app).get('/evidence?page=1&limit=2').expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
    });
  });

  describe('Evidence Bulk Operations', () => {
    const evidenceIds: string[] = [];

    beforeEach(async () => {
      // Create multiple evidence items
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/evidence')
          .send({
            title: `Bulk Evidence ${i + 1}`,
            type: EvidenceType.DOCUMENT,
            controlId: `control-bulk-${i + 1}`,
          });
        evidenceIds.push(response.body.id);
      }
    });

    it('should bulk update evidence', async () => {
      const bulkUpdateDto = {
        evidenceIds: evidenceIds.slice(0, 2),
        updates: {
          status: EvidenceStatus.UNDER_REVIEW,
          assignedTo: 'reviewer-123',
        },
      };

      const response = await request(app)
        .post('/evidence/bulk-update')
        .send(bulkUpdateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        updated: 2,
        failed: 0,
      });
    });

    it('should bulk validate evidence', async () => {
      const bulkValidateDto = {
        evidenceIds,
        isValid: true,
        validationComments: 'Bulk validation completed',
      };

      const response = await request(app)
        .post('/evidence/bulk-validate')
        .send(bulkValidateDto)
        .expect(200);

      expect(response.body.validated).toBe(3);
    });

    it('should bulk delete evidence', async () => {
      const bulkDeleteDto = {
        evidenceIds: evidenceIds.slice(0, 2),
        reason: 'Duplicate evidence',
      };

      const response = await request(app)
        .post('/evidence/bulk-delete')
        .send(bulkDeleteDto)
        .expect(200);

      expect(response.body.deleted).toBe(2);
    });
  });

  describe('Evidence Compliance Workflows', () => {
    it('should get expiring evidence', async () => {
      // Create evidence with expiration
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      await request(app).post('/evidence').send({
        title: 'Expiring Certificate',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-exp-001',
        expiresAt: futureDate.toISOString(),
      });

      const response = await request(app).get('/evidence/expiring?daysAhead=30').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Expiring Certificate');
    });

    it('should get evidence by audit', async () => {
      const auditId = 'audit-2024-q1';

      await request(app).post('/evidence').send({
        title: 'Q1 Audit Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-audit-001',
        auditId,
      });

      const response = await request(app).get(`/evidence/audit/${auditId}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].auditId).toBe(auditId);
    });

    it('should get evidence by control', async () => {
      const controlId = 'control-specific-001';

      await request(app).post('/evidence').send({
        title: 'Control Specific Evidence',
        type: EvidenceType.SCREENSHOT,
        controlId,
      });

      const response = await request(app).get(`/evidence/control/${controlId}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].controlId).toBe(controlId);
    });
  });

  describe('Evidence History and Audit Trail', () => {
    it('should track evidence history', async () => {
      // Create evidence
      const createResponse = await request(app).post('/evidence').send({
        title: 'Historical Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-history-001',
      });

      const evidenceId = createResponse.body.id;

      // Update evidence
      await request(app).patch(`/evidence/${evidenceId}`).send({
        title: 'Updated Historical Evidence',
      });

      // Validate evidence
      await request(app).post(`/evidence/${evidenceId}/validate`).send({
        isValid: true,
        validationComments: 'Validated',
      });

      // Get history
      const historyResponse = await request(app).get(`/evidence/${evidenceId}/history`).expect(200);

      expect(historyResponse.body).toHaveLength(3);
      expect(historyResponse.body.map(h => h.action)).toContain('created');
      expect(historyResponse.body.map(h => h.action)).toContain('updated');
      expect(historyResponse.body.map(h => h.action)).toContain('validated');
    });
  });

  describe('Evidence Statistics', () => {
    it('should return evidence statistics', async () => {
      // Create some evidence first
      await request(app).post('/evidence').send({
        title: 'Test Evidence',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-001',
      });

      const response = await request(app).get('/evidence/stats').expect(200);

      expect(response.body).toMatchObject({
        total: expect.any(Number),
        byStatus: expect.objectContaining({
          collected: expect.any(Number),
          validated: expect.any(Number),
        }),
        byType: expect.objectContaining({
          document: expect.any(Number),
          screenshot: expect.any(Number),
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid evidence ID format', async () => {
      await request(app).get('/evidence/invalid-id').expect(400);
    });

    it('should handle evidence not found', async () => {
      await request(app).get('/evidence/123e4567-e89b-12d3-a456-426614174000').expect(404);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/evidence')
        .send({
          description: 'Missing required fields',
        })
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });
  });
});
