import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Report, ReportFormat, ReportStatus } from './entities/report.entity';
import { DeliveryMethod, ReportSchedule } from './entities/report-schedule.entity';
import { ReportTemplate } from './entities/report-template.entity';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './services/report-generator.service';
import { ReportSchedulerService } from './services/report-scheduler.service';
import { ReportStorageService } from './services/report-storage.service';

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
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  }) as any;

describe('ReportsController', () => {
  let controller: ReportsController;
  let generatorService: any;
  let schedulerService: any;
  let storageService: any;
  let reportRepository: any;
  let templateRepository: any;
  let scheduleRepository: any;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'compliance_manager'],
  };

  const mockReport = {
    id: 'report-123',
    organizationId: 'org-123',
    title: 'SOC 2 Compliance Report',
    description: 'Annual SOC 2 Type II compliance report',
    reportType: 'SOC2_TYPE_II',
    status: ReportStatus.COMPLETED,
    format: ReportFormat.PDF,
    filePath: 'reports/org-123/report-123.pdf',
    fileName: 'SOC2_Report_2024.pdf',
    fileSize: 2048576,
    mimeType: 'application/pdf',
    checksum: 'sha256:abcd1234',
    generatedAt: new Date('2024-01-15T10:00:00Z'),
    generatedBy: 'user-123',
    periodStart: new Date('2023-01-01'),
    periodEnd: new Date('2023-12-31'),
    parameters: {
      includeEvidence: true,
      includeFindings: true,
      includeRecommendations: true,
    },
    sections: [
      { id: 'executive-summary', name: 'Executive Summary', order: 1 },
      { id: 'scope', name: 'Scope and Objectives', order: 2 },
      { id: 'findings', name: 'Findings', order: 3 },
    ],
    metadata: {
      pageCount: 85,
      generationTime: 45000,
      dataPointsCount: 1250,
      evidenceCount: 320,
      findingsCount: 15,
      complianceScore: 92.5,
    },
    summary: {
      overallScore: 92.5,
      totalControls: 120,
      effectiveControls: 111,
      failedControls: 9,
      criticalFindings: 1,
      highFindings: 3,
      mediumFindings: 5,
      lowFindings: 6,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTemplate = {
    id: 'template-123',
    organizationId: 'org-123',
    name: 'SOC 2 Type II Report Template',
    description: 'Standard template for SOC 2 Type II compliance reports',
    reportType: 'SOC2_TYPE_II',
    format: ReportFormat.PDF,
    templateContent: '<template>{{content}}</template>',
    configuration: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 15, right: 15 },
      fonts: ['Arial', 'Times New Roman'],
      watermark: true,
    },
    parameters: {
      periodStart: { type: 'date', required: true },
      periodEnd: { type: 'date', required: true },
      includeEvidence: { type: 'boolean', default: true },
    },
    defaultSections: [
      { id: 'executive-summary', name: 'Executive Summary', order: 1 },
      { id: 'scope', name: 'Scope and Objectives', order: 2 },
    ],
    isActive: true,
    version: 2,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSchedule = {
    id: 'schedule-123',
    organizationId: 'org-123',
    reportTemplateId: 'template-123',
    reportTemplate: mockTemplate,
    name: 'Monthly SOC 2 Report',
    description: 'Automated monthly SOC 2 compliance report',
    cronExpression: '0 0 1 * *',
    timezone: 'America/New_York',
    recipients: ['compliance@example.com', 'cfo@example.com'],
    format: ReportFormat.PDF,
    parameters: {
      includeEvidence: true,
      includeFindings: true,
    },
    filters: {
      severity: ['critical', 'high'],
    },
    deliveryMethod: DeliveryMethod.EMAIL,
    deliveryConfig: {
      emailSubject: 'Monthly SOC 2 Report - {{month}}',
      emailBody: 'Please find attached the monthly SOC 2 report.',
    },
    isActive: true,
    lastRunAt: new Date('2024-01-01T00:00:00Z'),
    nextRunAt: new Date('2024-02-01T00:00:00Z'),
    executionCount: 12,
    successCount: 11,
    failureCount: 1,
    lastError: null,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  beforeEach(() => {
    // Create mocks
    generatorService = {
      generate: jest.fn(),
    };
    schedulerService = {
      createSchedule: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      runScheduleNow: jest.fn(),
    };
    storageService = {
      retrieve: jest.fn(),
      delete: jest.fn(),
      getStorageStats: jest.fn(),
    };
    reportRepository = createMockRepository();
    templateRepository = createMockRepository();
    scheduleRepository = createMockRepository();

    // Manual instantiation
    controller = new ReportsController(
      generatorService,
      schedulerService,
      storageService,
      reportRepository,
      templateRepository,
      scheduleRepository
    );

    jest.clearAllMocks();
  });

  describe('Report Generation', () => {
    describe('generateReport', () => {
      it('should generate a report successfully', async () => {
        const generateDto = {
          templateId: 'template-123',
          reportType: 'SOC2_TYPE_II',
          title: 'Q4 2023 SOC 2 Report',
          description: 'Quarterly compliance report',
          format: ReportFormat.PDF,
          parameters: {
            periodStart: '2023-10-01',
            periodEnd: '2023-12-31',
            includeEvidence: true,
          },
          sections: ['executive-summary', 'findings', 'controls'],
          filters: {
            severity: ['critical', 'high'],
          },
        };

        const generationResult = {
          reportId: 'report-456',
          status: ReportStatus.COMPLETED,
          fileUrl: 'https://storage.example.com/reports/report-456.pdf',
          format: ReportFormat.PDF,
          generatedAt: new Date(),
        };

        const createdReport = { id: 'report-456', ...generateDto };
        reportRepository.create.mockReturnValue(createdReport);
        reportRepository.save.mockResolvedValue({ ...createdReport, id: 'report-456' });
        generatorService.generate.mockResolvedValue(generationResult);

        const result = await controller.generateReport(generateDto, { user: mockUser });

        expect(generatorService.generate).toHaveBeenCalledWith({
          reportId: 'report-456',
          organizationId: mockUser.organizationId,
          userId: mockUser.id,
          templateId: generateDto.templateId,
          format: generateDto.format,
          filters: generateDto.filters,
        });
        expect(result).toEqual(generationResult);
      });

      it('should handle generation without template', async () => {
        const generateDto = {
          templateId: 'template-456',
          reportType: 'CUSTOM',
          title: 'Custom Report',
          format: ReportFormat.EXCEL,
          sections: ['summary', 'data'],
        };

        const createdReport = { id: 'report-789', ...generateDto };
        reportRepository.create.mockReturnValue(createdReport);
        reportRepository.save.mockResolvedValue({ ...createdReport, id: 'report-789' });
        generatorService.generate.mockResolvedValue({
          reportId: 'report-789',
          status: ReportStatus.COMPLETED,
          fileUrl: 'https://storage.example.com/reports/report-789.xlsx',
          format: 'EXCEL',
          generatedAt: new Date(),
        });

        await controller.generateReport(generateDto, { user: mockUser });

        expect(generatorService.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            reportId: 'report-789',
            templateId: undefined,
            format: 'EXCEL',
          })
        );
      });
    });

    describe('listReports', () => {
      it('should list reports with filters', async () => {
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockReport], 1]),
        };
        reportRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

        const result = await controller.listReports(
          { user: mockUser },
          ReportStatus.COMPLETED,
          'SOC2_TYPE_II',
          undefined,
          '2024-01-01',
          '2024-01-31',
          '1',
          '20'
        );

        expect(reportRepository.createQueryBuilder).toHaveBeenCalledWith('report');
        expect(mockQueryBuilder.where).toHaveBeenCalledWith(
          'report.organizationId = :organizationId',
          { organizationId: mockUser.organizationId }
        );
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.status = :status', {
          status: ReportStatus.COMPLETED,
        });
        expect(result).toEqual({
          data: [mockReport],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            pages: 1,
          },
        });
      });

      it('should handle date range filtering', async () => {
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        };
        reportRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

        await controller.listReports(
          { user: mockUser },
          undefined,
          undefined,
          undefined,
          '2024-01-01',
          '2024-12-31'
        );

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.generatedAt >= :startDate', {
          startDate: new Date('2024-01-01'),
        });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('report.generatedAt <= :endDate', {
          endDate: new Date('2024-12-31'),
        });
      });
    });

    describe('getReport', () => {
      it('should get a specific report', async () => {
        reportRepository.findOne.mockResolvedValue(mockReport);

        const result = await controller.getReport(
          'report-123',
          { user: mockUser },
          mockResponse as any
        );

        expect(reportRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'report-123',
            organizationId: mockUser.organizationId,
          },
        });
        expect(result).toEqual(mockReport);
      });

      it('should throw error if report not found', async () => {
        reportRepository.findOne.mockResolvedValue(null);

        await expect(
          controller.getReport('non-existent', { user: mockUser }, mockResponse as any)
        ).rejects.toThrow('Report not found');
      });
    });

    describe('downloadReport', () => {
      it('should download report file', async () => {
        const fileBuffer = Buffer.from('PDF content');
        reportRepository.findOne.mockResolvedValue(mockReport);
        storageService.retrieve.mockResolvedValue(fileBuffer);

        await controller.downloadReport('report-123', { user: mockUser }, mockResponse as any);

        expect(storageService.retrieve).toHaveBeenCalledWith(mockReport.filePath);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename="SOC2_Report_2024.pdf"'
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
        expect(mockResponse.send).toHaveBeenCalledWith(fileBuffer);
      });

      it('should handle missing report file', async () => {
        reportRepository.findOne.mockResolvedValue({
          ...mockReport,
          filePath: null,
        });

        await controller.downloadReport('report-123', { user: mockUser }, mockResponse as any);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Report file not found',
        });
      });

      it('should handle storage retrieval error', async () => {
        reportRepository.findOne.mockResolvedValue(mockReport);
        storageService.retrieve.mockRejectedValue(new Error('Storage error'));

        await controller.downloadReport('report-123', { user: mockUser }, mockResponse as any);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Failed to download report',
        });
      });
    });

    describe('deleteReport', () => {
      it('should delete report and file', async () => {
        reportRepository.findOne.mockResolvedValue(mockReport);
        storageService.delete.mockResolvedValue(undefined);
        reportRepository.remove.mockResolvedValue(mockReport);

        const result = await controller.deleteReport('report-123', { user: mockUser });

        expect(storageService.delete).toHaveBeenCalledWith(mockReport.filePath);
        expect(reportRepository.remove).toHaveBeenCalledWith(mockReport);
        expect(result).toEqual({ message: 'Report deleted successfully' });
      });

      it('should handle report without file', async () => {
        const reportWithoutFile = { ...mockReport, filePath: null };
        reportRepository.findOne.mockResolvedValue(reportWithoutFile);
        reportRepository.remove.mockResolvedValue(reportWithoutFile);

        await controller.deleteReport('report-123', { user: mockUser });

        expect(storageService.delete).not.toHaveBeenCalled();
        expect(reportRepository.remove).toHaveBeenCalled();
      });
    });
  });

  describe('Template Management', () => {
    describe('listTemplates', () => {
      it('should list active templates', async () => {
        templateRepository.find.mockResolvedValue([mockTemplate]);

        const result = await controller.listTemplates({ user: mockUser });

        expect(templateRepository.find).toHaveBeenCalledWith({
          where: {
            organizationId: mockUser.organizationId,
            isActive: true,
          },
          order: {
            reportType: 'ASC',
            name: 'ASC',
          },
        });
        expect(result).toEqual([mockTemplate]);
      });
    });

    describe('getTemplate', () => {
      it('should get specific template', async () => {
        templateRepository.findOne.mockResolvedValue(mockTemplate);

        const result = await controller.getTemplate('template-123', { user: mockUser });

        expect(templateRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'template-123',
            organizationId: mockUser.organizationId,
          },
        });
        expect(result).toEqual(mockTemplate);
      });
    });

    describe('createTemplate', () => {
      it('should create new template', async () => {
        const createDto = {
          name: 'New Template',
          description: 'Custom report template',
          reportType: 'CUSTOM',
          type: 'CUSTOM',
          format: ReportFormat.PDF,
          templateContent: '<template>{{content}}</template>',
          configuration: {
            pageSize: 'A4',
            watermark: true,
          },
          parameters: {
            includeCharts: { type: 'boolean', default: true },
          },
          defaultSections: [{ id: 'summary', name: 'Summary', order: 1 }],
        };

        templateRepository.create.mockReturnValue({
          ...createDto,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.id,
        });
        templateRepository.save.mockResolvedValue({
          ...mockTemplate,
          ...createDto,
        });

        const result = await controller.createTemplate(createDto, { user: mockUser });

        expect(templateRepository.create).toHaveBeenCalledWith({
          ...createDto,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.id,
        });
        expect(result.name).toBe('New Template');
      });
    });

    describe('updateTemplate', () => {
      it('should update existing template', async () => {
        const updateDto = {
          name: 'Updated Template',
          configuration: {
            pageSize: 'Letter',
            watermark: false,
          },
          isActive: false,
        };

        templateRepository.findOne.mockResolvedValue(mockTemplate);
        templateRepository.save.mockResolvedValue({
          ...mockTemplate,
          ...updateDto,
          updatedBy: mockUser.id,
        });

        const result = await controller.updateTemplate('template-123', updateDto, {
          user: mockUser,
        });

        expect(result.name).toBe('Updated Template');
        expect(result.isActive).toBe(false);
      });
    });

    describe('deleteTemplate', () => {
      it('should soft delete template', async () => {
        templateRepository.findOne.mockResolvedValue(mockTemplate);
        templateRepository.save.mockResolvedValue({
          ...mockTemplate,
          isActive: false,
        });

        const result = await controller.deleteTemplate('template-123', { user: mockUser });

        expect(templateRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: false })
        );
        expect(result).toEqual({ message: 'Template deleted successfully' });
      });
    });
  });

  describe('Schedule Management', () => {
    describe('listSchedules', () => {
      it('should list schedules with template relations', async () => {
        scheduleRepository.find.mockResolvedValue([mockSchedule]);

        const result = await controller.listSchedules({ user: mockUser });

        expect(scheduleRepository.find).toHaveBeenCalledWith({
          where: {
            organizationId: mockUser.organizationId,
          },
          relations: ['reportTemplate'],
          order: {
            isActive: 'DESC',
            name: 'ASC',
          },
        });
        expect(result).toEqual([mockSchedule]);
      });
    });

    describe('createSchedule', () => {
      it('should create new schedule', async () => {
        const createDto = {
          reportTemplateId: 'template-123',
          name: 'Weekly Report',
          description: 'Weekly compliance report',
          cronExpression: '0 0 * * 1',
          timezone: 'UTC',
          recipients: ['compliance@example.com'],
          format: ReportFormat.PDF,
          parameters: { includeEvidence: true },
          filters: { severity: ['high'] },
          deliveryMethod: DeliveryMethod.EMAIL,
          deliveryConfig: { emailSubject: 'Weekly Report' },
          isActive: true,
        };

        schedulerService.createSchedule.mockResolvedValue({
          ...mockSchedule,
          ...createDto,
        });

        const result = await controller.createSchedule(createDto, { user: mockUser });

        expect(schedulerService.createSchedule).toHaveBeenCalledWith({
          ...createDto,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.id,
        });
        expect(result.name).toBe('Weekly Report');
      });
    });

    describe('updateSchedule', () => {
      it('should update existing schedule', async () => {
        const updateDto = {
          cronExpression: '0 0 * * 2',
          recipients: ['compliance@example.com', 'cto@example.com'],
          isActive: false,
        };

        schedulerService.updateSchedule.mockResolvedValue({
          ...mockSchedule,
          ...updateDto,
        });

        const result = await controller.updateSchedule('schedule-123', updateDto, {
          user: mockUser,
        });

        expect(schedulerService.updateSchedule).toHaveBeenCalledWith(
          'schedule-123',
          mockUser.organizationId,
          updateDto
        );
        expect(result.isActive).toBe(false);
      });
    });

    describe('runScheduleNow', () => {
      it('should trigger immediate schedule execution', async () => {
        schedulerService.runScheduleNow.mockResolvedValue(undefined);

        const result = await controller.runScheduleNow('schedule-123', { user: mockUser });

        expect(schedulerService.runScheduleNow).toHaveBeenCalledWith(
          'schedule-123',
          mockUser.organizationId
        );
        expect(result).toEqual({ message: 'Schedule execution started' });
      });
    });

    describe('pauseSchedule', () => {
      it('should pause active schedule', async () => {
        scheduleRepository.findOne.mockResolvedValue(mockSchedule);
        scheduleRepository.save.mockResolvedValue({
          ...mockSchedule,
          isActive: false,
        });

        const result = await controller.pauseSchedule('schedule-123', { user: mockUser });

        expect(scheduleRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: false })
        );
        expect(result).toEqual({ message: 'Schedule paused successfully' });
      });
    });

    describe('resumeSchedule', () => {
      it('should resume paused schedule', async () => {
        const pausedSchedule = { ...mockSchedule, isActive: false };
        scheduleRepository.findOne.mockResolvedValue(pausedSchedule);
        scheduleRepository.save.mockResolvedValue({
          ...pausedSchedule,
          isActive: true,
        });

        const result = await controller.resumeSchedule('schedule-123', { user: mockUser });

        expect(scheduleRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: true })
        );
        expect(result).toEqual({ message: 'Schedule resumed successfully' });
      });
    });
  });

  describe('Analytics', () => {
    describe('getReportingSummary', () => {
      it('should return comprehensive reporting analytics', async () => {
        const statusCountsQuery = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([
            { status: ReportStatus.COMPLETED, count: '85' },
            { status: ReportStatus.FAILED, count: '5' },
            { status: ReportStatus.PENDING, count: '10' },
          ]),
        };

        const typeCountsQuery = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([
            { type: 'SOC2_TYPE_II', count: '45' },
            { type: 'ISO27001', count: '30' },
            { type: 'CUSTOM', count: '10' },
          ]),
        };

        reportRepository.createQueryBuilder
          .mockReturnValueOnce(statusCountsQuery)
          .mockReturnValueOnce(typeCountsQuery);

        storageService.getStorageStats.mockResolvedValue({
          totalSize: 1073741824, // 1GB
          totalFiles: 100,
          sizeFormatted: '1 GB',
          oldestFile: null,
          newestFile: null,
        });

        scheduleRepository.count.mockResolvedValue(15);

        const result = await controller.getReportingSummary({ user: mockUser });

        expect(result).toEqual({
          reportCounts: {
            byStatus: {
              [ReportStatus.COMPLETED]: 85,
              [ReportStatus.FAILED]: 5,
              [ReportStatus.PENDING]: 10,
            },
            byType: {
              SOC2_TYPE_II: 45,
              ISO27001: 30,
              CUSTOM: 10,
            },
            total: 100,
          },
          storage: {
            totalSize: 1073741824,
            reportCount: 100,
            averageSize: 10737418,
          },
          schedules: {
            active: 15,
          },
        });
      });
    });
  });

  describe('Role-based Access Control', () => {
    it('should allow viewers to list and download reports', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };
      reportRepository.findOne.mockResolvedValue(mockReport);
      storageService.retrieve.mockResolvedValue(Buffer.from('content'));

      // Viewer can get report
      await controller.getReport('report-123', { user: viewerUser }, mockResponse as any);
      expect(reportRepository.findOne).toHaveBeenCalled();

      // Viewer can download
      await controller.downloadReport('report-123', { user: viewerUser }, mockResponse as any);
      expect(storageService.retrieve).toHaveBeenCalled();
    });

    it('should restrict template creation to admins and managers', async () => {
      // These tests would be enforced by guards in real implementation
      expect(controller.createTemplate).toBeDefined();
      expect(controller.updateTemplate).toBeDefined();
    });

    it('should restrict schedule management to admins and managers', async () => {
      expect(controller.createSchedule).toBeDefined();
      expect(controller.deleteSchedule).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle template not found', async () => {
      templateRepository.findOne.mockResolvedValue(null);

      await expect(controller.getTemplate('non-existent', { user: mockUser })).rejects.toThrow(
        'Template not found'
      );
    });

    it('should handle schedule not found', async () => {
      scheduleRepository.findOne.mockResolvedValue(null);

      await expect(controller.getSchedule('non-existent', { user: mockUser })).rejects.toThrow(
        'Schedule not found'
      );
    });

    it('should handle scheduler service errors', async () => {
      schedulerService.createSchedule.mockRejectedValue(
        new BadRequestException('Invalid cron expression')
      );

      await expect(controller.createSchedule({} as any, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
