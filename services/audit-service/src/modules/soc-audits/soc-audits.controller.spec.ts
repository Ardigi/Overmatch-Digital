import type { CreateSOCAuditDto } from './dto/create-soc-audit.dto';
import type { UpdateSOCAuditDto } from './dto/update-soc-audit.dto';
import { AuditPhase, AuditStatus, AuditType, type SOCAudit } from './entities/soc-audit.entity';
import { SOCAuditsController } from './soc-audits.controller';
import { SOCAuditsService } from './soc-audits.service';

describe('SOCAuditsController', () => {
  let controller: SOCAuditsController;

  const mockAuditsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    updatePhase: jest.fn(),
    archive: jest.fn(),
    getUpcomingAudits: jest.fn(),
    getAuditsByClient: jest.fn(),
    getAuditMetrics: jest.fn(),
  };

  const mockAudit: Partial<SOCAudit> = {
    id: 'audit-123',
    organizationId: 'org-123',
    clientId: 'client-123',
    auditNumber: 'SOC2-2024-001',
    auditType: AuditType.SOC2_TYPE2,
    status: AuditStatus.PLANNING,
    currentPhase: AuditPhase.KICKOFF,
    auditPeriodStart: new Date('2024-01-01'),
    auditPeriodEnd: new Date('2024-12-31'),
    plannedCompletionDate: new Date('2025-03-31'),
    completionPercentage: 0,
    leadAuditorId: 'auditor-123',
    cpaFirmId: 'cpa-123',
    scopeDescription: 'Annual SOC 2 Type II audit',
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      organizationId: 'org-123',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Manual instantiation to avoid TypeORM/Jest issues
    controller = new SOCAuditsController(mockAuditsService as any);
  });

  describe('create', () => {
    it('should create a new SOC audit', async () => {
      const createDto: CreateSOCAuditDto = {
        organizationId: 'org-123',
        clientId: 'client-123',
        auditNumber: 'SOC2-2024-001',
        auditType: AuditType.SOC2_TYPE2,
        auditPeriodStart: new Date('2024-01-01'),
        auditPeriodEnd: new Date('2024-12-31'),
        plannedCompletionDate: new Date('2025-03-31'),
        trustServiceCriteria: ['SECURITY', 'AVAILABILITY'],
        leadAuditorId: 'auditor-123',
        engagementPartnerId: 'partner-123',
        auditTeamIds: ['team-member-1', 'team-member-2'],
        cpaFirmId: 'cpa-123',
        cpaFirmName: 'Test CPA Firm LLC',
        auditObjectives: 'Test audit objectives',
        scopeDescription: 'Annual SOC 2 Type II audit',
        inScopeServices: ['Web Application', 'API Services'],
        inScopeLocations: ['Primary Data Center', 'Corporate Office'],
      };

      mockAuditsService.create.mockResolvedValue(mockAudit);

      const result = await controller.create(createDto, mockRequest);

      expect(mockAuditsService.create).toHaveBeenCalledWith(createDto, 'user-123');
      expect(result).toEqual(mockAudit);
    });
  });

  describe('findAll', () => {
    it('should return paginated audits with default pagination', async () => {
      const query = {};
      const expectedResult = {
        data: [mockAudit],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockAuditsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(mockAuditsService.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        startDate: undefined,
        endDate: undefined,
      });
      expect(result).toEqual(expectedResult);
    });

    it('should apply all query filters', async () => {
      const query = {
        clientId: 'client-123',
        organizationId: 'org-123',
        status: AuditStatus.IN_FIELDWORK,
        auditType: AuditType.SOC2_TYPE2,
        leadAuditorId: 'auditor-123',
        cpaFirmId: 'cpa-123',
        search: 'SOC2',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: '2',
        limit: '50',
      };

      mockAuditsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 2, limit: 50, totalPages: 0 },
      });

      await controller.findAll(query);

      expect(mockAuditsService.findAll).toHaveBeenCalledWith({
        clientId: 'client-123',
        organizationId: 'org-123',
        status: AuditStatus.IN_FIELDWORK,
        auditType: AuditType.SOC2_TYPE2,
        leadAuditorId: 'auditor-123',
        cpaFirmId: 'cpa-123',
        search: 'SOC2',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        page: 2,
        limit: 50,
      });
    });
  });

  describe('getUpcoming', () => {
    it('should get upcoming audits with default 30 days', async () => {
      const upcomingAudits = [mockAudit];
      mockAuditsService.getUpcomingAudits.mockResolvedValue(upcomingAudits);

      const result = await controller.getUpcoming('org-123', undefined);

      expect(mockAuditsService.getUpcomingAudits).toHaveBeenCalledWith('org-123', 30);
      expect(result).toEqual(upcomingAudits);
    });

    it('should get upcoming audits with custom days', async () => {
      mockAuditsService.getUpcomingAudits.mockResolvedValue([]);

      await controller.getUpcoming('org-123', '60');

      expect(mockAuditsService.getUpcomingAudits).toHaveBeenCalledWith('org-123', 60);
    });
  });

  describe('getByClient', () => {
    it('should get all audits for a client', async () => {
      const clientAudits = [mockAudit, { ...mockAudit, id: 'audit-124' }];
      mockAuditsService.getAuditsByClient.mockResolvedValue(clientAudits);

      const result = await controller.getByClient('client-123');

      expect(mockAuditsService.getAuditsByClient).toHaveBeenCalledWith('client-123');
      expect(result).toEqual(clientAudits);
    });
  });

  describe('findOne', () => {
    it('should get audit by ID', async () => {
      mockAuditsService.findOne.mockResolvedValue(mockAudit);

      const result = await controller.findOne('audit-123');

      expect(mockAuditsService.findOne).toHaveBeenCalledWith('audit-123');
      expect(result).toEqual(mockAudit);
    });
  });

  describe('getMetrics', () => {
    it('should get audit metrics', async () => {
      const mockMetrics = {
        controlsTested: 50,
        controlsPassed: 45,
        controlsFailed: 5,
        completionPercentage: 75,
        daysRemaining: 45,
        overdueItems: 2,
        teamUtilization: 85,
      };

      mockAuditsService.getAuditMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics('audit-123');

      expect(mockAuditsService.getAuditMetrics).toHaveBeenCalledWith('audit-123');
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('update', () => {
    it('should update an audit', async () => {
      const updateDto: UpdateSOCAuditDto = {
        scopeDescription: 'Updated scope description',
        completionPercentage: 25,
      };

      const updatedAudit = {
        ...mockAudit,
        ...updateDto,
      };

      mockAuditsService.update.mockResolvedValue(updatedAudit);

      const result = await controller.update('audit-123', updateDto, mockRequest);

      expect(mockAuditsService.update).toHaveBeenCalledWith('audit-123', updateDto, 'user-123');
      expect(result).toEqual(updatedAudit);
    });
  });

  describe('updateStatus', () => {
    it('should update audit status', async () => {
      const newStatus = AuditStatus.IN_FIELDWORK;
      const updatedAudit = {
        ...mockAudit,
        status: newStatus,
      };

      mockAuditsService.updateStatus.mockResolvedValue(updatedAudit);

      const result = await controller.updateStatus('audit-123', newStatus, mockRequest);

      expect(mockAuditsService.updateStatus).toHaveBeenCalledWith(
        'audit-123',
        newStatus,
        'user-123'
      );
      expect(result).toEqual(updatedAudit);
    });
  });

  describe('updatePhase', () => {
    it('should update audit phase', async () => {
      const newPhase = AuditPhase.CONTROL_TESTING;
      const updatedAudit = {
        ...mockAudit,
        currentPhase: newPhase,
      };

      mockAuditsService.updatePhase.mockResolvedValue(updatedAudit);

      const result = await controller.updatePhase('audit-123', newPhase, mockRequest);

      expect(mockAuditsService.updatePhase).toHaveBeenCalledWith('audit-123', newPhase, 'user-123');
      expect(result).toEqual(updatedAudit);
    });
  });

  describe('archive', () => {
    it('should archive completed audit', async () => {
      const archivedAudit = {
        ...mockAudit,
        status: AuditStatus.CANCELLED,
        archivedAt: new Date(),
        archivedBy: 'user-123',
      };

      mockAuditsService.archive.mockResolvedValue(archivedAudit);

      const result = await controller.archive('audit-123', mockRequest);

      expect(mockAuditsService.archive).toHaveBeenCalledWith('audit-123', 'user-123');
      expect(result).toEqual(archivedAudit);
    });
  });
});
