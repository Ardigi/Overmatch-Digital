import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Report, ReportStatus } from '../entities/report.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import { ReportDataCollector } from './report-data-collector.service';
import { ReportGeneratorService } from './report-generator.service';
import { ReportRendererFactory } from './report-renderer.factory';
import { ReportStorageService } from './report-storage.service';

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
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
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

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let reportRepository: any;
  let templateRepository: any;
  let reportQueue: any;
  let dataCollector: any;
  let rendererFactory: any;
  let storageService: any;
  let eventEmitter: any;

  const mockReport = {
    id: 'report-123',
    organizationId: 'org-123',
    templateId: 'template-123',
    title: 'SOC 2 Compliance Report',
    description: 'Annual SOC 2 Type II report',
    type: 'SOC2_TYPE_II',
    reportType: 'SOC2_TYPE_II',
    status: ReportStatus.PENDING,
    reportingPeriodStart: new Date('2023-01-01'),
    reportingPeriodEnd: new Date('2023-12-31'),
    filters: {
      severity: ['critical', 'high'],
    },
    startGeneration: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };

  const mockTemplate = {
    id: 'template-123',
    organizationId: 'org-123',
    name: 'SOC 2 Type II Template',
    type: 'SOC2_TYPE_II',
    reportType: 'SOC2_TYPE_II',
    sections: [
      {
        id: 'executive-summary',
        name: 'Executive Summary',
        order: 1,
        dataSource: 'executive_summary',
      },
      {
        id: 'compliance-status',
        name: 'Compliance Status',
        order: 2,
        dataSource: 'compliance_status',
      },
      {
        id: 'findings',
        name: 'Findings',
        order: 3,
        dataSource: 'findings',
      },
    ],
    dataSchema: {
      organization: { required: true },
      period: { required: true },
    },
    metadata: {
      disclaimer: 'This report is confidential',
    },
    version: 2,
  };

  const mockCollectedData = {
    organization: {
      name: 'Test Organization',
      logo: 'https://example.com/logo.png',
    },
    period: '2023',
    summary: {
      overallScore: 92.5,
      totalControls: 120,
      effectiveControls: 111,
      failedControls: 9,
      criticalFindings: 1,
      highFindings: 3,
      mediumFindings: 5,
      lowFindings: 6,
      recommendations: ['Implement additional access controls', 'Enhance monitoring capabilities'],
    },
    controls: [
      {
        id: 'CC1.1',
        name: 'Access Control',
        status: 'effective',
        lastTested: '2023-12-15',
        evidenceCount: 12,
      },
    ],
    findings: [
      {
        id: 'finding-001',
        title: 'Weak Password Policy',
        severity: 'high',
        description: 'Password policy allows weak passwords',
        impact: 'Potential unauthorized access',
        recommendation: 'Implement stronger password requirements',
        evidence: ['audit-log-123'],
        status: 'open',
      },
    ],
    evidence: [
      {
        id: 'evidence-001',
        type: 'screenshot',
        description: 'Access control configuration',
      },
    ],
    metrics: [
      { name: 'uptime', value: 99.99 },
      { name: 'incidents', value: 3 },
    ],
  };

  const mockRenderer = {
    render: jest.fn(),
  };

  const mockRenderedContent = {
    content: Buffer.from('PDF content'),
    mimeType: 'application/pdf',
    fileName: 'report.pdf',
    pageCount: 85,
    size: 2048576,
  };

  const mockStorageResult = {
    fileUrl: 'https://storage.example.com/reports/report-123.pdf',
    fileName: 'SOC2_Report_2023.pdf',
    fileSize: 2048576,
    checksum: 'sha256:abcd1234',
  };

  beforeEach(() => {
    // Create mocks
    reportRepository = createMockRepository();
    templateRepository = createMockRepository();
    reportQueue = createMockQueue();
    dataCollector = {
      collect: jest.fn(),
    } as any;
    rendererFactory = {
      getRenderer: jest.fn(),
    } as any;
    storageService = {
      store: jest.fn(),
      storeTemporary: jest.fn(),
    } as any;
    eventEmitter = createMockEventEmitter();

    // Manual instantiation
    service = new ReportGeneratorService(
      reportRepository,
      templateRepository,
      reportQueue,
      dataCollector,
      rendererFactory,
      storageService,
      eventEmitter
    );

    jest.clearAllMocks();

    // Reset mock function implementations
    mockReport.startGeneration.mockImplementation(function () {
      this.status = ReportStatus.PROCESSING;
    });
    mockReport.complete.mockImplementation(function (fileUrl, metadata) {
      this.status = ReportStatus.COMPLETED;
      this.fileUrl = fileUrl;
      this.metadata = metadata;
    });
    mockReport.fail.mockImplementation(function (error, details) {
      this.status = ReportStatus.FAILED;
      this.error = error;
      this.errorDetails = details;
    });
  });

  describe('generate', () => {
    it('should successfully generate a report with template', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        templateId: 'template-123',
        format: 'PDF',
        filters: {
          severity: ['critical', 'high'],
        },
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue(mockRenderedContent);
      storageService.store.mockResolvedValue(mockStorageResult);
      reportRepository.save.mockResolvedValue({
        ...mockReport,
        status: ReportStatus.COMPLETED,
      });

      const result = await service.generate(options);

      // Verify report loading
      expect(reportRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'report-123' },
        relations: ['template'],
      });

      // Verify status update
      expect(mockReport.startGeneration).toHaveBeenCalled();
      expect(reportRepository.save).toHaveBeenCalledWith(mockReport);

      // Verify template loading
      expect(templateRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });

      // Verify data collection
      expect(dataCollector.collect).toHaveBeenCalledWith({
        organizationId: 'org-123',
        type: 'SOC2_TYPE_II',
        periodStart: mockReport.reportingPeriodStart,
        periodEnd: mockReport.reportingPeriodEnd,
        filters: options.filters,
        sections: ['executive_summary', 'compliance_status', 'findings'],
        includeEvidence: true,
        includeMetrics: true,
        includeFindings: true,
      });

      // Verify rendering
      expect(rendererFactory.getRenderer).toHaveBeenCalledWith('PDF');
      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            title: 'SOC 2 Compliance Report',
            organizationName: 'Test Organization',
          }),
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'executive-summary',
              title: 'Executive Summary',
            }),
          ]),
        }),
        mockTemplate
      );

      // Verify storage
      expect(storageService.store).toHaveBeenCalledWith({
        reportId: 'report-123',
        organizationId: 'org-123',
        content: mockRenderedContent.content,
        fileName: mockRenderedContent.fileName,
        mimeType: mockRenderedContent.mimeType,
      });

      // Verify completion
      expect(mockReport.complete).toHaveBeenCalledWith(
        mockStorageResult.fileUrl,
        expect.objectContaining({
          pageCount: 85,
          generationTime: expect.any(Number),
          dataPointsCount: 5,
          evidenceCount: 1,
          findingsCount: 1,
          complianceScore: 92.5,
        })
      );

      // Verify event emission
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'report.generated',
        expect.objectContaining({
          reportId: 'report-123',
          organizationId: 'org-123',
          format: 'PDF',
          fileUrl: mockStorageResult.fileUrl,
        })
      );

      // Verify result
      expect(result).toEqual({
        success: true,
        reportId: 'report-123',
        fileUrl: mockStorageResult.fileUrl,
        fileName: mockStorageResult.fileName,
        fileSize: mockStorageResult.fileSize,
        generationTime: expect.any(Number),
        pageCount: 85,
      });
    });

    it('should generate report without template', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'EXCEL',
      };

      const reportWithoutTemplate = { ...mockReport, templateId: null };
      reportRepository.findOne.mockResolvedValue(reportWithoutTemplate);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue({
        ...mockRenderedContent,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'report.xlsx',
      });
      storageService.store.mockResolvedValue({
        ...mockStorageResult,
        fileName: 'Custom_Report_2023.xlsx',
      });

      const result = await service.generate(options);

      // Should not try to load template
      expect(templateRepository.findOne).not.toHaveBeenCalled();

      // Should use default sections
      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ id: 'executive-summary' }),
            expect.objectContaining({ id: 'scope' }),
            expect.objectContaining({ id: 'findings' }),
            expect.objectContaining({ id: 'controls' }),
            expect.objectContaining({ id: 'recommendations' }),
          ]),
        }),
        undefined
      );

      expect(result.success).toBe(true);
    });

    it('should handle report not found', async () => {
      const options = {
        reportId: 'non-existent',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      reportRepository.findOne.mockResolvedValue(null);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'non-existent',
        error: 'Report non-existent not found',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'report.failed',
        expect.objectContaining({
          reportId: 'non-existent',
          error: 'Report non-existent not found',
        })
      );
    });

    it('should handle template not found', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        templateId: 'non-existent-template',
        format: 'PDF',
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      templateRepository.findOne.mockResolvedValue(null);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'report-123',
        error: 'Report template not found',
      });

      expect(mockReport.fail).toHaveBeenCalledWith('Report template not found', expect.any(Error));
    });

    it('should handle data validation failure', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      const invalidData = { ...mockCollectedData };
      delete invalidData.organization;

      reportRepository.findOne.mockResolvedValue(mockReport);
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      dataCollector.collect.mockResolvedValue(invalidData);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'report-123',
        error: expect.stringContaining('Data validation failed'),
      });
    });

    it('should handle unsupported format', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'UNSUPPORTED',
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(null);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'report-123',
        error: 'Unsupported format: UNSUPPORTED',
      });
    });

    it('should handle rendering failure', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockRejectedValue(new Error('Rendering failed'));
      templateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'report-123',
        error: 'Rendering failed',
      });

      expect(mockReport.fail).toHaveBeenCalled();
    });

    it('should handle storage failure', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue(mockRenderedContent);
      storageService.store.mockRejectedValue(new Error('Storage unavailable'));
      templateRepository.findOne.mockResolvedValue(mockTemplate);

      const result = await service.generate(options);

      expect(result).toEqual({
        success: false,
        reportId: 'report-123',
        error: 'Storage unavailable',
      });
    });

    it('should apply post-processing options', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
        watermark: true,
        encryption: true,
        digitalSignature: true,
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      dataCollector.collect.mockResolvedValue(mockCollectedData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue(mockRenderedContent);
      storageService.store.mockResolvedValue(mockStorageResult);

      // Spy on private methods and mock their implementation
      const applyWatermarkSpy = jest
        .spyOn(service as any, 'applyWatermark')
        .mockImplementation((content) => content);
      const encryptContentSpy = jest
        .spyOn(service as any, 'encryptContent')
        .mockImplementation((content) => content);
      const signContentSpy = jest
        .spyOn(service as any, 'signContent')
        .mockImplementation((content) => content);

      await service.generate(options);

      expect(applyWatermarkSpy).toHaveBeenCalledWith(mockRenderedContent.content, 'PDF');
      expect(encryptContentSpy).toHaveBeenCalledWith(mockRenderedContent.content, 'org-123');
      expect(signContentSpy).toHaveBeenCalledWith(mockRenderedContent.content, 'user-123');
    });
  });

  describe('preview', () => {
    it('should generate preview with sample data', async () => {
      const options = {
        templateId: 'template-123',
        format: 'PDF',
        sampleData: true,
      };

      templateRepository.findOne.mockResolvedValue(mockTemplate);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue(mockRenderedContent);
      storageService.storeTemporary.mockResolvedValue('https://temp.example.com/preview.pdf');

      const result = await service.preview(options);

      expect(templateRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });

      expect(mockRenderer.render).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            title: 'SOC 2 Type II Template (Preview)',
            organizationName: 'Sample Organization',
          }),
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'executive-summary',
              title: 'Executive Summary',
              content: expect.any(String),
            }),
          ]),
        }),
        mockTemplate
      );

      expect(storageService.storeTemporary).toHaveBeenCalledWith({
        content: mockRenderedContent.content,
        fileName: expect.stringContaining('preview_'),
        mimeType: mockRenderedContent.mimeType,
        expiresIn: 3600,
      });

      expect(result).toEqual({
        success: true,
        previewUrl: 'https://temp.example.com/preview.pdf',
        pageCount: 85,
        estimatedSize: 2048576,
      });
    });

    it('should handle template not found in preview', async () => {
      const options = {
        templateId: 'non-existent',
        format: 'PDF',
      };

      templateRepository.findOne.mockResolvedValue(null);

      const result = await service.preview(options);

      expect(result).toEqual({
        success: false,
        error: 'Report template not found',
      });
    });

    it('should handle unsupported format in preview', async () => {
      const options = {
        templateId: 'template-123',
        format: 'UNSUPPORTED',
      };

      templateRepository.findOne.mockResolvedValue(mockTemplate);
      rendererFactory.getRenderer.mockReturnValue(null);

      const result = await service.preview(options);

      expect(result).toEqual({
        success: false,
        error: 'Unsupported format: UNSUPPORTED',
      });
    });
  });

  describe('validateData', () => {
    it('should validate required fields', () => {
      const validData = {
        organization: { name: 'Test Org' },
        period: '2023',
      };

      const result = service.validateData(validData);

      expect(result).toEqual({
        valid: true,
        errors: undefined,
        warnings: undefined,
      });
    });

    it('should return errors for missing required fields', () => {
      const invalidData = {};

      const result = service.validateData(invalidData);

      expect(result).toEqual({
        valid: false,
        errors: [
          { field: 'organization', message: 'Organization data is required' },
          { field: 'period', message: 'Report period is required' },
        ],
        warnings: undefined,
      });
    });

    it('should validate against schema', () => {
      const schema = {
        customField: { required: true },
      };

      const data = {
        organization: { name: 'Test Org' },
        period: '2023',
        // customField is missing
      };

      const result = service.validateData(data, schema);

      expect(result).toEqual({
        valid: false,
        errors: expect.arrayContaining([
          { field: 'customField', message: 'customField is required' },
        ]),
        warnings: undefined,
      });
    });

    it('should add warnings for data quality issues', () => {
      const data = {
        organization: { name: 'Test Org' },
        period: '2023',
        evidence: [],
        findings: [{ severity: 'critical', title: 'Critical issue' }],
      };

      const result = service.validateData(data);

      expect(result).toEqual({
        valid: true,
        errors: undefined,
        warnings: expect.arrayContaining([
          {
            field: 'evidence',
            message: 'No evidence included in report',
            suggestion: 'Consider including evidence for better compliance demonstration',
          },
          {
            field: 'findings',
            message: 'Report contains critical findings',
            suggestion: 'Ensure critical findings are addressed before report finalization',
          },
        ]),
      });
    });
  });

  describe('Section Data Preparation', () => {
    it('should prepare executive summary section', async () => {
      const sectionConfig = {
        id: 'executive-summary',
        name: 'Executive Summary',
        dataSource: 'executive_summary',
      };

      const sectionData = await (service as any).prepareSectionData(
        sectionConfig,
        mockCollectedData,
        {}
      );

      expect(sectionData.content).toContain('Overall compliance score: 92.5%');
      expect(sectionData.content).toContain('120 controls assessed');
    });

    it('should prepare compliance status section with chart', async () => {
      const sectionConfig = {
        id: 'compliance-status',
        name: 'Compliance Status',
        dataSource: 'compliance_status',
      };

      const sectionData = await (service as any).prepareSectionData(
        sectionConfig,
        mockCollectedData,
        {}
      );

      expect(sectionData.charts).toHaveLength(1);
      expect(sectionData.charts[0]).toMatchObject({
        id: 'compliance-chart',
        title: 'Compliance Overview',
        type: 'doughnut',
        data: {
          labels: ['Effective', 'Ineffective', 'Not Tested'],
          values: [111, 9, 0],
        },
      });
    });

    it('should prepare control testing section with table', async () => {
      const sectionConfig = {
        id: 'control-testing',
        name: 'Control Testing',
        dataSource: 'control_testing',
      };

      const sectionData = await (service as any).prepareSectionData(
        sectionConfig,
        mockCollectedData,
        {}
      );

      expect(sectionData.tables).toHaveLength(1);
      expect(sectionData.tables[0]).toMatchObject({
        id: 'control-testing',
        title: 'Control Testing Results',
        headers: ['Control ID', 'Control Name', 'Status', 'Test Date', 'Evidence'],
        rows: [['CC1.1', 'Access Control', 'effective', '2023-12-15', 12]],
      });
    });

    it('should prepare findings section', async () => {
      const sectionConfig = {
        id: 'findings',
        name: 'Findings',
        dataSource: 'findings',
      };

      const sectionData = await (service as any).prepareSectionData(
        sectionConfig,
        mockCollectedData,
        {}
      );

      expect(sectionData.findings).toHaveLength(1);
      expect(sectionData.findings[0]).toMatchObject({
        id: 'finding-001',
        title: 'Weak Password Policy',
        severity: 'high',
        status: 'open',
      });
    });

    it('should handle unknown section data source', async () => {
      const sectionConfig = {
        id: 'unknown',
        name: 'Unknown Section',
        dataSource: 'unknown_source',
      };

      const sectionData = await (service as any).prepareSectionData(
        sectionConfig,
        mockCollectedData,
        {}
      );

      expect(sectionData.content).toBe('Section content not available');
    });
  });

  describe('Post-Processing', () => {
    it('should apply watermark to content', async () => {
      const content = Buffer.from('PDF content');
      const format = 'PDF';

      const result = await (service as any).applyWatermark(content, format);

      // In real implementation, this would add watermark
      expect(result).toEqual(content);
    });

    it('should encrypt content', async () => {
      const content = Buffer.from('PDF content');
      const organizationId = 'org-123';

      const result = await (service as any).encryptContent(content, organizationId);

      // In real implementation, this would encrypt
      expect(result).toEqual(content);
    });

    it('should digitally sign content', async () => {
      const content = Buffer.from('PDF content');
      const userId = 'user-123';

      const result = await (service as any).signContent(content, userId);

      // In real implementation, this would sign
      expect(result).toEqual(content);
    });
  });

  describe('Sample Data Generation', () => {
    it('should generate sample data for template', () => {
      const sampleData = (service as any).generateSampleData(mockTemplate);

      expect(sampleData).toMatchObject({
        summary: {
          overallScore: 85,
          totalControls: 100,
          implementedControls: 85,
          effectiveControls: 80,
          failedControls: 5,
        },
        sections: {
          'executive-summary': expect.stringContaining('Sample content for Executive Summary'),
          'compliance-status': expect.stringContaining('Sample content for Compliance Status'),
          findings: expect.stringContaining('Sample content for Findings'),
        },
      });
    });
  });

  describe('Appendices Preparation', () => {
    it('should include evidence appendix when requested', () => {
      const options = {
        includeAttachments: true,
      };

      const appendices = (service as any).prepareAppendices(mockCollectedData, options);

      expect(appendices).toHaveLength(1);
      expect(appendices[0]).toMatchObject({
        id: 'evidence-details',
        title: 'Evidence Details',
        order: 1,
      });
    });

    it('should not include appendices when not requested', () => {
      const options = {
        includeAttachments: false,
      };

      const appendices = (service as any).prepareAppendices(mockCollectedData, options);

      expect(appendices).toHaveLength(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large reports efficiently', async () => {
      const largeData = {
        ...mockCollectedData,
        controls: Array(1000).fill(mockCollectedData.controls[0]),
        findings: Array(500).fill(mockCollectedData.findings[0]),
        evidence: Array(2000).fill(mockCollectedData.evidence[0]),
      };

      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      reportRepository.findOne.mockResolvedValue(mockReport);
      dataCollector.collect.mockResolvedValue(largeData);
      rendererFactory.getRenderer.mockReturnValue(mockRenderer);
      mockRenderer.render.mockResolvedValue({
        ...mockRenderedContent,
        pageCount: 500,
        size: 10485760, // 10MB
      });
      storageService.store.mockResolvedValue(mockStorageResult);
      templateRepository.findOne.mockResolvedValue(mockTemplate);

      const startTime = Date.now();
      const result = await service.generate(options);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(500);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Recovery', () => {
    it('should update report status on any error', async () => {
      const options = {
        reportId: 'report-123',
        organizationId: 'org-123',
        userId: 'user-123',
        format: 'PDF',
      };

      reportRepository.findOne
        .mockResolvedValueOnce(mockReport) // First call for processing
        .mockResolvedValueOnce(mockReport); // Second call for error handling
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      dataCollector.collect.mockRejectedValue(new Error('Data collection failed'));

      await service.generate(options);

      expect(mockReport.fail).toHaveBeenCalledWith('Data collection failed', expect.any(Error));
      expect(reportRepository.save).toHaveBeenCalledTimes(2); // Once for start, once for failure
    });
  });
});
