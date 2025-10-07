import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KafkaService } from '../../../kafka/kafka.service';
import { FrameworksService } from '../../frameworks/frameworks.service';
import { ControlsService } from '../controls.service';
import {
  type Control,
  ControlCategory,
  ControlFrequency,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';
import { ControlAssessment } from '../entities/control-assessment.entity';
import { ControlException } from '../entities/control-exception.entity';
import {
  ControlImplementation,
  ImplementationStatus,
} from '../../implementation/entities/control-implementation.entity';
import { ControlMapping } from '../entities/control-mapping.entity';
import { ControlTestResult } from '../entities/control-test-result.entity';
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
  createMockControl,
} from './test-helpers/mock-factories';

describe('Controls Metrics and Coverage Tests', () => {
  let service: ControlsService;
  let controlRepository: MockRepository<Control>;
  let testResultRepository: MockRepository<ControlTestResult>;
  let implementationRepository: MockRepository<ControlImplementation>;
  let exceptionRepository: MockRepository<ControlException>;
  let assessmentRepository: MockRepository<ControlAssessment>;
  let mappingRepository: MockRepository<ControlMapping>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let kafkaService: ReturnType<typeof createMockKafkaService>;
  let frameworksService: ReturnType<typeof createMockFrameworksService>;
  let configService: ReturnType<typeof createMockConfigService>;
  let serviceDiscovery: ReturnType<typeof createMockServiceDiscovery>;
  let metricsService: ReturnType<typeof createMockMetricsService>;
  let tracingService: ReturnType<typeof createMockTracingService>;
  let loggingService: ReturnType<typeof createMockLoggingService>;
  let redisService: ReturnType<typeof createMockRedisService>;
  let dataSource: any;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getCount: jest.fn(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    orWhere: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };


  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mocks using factories
    controlRepository = createMockControlRepository();
    testResultRepository = createMockTestResultRepository();
    implementationRepository = createMockImplementationRepository();
    exceptionRepository = createMockExceptionRepository();
    assessmentRepository = createMockAssessmentRepository();
    mappingRepository = createMockMappingRepository();
    eventEmitter = createMockEventEmitter();
    kafkaService = createMockKafkaService();
    frameworksService = createMockFrameworksService();
    configService = createMockConfigService();
    redisService = createMockRedisService();
    serviceDiscovery = createMockServiceDiscovery();
    metricsService = createMockMetricsService();
    tracingService = createMockTracingService();
    loggingService = createMockLoggingService();
    
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn().mockImplementation((entity, data) => Array.isArray(data) ? data : [data]),
        },
      }),
      manager: {
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockImplementation((entity, data) => Array.isArray(data) ? data : [data]),
      },
    };

    // Manually instantiate the service with all dependencies
    service = new ControlsService(
      controlRepository,
      implementationRepository,
      testResultRepository,
      exceptionRepository,
      assessmentRepository,
      mappingRepository,
      configService as ConfigService,
      redisService,
      eventEmitter,
      kafkaService,
      frameworksService,
      serviceDiscovery,
      metricsService,
      tracingService,
      loggingService,
      dataSource
    );
  });

  describe('Control Metrics Calculation', () => {
    it('should calculate basic control metrics', async () => {
      const control = createMockControl();
      controlRepository.findOne.mockResolvedValue(control);
      controlRepository.save.mockResolvedValue(control);

      // Configure the testResultRepository's query builder mock
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total_tests: '30',
        passed_tests: '29',
        failed_tests: '1',
        avg_duration: '125.5',
        min_duration: '90',
        max_duration: '180',
      });

      const metrics = await service.getControlMetrics('control-123');

      expect(metrics).toMatchObject({
        successRate: expect.any(Number),
        avgTestDuration: 125.5,
        totalTests: 30,
        failureCount: 1,
      });
      expect(metrics.successRate).toBeCloseTo(0.967, 3);
    });

    it('should handle controls without test results', async () => {
      const newControl = createMockControl({ metrics: null });
      controlRepository.findOne.mockResolvedValue(newControl);
      controlRepository.save.mockResolvedValue(newControl);
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      const metrics = await service.getControlMetrics('control-123');

      expect(metrics).toMatchObject({
        successRate: 0,
        avgTestDuration: 0,
        totalTests: 0,
        failureCount: 0,
      });
    });

    it('should calculate metrics over time periods', async () => {
      controlRepository.findOne.mockResolvedValue(createMockControl());
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      const periods = [
        { period: '7d', expectedTests: 5 },
        { period: '30d', expectedTests: 20 },
        { period: '90d', expectedTests: 50 },
        { period: '365d', expectedTests: 200 },
      ];

      for (const { period, expectedTests } of periods) {
        mockQueryBuilder.getRawOne.mockResolvedValue({
          total_tests: String(expectedTests),
          passed_tests: String(Math.floor(expectedTests * 0.95)),
          avg_duration: '120',
        });
        controlRepository.save.mockResolvedValue(createMockControl());

        const metrics = await service.getControlMetrics('control-123');
        expect(metrics.totalTests).toBe(expectedTests);
      }
    });

    it('should track metric trends', async () => {
      controlRepository.findOne.mockResolvedValue(createMockControl());
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      const trendData = [
        { month: '2024-10', success_rate: '0.90', avg_duration: '110' },
        { month: '2024-11', success_rate: '0.93', avg_duration: '115' },
        { month: '2024-12', success_rate: '0.95', avg_duration: '120' },
      ];
      mockQueryBuilder.getRawMany.mockResolvedValue(trendData);

      const metrics = await service.getControlMetricsTrend('control-123', 3);

      expect(metrics.trend).toHaveLength(3);
      expect(metrics.improvement).toBe(true);
      expect(metrics.trendPercentage).toBeCloseTo(5.56, 2); // (0.95 - 0.90) / 0.90 * 100
    });

    it('should identify metric anomalies', async () => {
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      const anomalies = [
        { date: '2024-12-01', duration: 500, result: 'fail', reason: 'Timeout' },
        {
          date: '2024-12-05',
          duration: 10,
          result: 'pass',
          reason: 'Too fast - possible false positive',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(anomalies);

      const result = await service.detectMetricAnomalies('control-123');

      expect(result.anomalies).toHaveLength(2);
      expect(result.anomalies[0].reason).toContain('Timeout');
    });
  });

  describe('Control Coverage Calculation', () => {
    it('should calculate overall control coverage', async () => {
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total_controls: 100,
        implemented_controls: 85,
        fully_implemented: 80,
        partially_implemented: 5,
        not_implemented: 15,
      });

      const coverage = await service.getControlCoverage('org-123');

      expect(coverage.overall).toMatchObject({
        totalControls: 100,
        implementedControls: 85,
        fullyImplemented: 80,
        coveragePercentage: 80.0,
      });
    });

    it('should calculate coverage by category', async () => {
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          category: ControlCategory.ACCESS_CONTROL,
          type: ControlType.PREVENTIVE,
          total_controls: 20,
          implemented_controls: 18,
          fully_implemented: 17,
          coverage_percentage: 85.0,
        },
        {
          category: ControlCategory.AUDIT_ACCOUNTABILITY,
          type: ControlType.DETECTIVE,
          total_controls: 15,
          implemented_controls: 12,
          fully_implemented: 10,
          coverage_percentage: 66.7,
        },
      ]);

      const coverage = await service.getControlCoverage('org-123');

      expect(coverage.byCategory).toHaveLength(2);
      expect(coverage.byCategory[0].category).toBe(ControlCategory.ACCESS_CONTROL);
      expect(coverage.byCategory[0].fully_implemented).toBe(17);
    });

    it('should calculate coverage by framework', async () => {
      // Mock for overall coverage
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total_controls: 90,
        implemented_controls: 80,
        fully_implemented: 75,
      });

      // Mock for by category
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      // Mock controls with frameworks for the find() call
      const mockControls = [
        {
          id: '1',
          frameworks: [{ name: 'SOC2' }],
          implementations: [
            { organizationId: 'org-123', status: ImplementationStatus.IMPLEMENTED },
          ],
        },
        {
          id: '2',
          frameworks: [{ name: 'SOC2' }],
          implementations: [],
        },
        {
          id: '3',
          frameworks: [{ name: 'ISO27001' }],
          implementations: [
            { organizationId: 'org-123', status: ImplementationStatus.IMPLEMENTED },
          ],
        },
        {
          id: '4',
          frameworks: [{ name: 'ISO27001' }],
          implementations: [],
        },
        // Add more controls to match the expected numbers
        ...Array.from({ length: 46 }, (_, i) => ({
          id: `soc2-${i + 5}`,
          frameworks: [{ name: 'SOC2' }],
          implementations:
            i < 43 ? [{ organizationId: 'org-123', status: ImplementationStatus.IMPLEMENTED }] : [],
        })),
        ...Array.from({ length: 36 }, (_, i) => ({
          id: `iso-${i + 5}`,
          frameworks: [{ name: 'ISO27001' }],
          implementations:
            i < 32 ? [{ organizationId: 'org-123', status: ImplementationStatus.IMPLEMENTED }] : [],
        })),
      ];

      controlRepository.find.mockResolvedValue(mockControls);

      const coverage = await service.getControlCoverage('org-123', true);

      expect(coverage.byFramework).toHaveLength(2);
      expect(coverage.byFramework[0].framework).toBe('SOC2');
      expect(coverage.byFramework[0].coveragePercentage).toBeCloseTo(91.7, 1);
    });

    it('should track coverage trends over time', async () => {
      // Mock three consecutive months with increasing coverage
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total_controls: '10', implemented_controls: '7' }) // 70%
        .mockResolvedValueOnce({ total_controls: '10', implemented_controls: '7.5' }) // 75%
        .mockResolvedValueOnce({ total_controls: '10', implemented_controls: '8' }); // 80%

      const trend = await service.getCoverageTrend('org-123', 3);

      expect(trend.dataPoints).toHaveLength(3);
      expect(trend.improvement).toBe(true);
      expect(trend.averageMonthlyImprovement).toBe(5.0);
    });

    it('should identify coverage gaps', async () => {
      // Mock gap controls data
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      const gapControls = [
        {
          id: '1',
          code: 'AC-4',
          name: 'Access Control 4',
          category: ControlCategory.ACCESS_CONTROL,
          type: ControlType.PREVENTIVE,
          criticality: 'HIGH',
        },
        {
          id: '2',
          code: 'AC-5',
          name: 'Access Control 5',
          category: ControlCategory.ACCESS_CONTROL,
          type: ControlType.DETECTIVE,
          criticality: 'MEDIUM',
        },
        {
          id: '3',
          code: 'AC-6',
          name: 'Access Control 6',
          category: ControlCategory.ACCESS_CONTROL,
          type: ControlType.PREVENTIVE,
          criticality: 'LOW',
        },
        {
          id: '4',
          code: 'IR-1',
          name: 'Incident Response 1',
          category: ControlCategory.INCIDENT_RESPONSE,
          type: ControlType.CORRECTIVE,
          criticality: 'HIGH',
        },
        {
          id: '5',
          code: 'IR-2',
          name: 'Incident Response 2',
          category: ControlCategory.INCIDENT_RESPONSE,
          type: ControlType.CORRECTIVE,
          criticality: 'MEDIUM',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(gapControls);
      controlRepository.count.mockResolvedValueOnce(40); // Total controls for gap percentage
      controlRepository.count.mockResolvedValueOnce(20); // ACCESS_CONTROL category total
      controlRepository.count.mockResolvedValueOnce(10); // INCIDENT_RESPONSE category total

      const result = await service.identifyCoverageGaps('org-123');

      expect(result.gaps).toHaveLength(2);
      expect(result.totalGapPercentage).toBe(12.5); // 5/40 = 0.125
      expect(result.criticalGaps).toBeDefined();
    });
  });

  describe('Control Effectiveness Metrics', () => {
    it('should calculate control effectiveness score', async () => {
      const control = createMockControl({
        metrics: {
          successRate: 0.95,
          avgTestDuration: 120,
          totalTests: 50,
          failureCount: 2,
        },
      });

      controlRepository.findOne.mockResolvedValue(control);
      testResultRepository.find.mockResolvedValue([
        { result: 'PASSED', findings: [] },
        { result: 'PASSED', findings: [] },
        { result: 'FAILED', findings: ['Issue 1', 'Issue 2'] },
      ]);

      const effectiveness = await service.calculateControlEffectiveness('control-123');

      expect(effectiveness.score).toBeGreaterThan(0);
      expect(effectiveness.score).toBeLessThanOrEqual(1);
      expect(effectiveness.rating).toBeDefined();
      expect(effectiveness.factors).toBeDefined();
    });

    it('should categorize effectiveness levels', async () => {
      const effectivenessLevels = [
        { score: 0.95, expectedRating: 'Excellent' },
        { score: 0.8, expectedRating: 'Good' },
        { score: 0.65, expectedRating: 'Needs Improvement' },
        { score: 0.4, expectedRating: 'Poor' },
      ];

      for (const { score, expectedRating } of effectivenessLevels) {
        const rating = service.getEffectivenessRating(score);
        expect(rating).toBe(expectedRating);
      }
    });

    it('should provide improvement recommendations based on effectiveness', async () => {
      const lowEffectivenessControl = createMockControl({
        metrics: {
          successRate: 0.6,
          avgTestDuration: 300,
          totalTests: 10,
          failureCount: 4,
        },
      });

      controlRepository.findOne.mockResolvedValue(lowEffectivenessControl);

      const recommendations = await service.getEffectivenessRecommendations('control-123');

      console.log('Recommendations received:', recommendations);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.includes('success rate'))).toBe(true);
      expect(recommendations.some((r) => r.includes('testing frequency'))).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track test execution performance', async () => {
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        avg_duration: 120,
        min_duration: 60,
        max_duration: 300,
        p50_duration: 110,
        p95_duration: 250,
        p99_duration: 290,
      });

      const performance = await service.getTestPerformanceMetrics('control-123');

      expect(performance).toMatchObject({
        avgDuration: 120,
        minDuration: 60,
        maxDuration: 300,
        percentiles: {
          p50: 110,
          p95: 250,
          p99: 290,
        },
      });
    });

    it('should identify performance degradation', async () => {
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { week: '2024-W48', avg_duration: 100 },
        { week: '2024-W49', avg_duration: 120 },
        { week: '2024-W50', avg_duration: 150 },
        { week: '2024-W51', avg_duration: 200 },
      ]);

      const degradation = await service.detectPerformanceDegradation('control-123');

      expect(degradation.isDegrading).toBe(true);
      expect(degradation.degradationRate).toBeGreaterThan(0);
      expect(degradation.recommendations).toBeDefined();
    });

    it('should benchmark control performance', async () => {
      // Mock the control
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      controlRepository.findOne.mockResolvedValue(
        createMockControl({
          category: ControlCategory.ACCESS_CONTROL,
        })
      );

      // First getRawOne call is for control metrics
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({
          avg_duration: 120,
          success_rate: 0.95,
        })
        // Second getRawOne call is for category metrics
        .mockResolvedValueOnce({
          category_avg_duration: 150,
          category_avg_success_rate: 0.9,
        });

      const benchmark = await service.benchmarkControlPerformance('control-123');

      expect(benchmark.performanceVsCategory).toBe('above_average');
      expect(benchmark.durationComparison).toBeLessThan(0); // Faster than average
      expect(benchmark.successRateComparison).toBeGreaterThan(0); // Better than average
    });
  });

  describe('Compliance Metrics', () => {
    it('should calculate compliance score', async () => {
      const controls = [
        createMockControl({ metrics: { successRate: 0.95 }, regulatoryRequirement: true }),
        createMockControl({ metrics: { successRate: 0.88 }, regulatoryRequirement: true }),
        createMockControl({ metrics: { successRate: 0.92 }, regulatoryRequirement: false }),
      ];

      controlRepository.find.mockResolvedValue(controls);

      const compliance = await service.calculateComplianceScore('org-123');

      expect(compliance.overallScore).toBeDefined();
      expect(compliance.regulatoryScore).toBeDefined();
      expect(compliance.nonRegulatoryScore).toBeDefined();
      expect(compliance.regulatoryScore).toBeLessThanOrEqual(compliance.overallScore);
    });

    it('should track compliance trends', async () => {
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { month: '2024-10', compliance_score: 0.85, regulatory_score: 0.82 },
        { month: '2024-11', compliance_score: 0.88, regulatory_score: 0.86 },
        { month: '2024-12', compliance_score: 0.91, regulatory_score: 0.9 },
      ]);

      const trend = await service.getComplianceTrend('org-123', 3);

      expect(trend.improving).toBe(true);
      expect(trend.monthlyData).toHaveLength(3);
      expect(trend.projectedScore).toBeGreaterThan(0.85);
    });

    it('should identify compliance risks', async () => {
      // Mock controls with risk indicators
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      const riskyControls = [
        {
          id: 'AC-1',
          code: 'AC-1',
          metrics: { successRate: 0.6 },
          regulatoryRequirement: true,
          criticality: 'HIGH',
          implementations: [{ status: ImplementationStatus.IMPLEMENTED }],
          testResults: [{ result: 'FAILED' }],
        },
        {
          id: 'AU-1',
          code: 'AU-1',
          metrics: {
            successRate: 0.75,
            lastTestDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          },
          regulatoryRequirement: true,
          criticality: 'MEDIUM',
          implementations: [{ status: ImplementationStatus.PARTIALLY_IMPLEMENTED }],
          testResults: [],
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(riskyControls);

      const complianceRisks = await service.identifyComplianceRisks('org-123');

      expect(complianceRisks.highRisk).toHaveLength(1);
      expect(complianceRisks.mediumRisk).toHaveLength(1);
      expect(complianceRisks.overallRiskScore).toBeDefined();
    });
  });

  describe('Testing Frequency Metrics', () => {
    it('should analyze testing frequency compliance', async () => {
      const controls = [
        createMockControl({
          frequency: ControlFrequency.DAILY,
          metrics: { lastTestDate: new Date('2024-12-14') },
        }),
        createMockControl({
          frequency: ControlFrequency.MONTHLY,
          metrics: { lastTestDate: new Date('2024-11-15') },
        }),
      ];

      controlRepository.find.mockResolvedValue(controls);

      const analysis = await service.analyzeTestingFrequencyCompliance('org-123');

      expect(analysis.compliantControls).toBeDefined();
      expect(analysis.overdueControls).toBeDefined();
      expect(analysis.complianceRate).toBeDefined();
    });

    it('should calculate testing schedule adherence', async () => {
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { controlId: 'AC-1', frequency: 'MONTHLY', completed_tests: '28' }, // Expected 30, got 28 = 93.3%
        { controlId: 'AC-2', frequency: 'MONTHLY', completed_tests: '30' }, // Expected 30, got 30 = 100%
        { controlId: 'AC-3', frequency: 'MONTHLY', completed_tests: '25' }, // Expected 30, got 25 = 83.3%
      ]);

      const adherence = await service.getTestingScheduleAdherence('org-123');

      expect(adherence.overallAdherence).toBeCloseTo(0.92, 2); // (28+30+25)/(30+30+30) = 83/90 = 0.922
      expect(adherence.controlsOnSchedule).toBe(2); // AC-1 and AC-2 have >= 0.9 adherence
      expect(adherence.controlsBehindSchedule).toBe(1); // AC-3 has < 0.9 adherence
    });
  });

  describe('Cost and Resource Metrics', () => {
    it('should calculate control implementation costs', async () => {
      (controlRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      const controls = [
        createMockControl({
          costOfImplementation: 50000,
          costOfTesting: 5000,
          implementations: [{ organizationId: 'org-123' }],
          frequency: ControlFrequency.MONTHLY,
        }),
        createMockControl({
          costOfImplementation: 30000,
          costOfTesting: 3000,
          implementations: [{ organizationId: 'org-123' }],
          frequency: ControlFrequency.QUARTERLY,
        }),
        createMockControl({
          costOfImplementation: 20000,
          costOfTesting: 2000,
          implementations: [{ organizationId: 'org-123' }],
          frequency: ControlFrequency.ANNUAL,
        }),
      ];

      mockQueryBuilder.getMany.mockResolvedValue(controls);

      const costs = await service.calculateControlCosts('org-123');

      expect(costs.totalImplementationCost).toBe(100000);
      expect(costs.totalTestingCost).toBe(10000);
      expect(costs.annualTestingCost).toBeDefined();
      // costPerControl includes annualTestingCost: (100000 + 5000*12 + 3000*4 + 2000*1) / 3 = 58000
      expect(costs.costPerControl).toBe(58000);
    });

    it('should analyze resource utilization', async () => {
      (testResultRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { tester: 'user-1', tests_conducted: 50, avg_duration: 120 },
        { tester: 'user-2', tests_conducted: 45, avg_duration: 130 },
        { tester: 'user-3', tests_conducted: 30, avg_duration: 150 },
      ]);

      const utilization = await service.analyzeResourceUtilization('org-123');

      expect(utilization.topTesters).toHaveLength(3);
      expect(utilization.totalTestsConducted).toBe(125);
      expect(utilization.averageTestsPerTester).toBeCloseTo(41.67, 2);
    });

    it('should calculate ROI metrics', async () => {
      const investmentData = {
        totalCost: 110000,
        incidentsPreventedValue: 500000,
        compliancePenaltiesAvoided: 200000,
        efficiencyGains: 50000,
      };

      const roi = await service.calculateControlROI('org-123', investmentData);

      expect(roi.totalReturn).toBe(750000);
      expect(roi.netReturn).toBe(640000);
      expect(roi.roiPercentage).toBeCloseTo(581.82, 2);
    });
  });

  describe('Predictive Metrics', () => {
    it('should predict future compliance scores', async () => {
      const historicalData = [
        { month: '2024-09', score: 0.8 },
        { month: '2024-10', score: 0.83 },
        { month: '2024-11', score: 0.86 },
        { month: '2024-12', score: 0.89 },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(historicalData);

      const prediction = await service.predictComplianceScore('org-123', 3);

      expect(prediction.predictedScores).toHaveLength(3);
      expect(prediction.predictedScores[0]).toBeGreaterThan(0.86);
      expect(prediction.confidence).toBeDefined();
    });

    it('should forecast testing resource needs', async () => {
      const growthData = {
        currentControls: 100,
        monthlyGrowthRate: 0.05,
        avgTestsPerControl: 12,
        avgTestDuration: 120,
      };

      const forecast = await service.forecastResourceNeeds('org-123', 6);

      expect(forecast.projectedControls).toBeGreaterThan(100);
      expect(forecast.requiredTestingHours).toBeDefined();
      expect(forecast.recommendedTesters).toBeDefined();
    });
  });

  describe('Metric Dashboards and Reports', () => {
    it('should generate executive dashboard metrics', async () => {
      // Setup coverage query mock  
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({
          total_controls: 100,
          implemented_controls: 85,
          fully_implemented: 80,
        })
        .mockResolvedValue({
          total_controls: 100,
          avg_effectiveness: 0.88,
          compliance_score: 0.91,
          coverage_percentage: 85.0,
        });

      const dashboard = await service.generateExecutiveDashboard('org-123');

      expect(dashboard).toHaveProperty('overallHealth');
      expect(dashboard).toHaveProperty('keyMetrics');
      expect(dashboard).toHaveProperty('trends');
      expect(dashboard).toHaveProperty('risks');
      expect(dashboard).toHaveProperty('recommendations');
    });

    it('should generate detailed metrics report', async () => {
      // Setup coverage query mock
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total_controls: 50,
        implemented_controls: 40,
        fully_implemented: 35,
      });
      
      const report = await service.generateMetricsReport('org-123', {
        period: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
        includeDetails: true,
        format: 'detailed',
      });

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('controlMetrics');
      expect(report).toHaveProperty('coverageAnalysis');
      expect(report).toHaveProperty('complianceMetrics');
      expect(report).toHaveProperty('performanceMetrics');
      expect(report).toHaveProperty('recommendations');
    });

    it('should export metrics in various formats', async () => {
      // Setup coverage query mock
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total_controls: 25,
        implemented_controls: 20,
        fully_implemented: 18,
      });
      
      const formats = ['json', 'csv', 'pdf'];

      for (const format of formats) {
        const exported = await service.exportMetrics('org-123', { format });
        expect(exported).toBeDefined();
        expect(exported.format).toBe(format);
      }
    });
  });
});
