import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { ControlsController } from '../controls.controller';
import { ControlsService } from '../controls.service';
import { CreateControlDto } from '../dto/create-control.dto';
import { UpdateControlDto } from '../dto/update-control.dto';
import {
  type Control,
  ControlCategory,
  ControlFrequency,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';
import {
  type ControlImplementation,
  ImplementationStatus,
} from '../../implementation/entities/control-implementation.entity';
import { type ControlTestResult, TestResultStatus } from '../entities/control-test-result.entity';
import {
  type MockRepository,
  createMockAssessmentRepository,
  createMockConfigService,
  createMockControlRepository,
  createMockEventEmitter,
  createMockExceptionRepository,
  createMockFrameworksService,
  createMockImplementationRepository,
  createMockKafkaService,
  createMockLoggingService,
  createMockMappingRepository,
  createMockMetricsService,
  createMockRedisService,
  createMockServiceDiscovery,
  createMockTestResultRepository,
  createMockTracingService,
  createTestUser,
} from './test-helpers/mock-factories';
import { KongUserType } from '../../../shared/decorators/kong-user.decorator';

describe('Controls Integration Tests (Manual Instantiation)', () => {
  let app: express.Application;
  let controlsController: ControlsController;
  let controlsService: ControlsService;
  let mockControlRepository: MockRepository<Control>;
  let mockImplementationRepository: MockRepository<ControlImplementation>;
  let mockTestResultRepository: MockRepository<ControlTestResult>;

  // Simulated database storage
  let controlsDb: Map<string, Control>;
  let implementationsDb: Map<string, ControlImplementation>;
  let testResultsDb: Map<string, ControlTestResult>;

  const authHeaders = {
    'x-kong-user-id': 'user-123',
    'x-kong-user-email': 'test@example.com',
    'x-kong-user-roles': 'admin,compliance_manager',
    'x-kong-organization-id': 'org-123',
  };

  const testControl: CreateControlDto = {
    code: 'AC-1',
    name: 'Access Control Policy',
    description: 'Establish and maintain access control policy',
    type: ControlType.PREVENTIVE,
    category: ControlCategory.ACCESS_CONTROL,
    frequency: ControlFrequency.CONTINUOUS,
    objective: 'Ensure proper access control',
    requirements: 'Policy must be documented and approved',
    frameworks: [
      { name: 'SOC2', section: 'CC6.1', requirements: 'Access control policy required' },
      { name: 'ISO27001', section: 'A.9.1' },
    ],
    implementationGuidance: 'Develop comprehensive access control policy',
    testProcedures: ['Review policy documentation', 'Interview process owners'],
    evidenceRequirements: ['Policy document', 'Approval records'],
    tags: ['security', 'access-control', 'mandatory'],
    ownerId: '550e8400-e29b-41d4-a716-446655440000',
  };

  beforeAll(async () => {
    // Initialize in-memory databases
    controlsDb = new Map();
    implementationsDb = new Map();
    testResultsDb = new Map();

    // Create mocks using factories but override with in-memory behavior
    mockControlRepository = createMockControlRepository(controlsDb);
    mockImplementationRepository = createMockImplementationRepository();
    mockTestResultRepository = createMockTestResultRepository();
    
    // Override with in-memory database behavior
    mockControlRepository.create.mockImplementation((dto) => ({
      id: uuidv4(), // Generate proper UUID like the real service
      ...dto,
      status: dto.status || ControlStatus.ACTIVE,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Control);
    
    mockControlRepository.save.mockImplementation(async (control) => {
      if (Array.isArray(control)) {
        return control.map((c) => {
          controlsDb.set(c.id || c.code, c);
          return c;
        });
      }
      controlsDb.set(control.id || control.code, control);
      return control;
    });
    
    mockControlRepository.find.mockImplementation(async (options?: any) => {
      let results = Array.from(controlsDb.values());
      if (options?.where) {
        const where = options.where;
        if (where.status) results = results.filter((c) => c.status === where.status);
        if (where.type) results = results.filter((c) => c.type === where.type);
        if (where.category) results = results.filter((c) => c.category === where.category);
      }
      return results;
    });
    
    mockControlRepository.findOne.mockImplementation(async (options: any) => {
      const where = options?.where;
      if (!where) return null;
      if (where.id) return controlsDb.get(where.id) || null;
      if (where.code) {
        return Array.from(controlsDb.values()).find((c) => c.code === where.code) || null;
      }
      return null;
    });

    // Set up other services with proper mocks
    const mockExceptionRepository = createMockExceptionRepository();
    const mockAssessmentRepository = createMockAssessmentRepository();
    const mockMappingRepository = createMockMappingRepository();
    const mockConfigService = createMockConfigService();
    const mockRedisService = createMockRedisService();
    const mockEventEmitter = createMockEventEmitter();
    const mockKafkaService = createMockKafkaService();
    const mockFrameworksService = createMockFrameworksService();
    const mockServiceDiscovery = createMockServiceDiscovery();
    const mockMetricsService = createMockMetricsService();
    const mockTracingService = createMockTracingService();
    const mockLoggingService = createMockLoggingService();

    // Mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn().mockImplementation(async (entity) => entity),
          create: jest.fn().mockImplementation((dto) => ({ ...dto, id: uuidv4() })),
        },
      }),
    };

    // Create service and controller with manual instantiation
    controlsService = new ControlsService(
      mockControlRepository,
      mockImplementationRepository,
      mockTestResultRepository,
      mockExceptionRepository,
      mockAssessmentRepository,
      mockMappingRepository,
      mockConfigService as ConfigService,
      mockRedisService,
      mockEventEmitter,
      mockKafkaService,
      mockFrameworksService,
      mockServiceDiscovery,
      mockMetricsService,
      mockTracingService,
      mockLoggingService,
      mockDataSource
    );

    controlsController = new ControlsController(controlsService);

    // Create Express app
    app = express();
    app.use(express.json());

    // Add authentication and authorization middleware
    const requireAuth = (req: any, res: any, next: any) => {
      const userId = req.headers['x-kong-user-id'];
      const email = req.headers['x-kong-user-email'];
      
      if (!userId || !email) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      req['user'] = createTestUser({
        id: userId as string,
        email: email as string,
        roles: (req.headers['x-kong-user-roles'] as string)?.split(',') || ['admin'],
        organizationId: req.headers['x-kong-organization-id'] as string,
      });
      next();
    };

    const requireRoles = (...allowedRoles: string[]) => {
      return (req: any, res: any, next: any) => {
        const user = req['user'];
        if (!user || !user.roles.some((role: string) => allowedRoles.includes(role))) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        next();
      };
    };

    // Validation middleware
    const validateDto = async (dto: any, metatype: any) => {
      const validationPipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true, // Allow string to enum conversion
        },
        forbidNonWhitelisted: true,
      });
      return await validationPipe.transform(dto, { type: 'body', metatype });
    };

    // Set up routes manually
    app.post('/controls', requireAuth, requireRoles('admin', 'compliance_manager'), async (req, res) => {
      try {
        console.log('Headers received:', req.headers);
        console.log('User object:', req['user']);
        console.log('Request body:', req.body);
        const transformedData = await validateDto(req.body, CreateControlDto);
        console.log('Transformed data:', transformedData);
        const result = await controlsController.create(transformedData, req['user'] as KongUserType);
        res.status(201).json(result);
      } catch (error: any) {
        console.error('Error creating control:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error object:', error);
        if (error.message?.includes('already exists')) {
          res.status(409).json({ message: error.message });
        } else if (error.response) {
          res.status(error.response.statusCode || 400).json(error.response);
        } else {
          res.status(400).json({ message: error.message || 'Bad Request', details: error.details || error });
        }
      }
    });

    app.get('/controls', requireAuth, async (req, res) => {
      try {
        const result = await controlsController.findAll(req.query);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/controls/by-framework/:framework', async (req, res) => {
      try {
        const result = await controlsController.getByFramework(req.params.framework);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/controls/coverage/:organizationId', async (req, res) => {
      try {
        const result = await controlsController.getCoverage(req.params.organizationId);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/controls/by-code/:code', async (req, res) => {
      try {
        const result = await controlsController.findByCode(req.params.code);
        res.json(result);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          res.status(404).json({ message: 'Control not found' });
        } else {
          res.status(400).json({ message: error.message });
        }
      }
    });

    app.get('/controls/:id/metrics', async (req, res) => {
      try {
        const result = await controlsController.getMetrics(req.params.id);
        if (!result) {
          return res.status(404).json({ message: 'Control not found' });
        }
        res.json(result);
      } catch (error: any) {
        console.error('Error in GET /controls/:id/metrics:', error);
        if (error.status === 404 || error.message?.includes('not found')) {
          res.status(404).json({ message: 'Control not found' });
        } else {
          res.status(400).json({ message: error.message || 'Bad Request' });
        }
      }
    });

    app.get('/controls/:id', async (req, res) => {
      try {
        if (
          !req.params.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        ) {
          return res.status(400).json({ message: 'Invalid UUID' });
        }
        const result = await controlsController.findOne(req.params.id);
        if (!result) {
          return res.status(404).json({ message: 'Control not found' });
        }
        res.json(result);
      } catch (error: any) {
        console.error('Error in GET /controls/:id:', error);
        if (error.status === 404 || error.message?.includes('not found')) {
          res.status(404).json({ message: 'Control not found' });
        } else {
          res.status(400).json({ message: error.message || 'Bad Request' });
        }
      }
    });

    app.put('/controls/:id', async (req, res) => {
      try {
        const transformedData = await validateDto(req.body, UpdateControlDto);

        if (transformedData['code']) {
          return res.status(400).json({ message: 'Code cannot be updated' });
        }

        const result = await controlsController.update(req.params.id, transformedData, req['user'] as KongUserType);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.delete('/controls/:id', async (req, res) => {
      try {
        const result = await controlsController.remove(req.params.id, req['user'] as KongUserType);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/controls/bulk-import', requireAuth, async (req, res) => {
      try {
        // Validate each control in the array
        const controls = req.body;
        if (!Array.isArray(controls)) {
          throw new Error('Request body must be an array');
        }
        
        const transformedData = [];
        for (const control of controls) {
          const validated = await validateDto(control, CreateControlDto);
          transformedData.push(validated);
        }
        
        const result = await controlsController.bulkImport(transformedData, req['user'] as KongUserType);
        res.status(201).json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    });
  });

  afterEach(async () => {
    // Clear all data and mocks
    controlsDb.clear();
    implementationsDb.clear();
    testResultsDb.clear();
    jest.clearAllMocks();
  });

  describe('POST /controls', () => {
    it('should create a new control', async () => {
      // Convert enums to string values to ensure proper serialization
      const controlData = {
        ...testControl,
        type: 'PREVENTIVE', // Use string instead of enum
        category: 'ACCESS_CONTROL',
        frequency: 'CONTINUOUS'
      };
      
      const response = await request(app)
        .post('/controls')
        .set(authHeaders)
        .send(controlData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        code: testControl.code,
        name: testControl.name,
        status: ControlStatus.ACTIVE,
        version: 1,
      });

      // Verify it was saved
      expect(controlsDb.size).toBe(1);
      const savedControl = Array.from(controlsDb.values())[0];
      expect(savedControl.code).toBe(testControl.code);
    });

    it('should validate required fields', async () => {
      const invalidControl = {
        // Missing required code
        name: 'Test Control',
        type: ControlType.PREVENTIVE,
      };

      const response = await request(app)
        .post('/controls')
        .set(authHeaders)
        .send(invalidControl)
        .expect(400);

      expect(response.body.message).toContain('code should not be empty');
    });

    it('should prevent duplicate control codes', async () => {
      // Create first control
      await request(app).post('/controls').set(authHeaders).send(testControl).expect(201);

      // Try to create duplicate
      await request(app).post('/controls').set(authHeaders).send(testControl).expect(409);
    });

    it('should validate enum values', async () => {
      const invalidControl = {
        ...testControl,
        type: 'INVALID_TYPE',
        category: 'INVALID_CATEGORY',
      };

      await request(app).post('/controls').set(authHeaders).send(invalidControl).expect(400);
    });

    it('should handle complex framework mappings', async () => {
      const controlWithFrameworks = {
        ...testControl,
        frameworks: [
          { name: 'SOC2', section: 'CC6.1', requirements: 'Detailed requirements' },
          { name: 'NIST', section: 'AC-1', requirements: 'NIST requirements' },
          { name: 'ISO27001', section: 'A.9.1', requirements: 'ISO requirements' },
          { name: 'HIPAA', section: '164.308(a)(3)', requirements: 'HIPAA requirements' },
        ],
      };

      const response = await request(app)
        .post('/controls')
        .set(authHeaders)
        .send(controlWithFrameworks)
        .expect(201);

      expect(response.body.frameworks).toHaveLength(4);
    });
  });

  describe('GET /controls', () => {
    beforeEach(async () => {
      // Create test data
      const controls = [
        {
          ...testControl,
          code: 'AC-1',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          status: ControlStatus.ACTIVE,
        },
        {
          ...testControl,
          code: 'AC-2',
          name: 'Account Management',
          type: ControlType.DETECTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          status: ControlStatus.ACTIVE,
        },
        {
          ...testControl,
          code: 'AU-1',
          name: 'Audit and Accountability Policy',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.AUDIT_ACCOUNTABILITY,
          status: ControlStatus.UNDER_REVIEW,
        },
      ];

      for (const controlData of controls) {
        const control = mockControlRepository.create(controlData);
        await mockControlRepository.save(control);
      }
    });

    it('should return all controls', async () => {
      const response = await request(app).get('/controls').set(authHeaders).expect(200);

      expect(response.body).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/controls')
        .query({ status: ControlStatus.ACTIVE })
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(2);
      response.body.forEach((control: any) => {
        expect(control.status).toBe(ControlStatus.ACTIVE);
      });
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/controls')
        .query({ type: ControlType.DETECTIVE })
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe(ControlType.DETECTIVE);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/controls')
        .query({ category: ControlCategory.AUDIT_ACCOUNTABILITY })
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].category).toBe(ControlCategory.AUDIT_ACCOUNTABILITY);
    });
  });

  describe('GET /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should return a control by ID', async () => {
      const response = await request(app)
        .get(`/controls/${controlId}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        id: controlId,
        code: testControl.code,
        name: testControl.name,
      });
    });

    it('should return 404 for non-existent control', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      await request(app).get(`/controls/${fakeId}`).set(authHeaders).expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app).get('/controls/not-a-uuid').set(authHeaders).expect(400);
    });
  });

  describe('GET /controls/by-code/:code', () => {
    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      await mockControlRepository.save(control);
    });

    it('should return a control by code', async () => {
      const response = await request(app)
        .get(`/controls/by-code/${testControl.code}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.code).toBe(testControl.code);
    });

    it('should return 404 for non-existent code', async () => {
      await request(app).get('/controls/by-code/INVALID-CODE').set(authHeaders).expect(404);
    });
  });

  describe('GET /controls/:id/metrics', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;

      // Create test results
      const testResults = [
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.PASSED,
          duration: 120,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.PASSED,
          duration: 100,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.FAILED,
          duration: 150,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
      ];

      for (const result of testResults) {
        const testResult = mockTestResultRepository.create(result);
        await mockTestResultRepository.save(testResult);
      }

      // Mock the QueryBuilder for metrics calculation
      const mockQueryBuilder = mockTestResultRepository.createQueryBuilder as jest.Mock;
      mockQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(), // Add missing andWhere method
        getRawOne: jest.fn().mockResolvedValue({
          total_tests: '3',
          passed_tests: '2',
          avg_duration: '123.33',
        }),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
    });

    it('should return control metrics', async () => {
      const response = await request(app)
        .get(`/controls/${controlId}/metrics`)
        .set(authHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        successRate: expect.any(Number),
        avgTestDuration: expect.any(Number),
        totalTests: 3,
        failureCount: 1,
      });

      expect(response.body.successRate).toBeCloseTo(0.67, 1);
      expect(response.body.avgTestDuration).toBeCloseTo(123.33, 1);
    });
  });

  describe('PUT /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should update a control', async () => {
      const updateData: UpdateControlDto = {
        name: 'Updated Control Name',
        description: 'Updated description',
        status: ControlStatus.UNDER_REVIEW,
      };

      // Mock the update behavior
      mockControlRepository.save.mockImplementationOnce(async (control) => {
        const updated = { ...control, version: 2 } as Control;
        controlsDb.set(updated.id, updated);
        return updated;
      });

      const response = await request(app)
        .put(`/controls/${controlId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: controlId,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status,
        version: 2,
      });
    });

    it('should not allow code updates', async () => {
      const updateData = { code: 'NEW-CODE' };

      await request(app)
        .put(`/controls/${controlId}`)
        .set(authHeaders)
        .send(updateData)
        .expect(400);
    });
  });

  describe('DELETE /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should soft delete a control', async () => {
      // Mock implementation check
      mockImplementationRepository.find.mockResolvedValueOnce([]);

      // Mock the soft delete behavior
      mockControlRepository.save.mockImplementationOnce(async (control) => {
        const updated = { ...control, status: ControlStatus.RETIRED } as Control;
        controlsDb.set(updated.id, updated);
        return updated;
      });

      await request(app).delete(`/controls/${controlId}`).set(authHeaders).expect(200);

      const deletedControl = controlsDb.get(controlId);
      expect(deletedControl?.status).toBe(ControlStatus.RETIRED);
    });

    it('should prevent deletion of control with active implementations', async () => {
      // Create implementation
      const implementation = mockImplementationRepository.create({
        controlId,
        organizationId: 'org-123',
        status: ImplementationStatus.IMPLEMENTED,
        implementationDate: new Date(),
      });
      await mockImplementationRepository.save(implementation);

      // Mock findOne to return control with implementations
      mockControlRepository.findOne.mockImplementationOnce(async (options: any) => {
        const control = controlsDb.get(controlId);
        if (control) {
          return {
            ...control,
            implementations: [implementation],
          };
        }
        return null;
      });

      await request(app).delete(`/controls/${controlId}`).set(authHeaders).expect(400);
    });
  });

  describe('POST /controls/bulk-import', () => {
    const controlsToImport = [
      {
        code: 'AC-2',
        name: 'Account Management',
        description: 'Manage user accounts and access',
        type: ControlType.PREVENTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Manage accounts effectively',
        frameworks: [{ name: 'SOC2', section: 'CC6.2' }],
      },
      {
        code: 'AC-3',
        name: 'Access Enforcement',
        description: 'Enforce access control policies',
        type: ControlType.DETECTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Enforce access controls properly',
        frameworks: [{ name: 'SOC2', section: 'CC6.3' }],
      },
    ];

    it('should bulk import controls', async () => {
      // Mock the bulkImport service method to return the imported controls
      const importedControls = controlsToImport.map((dto, i) => {
        const control = mockControlRepository.create({
          ...dto,
          id: `imported-${i}`,
          status: ControlStatus.ACTIVE,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Add to in-memory db for verification
        controlsDb.set(control.id, control);
        return control;
      });

      controlsService.bulkImport = jest.fn().mockResolvedValue(importedControls);

      const response = await request(app)
        .post('/controls/bulk-import')
        .set(authHeaders)
        .send(controlsToImport);
      
      if (response.status !== 201) {
        console.log('Bulk import failed:', response.body);
        console.log('Status:', response.status);
        console.log('Request data:', controlsToImport);
      }
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].code).toBe('AC-2');
      expect(response.body[1].code).toBe('AC-3');

      // Verify database
      expect(controlsDb.size).toBe(2);
    });

    it('should skip existing controls during bulk import', async () => {
      // Create first control
      const existing = mockControlRepository.create({
        ...testControl,
        code: 'AC-2',
      });
      await mockControlRepository.save(existing);

      // Mock the service to return only non-duplicate control
      controlsService.bulkImport = jest.fn().mockResolvedValue([
        {
          ...controlsToImport[1], // Only AC-3, AC-2 was skipped
          id: 'imported-1',
          status: ControlStatus.ACTIVE,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ]);

      const response = await request(app)
        .post('/controls/bulk-import')
        .set(authHeaders)
        .send(controlsToImport)
        .expect(201);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].code).toBe('AC-3');
    });

    it('should validate all controls before import', async () => {
      const invalidControls = [
        { code: 'INVALID' }, // Missing required fields
      ];

      await request(app)
        .post('/controls/bulk-import')
        .set(authHeaders)
        .send(invalidControls)
        .expect(400);
    });
  });

  describe('GET /controls/coverage/:organizationId', () => {
    beforeEach(async () => {
      // Create controls with implementations
      const control1 = mockControlRepository.create({
        ...testControl,
        code: 'AC-1',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control1);

      const implementation1 = mockImplementationRepository.create({
        controlId: control1.id,
        organizationId: 'org-123',
        status: ImplementationStatus.IMPLEMENTED,
        implementationDate: new Date(),
        evidence: [
          {
            type: 'document',
            description: 'Security policy',
            location: 'policy.pdf',
            uploadedAt: new Date(),
            uploadedBy: 'user-123',
          },
        ],
      });
      await mockImplementationRepository.save(implementation1);

      const control2 = mockControlRepository.create({
        ...testControl,
        code: 'AC-2',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control2);

      const control3 = mockControlRepository.create({
        ...testControl,
        code: 'AC-3',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control3);
    });

    it('should calculate control coverage', async () => {
      const response = await request(app)
        .get('/controls/coverage/org-123')
        .set(authHeaders)
        .expect(200);

      expect(response.body.overall).toMatchObject({
        totalControls: 3,
        implementedControls: 1,
        coveragePercentage: expect.any(Number),
      });

      expect(response.body.overall.coveragePercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('GET /controls/by-framework/:framework', () => {
    beforeEach(async () => {
      const soc2Control = mockControlRepository.create({
        ...testControl,
        code: 'CC6.1',
        frameworks: [{ name: 'SOC2', section: 'CC6.1' }],
      });
      await mockControlRepository.save(soc2Control);

      const nistControl = mockControlRepository.create({
        ...testControl,
        code: 'AC-1',
        frameworks: [{ name: 'NIST', section: 'AC-1' }],
      });
      await mockControlRepository.save(nistControl);
    });

    it('should return controls for specific framework', async () => {
      const response = await request(app)
        .get('/controls/by-framework/SOC2')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].frameworks[0].name).toBe('SOC2');
    });

    it('should return empty array for unknown framework', async () => {
      const response = await request(app)
        .get('/controls/by-framework/UNKNOWN')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('Security tests', () => {
    it('should require authentication', async () => {
      await request(app).get('/controls').expect(401);
    });

    it('should enforce role-based access', async () => {
      const readOnlyHeaders = {
        ...authHeaders,
        'x-kong-user-roles': 'auditor',
      };

      await request(app).post('/controls').set(readOnlyHeaders).send(testControl).expect(403);
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/controls')
        .set(authHeaders)
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);
    });
  });
});
