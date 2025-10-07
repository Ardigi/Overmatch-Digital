import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from './audit-trail.service';
import type { CreateAuditEntryDto } from './dto/create-audit-entry.dto';
import type { SearchAuditEntriesDto } from './dto/search-audit-entries.dto';
import {
  AuditAction,
  type AuditEntry,
  AuditResource,
  AuditSeverity,
} from './entities/audit-entry.entity';
import { type AuditSession, SessionStatus } from './entities/audit-session.entity';

describe('AuditTrailController', () => {
  let controller: AuditTrailController;

  const mockAuditTrailService = {
    createEntry: jest.fn(),
    findEntries: jest.fn(),
    findEntryById: jest.fn(),
    verifyChecksum: jest.fn(),
    reviewEntry: jest.fn(),
    findSessionByToken: jest.fn(),
    terminateSession: jest.fn(),
    detectTampering: jest.fn(),
    generateAuditReport: jest.fn(),
  };

  const mockAuditEntry: Partial<AuditEntry> = {
    id: 'entry-123',
    organizationId: 'org-123',
    userId: 'user-123',
    userEmail: 'test@example.com',
    action: AuditAction.CREATE,
    resource: AuditResource.CONTROL,
    resourceId: 'resource-123',
    description: 'Test audit entry',
    severity: AuditSeverity.INFO,
    timestamp: new Date(),
    ipAddress: '127.0.0.1',
    success: true,
    isAnomaly: false,
    riskScore: 0,
    checksum: 'test-checksum',
    requiresReview: false,
  };

  const mockAuditSession: Partial<AuditSession> = {
    id: 'session-123',
    organizationId: 'org-123',
    userId: 'user-123',
    userEmail: 'test@example.com',
    sessionToken: 'token-123',
    status: SessionStatus.ACTIVE,
    startTime: new Date(),
    activityCount: 5,
    errorCount: 0,
    warningCount: 1,
    riskScore: 15,
    ipAddress: '127.0.0.1',
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      organizationId: 'org-123',
    },
    headers: {
      'x-session-id': 'token-123',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Manual instantiation to avoid TypeORM/Jest issues
    controller = new AuditTrailController(mockAuditTrailService as any);
  });

  describe('createEntry', () => {
    it('should create an audit entry', async () => {
      const createDto: CreateAuditEntryDto = {
        organizationId: 'org-123',
        userId: 'user-123',
        userEmail: 'test@example.com',
        action: AuditAction.CREATE,
        resource: AuditResource.CONTROL,
        resourceId: 'resource-123',
        description: 'Test audit entry',
        severity: AuditSeverity.INFO,
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        success: true,
      };

      mockAuditTrailService.createEntry.mockResolvedValue(mockAuditEntry);

      const result = await controller.createEntry(createDto);

      expect(mockAuditTrailService.createEntry).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockAuditEntry);
    });
  });

  describe('searchEntries', () => {
    it('should search audit entries', async () => {
      const searchDto: SearchAuditEntriesDto = {
        organizationId: 'org-123',
        page: 1,
        pageSize: 10,
      };

      const expectedResult = {
        data: [mockAuditEntry],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAuditTrailService.findEntries.mockResolvedValue(expectedResult);

      const result = await controller.searchEntries(searchDto);

      expect(mockAuditTrailService.findEntries).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(expectedResult);
    });

    it('should apply filters when searching', async () => {
      const searchDto: SearchAuditEntriesDto = {
        organizationId: 'org-123',
        userId: 'user-123',
        action: AuditAction.UPDATE,
        resource: AuditResource.POLICY,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        severity: AuditSeverity.HIGH,
        success: true,
        requiresReview: true,
        page: 1,
        pageSize: 20,
      };

      mockAuditTrailService.findEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.searchEntries(searchDto);

      expect(mockAuditTrailService.findEntries).toHaveBeenCalledWith(searchDto);
    });
  });

  describe('getEntry', () => {
    it('should get audit entry by ID', async () => {
      mockAuditTrailService.findEntryById.mockResolvedValue(mockAuditEntry);

      const result = await controller.getEntry('entry-123');

      expect(mockAuditTrailService.findEntryById).toHaveBeenCalledWith('entry-123');
      expect(result).toEqual(mockAuditEntry);
    });
  });

  describe('verifyChecksum', () => {
    it('should verify checksum and return valid status', async () => {
      mockAuditTrailService.verifyChecksum.mockResolvedValue(true);

      const result = await controller.verifyChecksum('entry-123');

      expect(mockAuditTrailService.verifyChecksum).toHaveBeenCalledWith('entry-123');
      expect(result).toEqual({ valid: true });
    });

    it('should return invalid status for tampered entry', async () => {
      mockAuditTrailService.verifyChecksum.mockResolvedValue(false);

      const result = await controller.verifyChecksum('entry-123');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('reviewEntry', () => {
    it('should review an audit entry', async () => {
      const reviewData = { notes: 'Reviewed and approved' };
      const reviewedEntry = {
        ...mockAuditEntry,
        reviewedAt: new Date(),
        reviewedBy: 'user-123',
        reviewNotes: 'Reviewed and approved',
        requiresReview: false,
      };

      mockAuditTrailService.reviewEntry.mockResolvedValue(reviewedEntry);

      const result = await controller.reviewEntry('entry-123', reviewData, mockRequest);

      expect(mockAuditTrailService.reviewEntry).toHaveBeenCalledWith(
        'entry-123',
        'user-123',
        'Reviewed and approved'
      );
      expect(result).toEqual(reviewedEntry);
    });

    it('should review entry without notes', async () => {
      mockAuditTrailService.reviewEntry.mockResolvedValue(mockAuditEntry);

      await controller.reviewEntry('entry-123', {}, mockRequest);

      expect(mockAuditTrailService.reviewEntry).toHaveBeenCalledWith(
        'entry-123',
        'user-123',
        undefined
      );
    });
  });

  describe('getCurrentSession', () => {
    it('should get current session by token', async () => {
      mockAuditTrailService.findSessionByToken.mockResolvedValue(mockAuditSession);

      const result = await controller.getCurrentSession(mockRequest);

      expect(mockAuditTrailService.findSessionByToken).toHaveBeenCalledWith('token-123');
      expect(result).toEqual(mockAuditSession);
    });

    it('should return null if no session token in headers', async () => {
      const requestWithoutSession = {
        ...mockRequest,
        headers: {},
      };

      const result = await controller.getCurrentSession(requestWithoutSession);

      expect(mockAuditTrailService.findSessionByToken).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('terminateSession', () => {
    it('should terminate session with reason', async () => {
      const terminatedSession = {
        ...mockAuditSession,
        status: SessionStatus.TERMINATED,
        endTime: new Date(),
        terminationReason: 'Security concern',
      };

      mockAuditTrailService.terminateSession.mockResolvedValue(terminatedSession);

      const result = await controller.terminateSession('token-123', {
        reason: 'Security concern',
      });

      expect(mockAuditTrailService.terminateSession).toHaveBeenCalledWith(
        'token-123',
        'Security concern'
      );
      expect(result).toEqual(terminatedSession);
    });

    it('should terminate session without reason', async () => {
      mockAuditTrailService.terminateSession.mockResolvedValue(mockAuditSession);

      await controller.terminateSession('token-123', {});

      expect(mockAuditTrailService.terminateSession).toHaveBeenCalledWith('token-123', undefined);
    });
  });

  describe('checkIntegrity', () => {
    it('should check for tampered entries', async () => {
      const tamperedResult = {
        tamperedEntries: [mockAuditEntry],
        totalChecked: 100,
      };

      mockAuditTrailService.detectTampering.mockResolvedValue(tamperedResult);

      const result = await controller.checkIntegrity('org-123');

      expect(mockAuditTrailService.detectTampering).toHaveBeenCalledWith('org-123');
      expect(result).toEqual(tamperedResult);
    });

    it('should return empty array when no tampering detected', async () => {
      const cleanResult = {
        tamperedEntries: [],
        totalChecked: 100,
      };

      mockAuditTrailService.detectTampering.mockResolvedValue(cleanResult);

      const result = await controller.checkIntegrity('org-123');

      expect(result.tamperedEntries).toHaveLength(0);
      expect(result.totalChecked).toBe(100);
    });
  });

  describe('generateReport', () => {
    it('should generate audit report for date range', async () => {
      const mockReport = {
        organizationId: 'org-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        summary: {
          totalEntries: 500,
          successfulEntries: 480,
          failedEntries: 20,
          anomalies: 5,
          highRiskEntries: 3,
          totalSessions: 50,
          activeSessions: 2,
          suspiciousSessions: 1,
        },
        actionBreakdown: {
          [AuditAction.CREATE]: 200,
          [AuditAction.UPDATE]: 150,
          [AuditAction.DELETE]: 50,
          [AuditAction.READ]: 100,
        },
        resourceBreakdown: {
          [AuditResource.CONTROL]: 250,
          [AuditResource.POLICY]: 150,
          [AuditResource.USER]: 100,
        },
        topUsers: [
          { email: 'user1@example.com', count: 100 },
          { email: 'user2@example.com', count: 80 },
        ],
        recentAnomalies: [],
        requiresReview: [],
      };

      mockAuditTrailService.generateAuditReport.mockResolvedValue(mockReport);

      const result = await controller.generateReport('org-123', '2024-01-01', '2024-01-31');

      expect(mockAuditTrailService.generateAuditReport).toHaveBeenCalledWith(
        'org-123',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      expect(result).toEqual(mockReport);
    });
  });

  describe('getMyActivity', () => {
    it('should get current user audit activity', async () => {
      const searchDto: SearchAuditEntriesDto = {
        organizationId: 'org-123',
        page: 1,
        pageSize: 10,
      };

      const expectedResult = {
        data: [mockAuditEntry],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAuditTrailService.findEntries.mockResolvedValue(expectedResult);

      const result = await controller.getMyActivity(mockRequest, searchDto);

      expect(mockAuditTrailService.findEntries).toHaveBeenCalledWith({
        ...searchDto,
        userId: 'user-123',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should override userId in search params', async () => {
      const searchDto: SearchAuditEntriesDto = {
        organizationId: 'org-123',
        userId: 'different-user', // This should be overridden
        page: 1,
        pageSize: 10,
      };

      mockAuditTrailService.findEntries.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await controller.getMyActivity(mockRequest, searchDto);

      expect(mockAuditTrailService.findEntries).toHaveBeenCalledWith({
        ...searchDto,
        userId: 'user-123', // Should use current user's ID
      });
    });
  });
});
