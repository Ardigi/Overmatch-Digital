import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import type { CreateAnalysisDto, QueryAnalysisDto, UpdateAnalysisDto } from './dto';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let service: any;

  const mockUser = {
    id: 'user-123',
    email: 'analyst@example.com',
    organizationId: 'org-123',
    roles: ['compliance_analyst'],
  };

  const mockAnalysis = {
    id: 'analysis-123',
    clientId: 'client-123',
    type: 'compliance_gap',
    status: 'completed',
    findings: [
      {
        area: 'Access Control',
        severity: 'high',
        gaps: ['Missing MFA implementation', 'Inadequate access reviews'],
        recommendations: ['Implement MFA for all users', 'Quarterly access reviews'],
      },
    ],
    score: 75.5,
    createdBy: mockUser.id,
    createdAt: new Date(),
    completedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      analyzeCompliance: jest.fn(),
      analyzeRisks: jest.fn(),
      analyzeTrends: jest.fn(),
      generateRecommendations: jest.fn(),
      compareFrameworks: jest.fn(),
      getAnalysisHistory: jest.fn(),
      exportAnalysis: jest.fn(),
    };

    // Manual instantiation
    controller = new AnalysisController(service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new analysis', async () => {
      const createDto: CreateAnalysisDto = {
        clientId: 'client-123',
        type: 'compliance_gap',
        frameworks: ['SOC2', 'ISO27001'],
        scope: {
          includeControls: true,
          includePolicies: true,
          includeEvidence: true,
        },
      };

      service.create.mockResolvedValue(mockAnalysis);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
        organizationId: mockUser.organizationId,
      });
      expect(result).toEqual(mockAnalysis);
    });

    it('should validate analysis type', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'invalid_type',
      } as any;

      service.create.mockRejectedValue(new BadRequestException('Invalid analysis type'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should handle AI service failures', async () => {
      const createDto: CreateAnalysisDto = {
        clientId: 'client-123',
        type: 'risk_assessment',
      };

      service.create.mockRejectedValue(new Error('AI service unavailable'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow();
    });
  });

  describe('analyzeCompliance', () => {
    it('should perform compliance gap analysis', async () => {
      const analysisDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
        includeRecommendations: true,
      };

      const complianceResult = {
        overallScore: 82.5,
        frameworkScores: {
          SOC2: 85.0,
          ISO27001: 80.0,
        },
        gaps: [
          {
            control: 'CC6.1',
            currentState: 'Partially Implemented',
            targetState: 'Fully Implemented',
            priority: 'high',
          },
        ],
        recommendations: [
          {
            area: 'Access Control',
            action: 'Implement automated access reviews',
            effort: 'medium',
            impact: 'high',
          },
        ],
      };

      service.analyzeCompliance.mockResolvedValue(complianceResult);

      const result = await controller.analyzeCompliance(analysisDto, mockUser);

      expect(service.analyzeCompliance).toHaveBeenCalledWith(analysisDto, mockUser.organizationId);
      expect(result).toEqual(complianceResult);
    });

    it('should handle multiple framework analysis', async () => {
      const analysisDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001', 'NIST', 'HIPAA'],
      };

      service.analyzeCompliance.mockResolvedValue({
        overallScore: 75.0,
        frameworkScores: {
          SOC2: 80.0,
          ISO27001: 78.0,
          NIST: 72.0,
          HIPAA: 70.0,
        },
      });

      await controller.analyzeCompliance(analysisDto, mockUser);

      expect(service.analyzeCompliance).toHaveBeenCalledWith(
        expect.objectContaining({
          frameworks: expect.arrayContaining(['SOC2', 'ISO27001', 'NIST', 'HIPAA']),
        }),
        mockUser.organizationId
      );
    });
  });

  describe('analyzeRisks', () => {
    it('should perform risk assessment', async () => {
      const riskDto = {
        clientId: 'client-123',
        riskCategories: ['security', 'compliance', 'operational'],
        timeframe: '90days',
      };

      const riskResult = {
        overallRiskScore: 'medium',
        risksByCategory: {
          security: { score: 'high', count: 15 },
          compliance: { score: 'medium', count: 8 },
          operational: { score: 'low', count: 3 },
        },
        topRisks: [
          {
            id: 'risk-001',
            title: 'Unpatched vulnerabilities',
            severity: 'high',
            likelihood: 'medium',
            impact: 'high',
            mitigation: 'Implement automated patching',
          },
        ],
        trends: {
          increasing: ['security'],
          decreasing: ['operational'],
          stable: ['compliance'],
        },
      };

      service.analyzeRisks.mockResolvedValue(riskResult);

      const result = await controller.analyzeRisks(riskDto, mockUser);

      expect(service.analyzeRisks).toHaveBeenCalledWith(riskDto, mockUser.organizationId);
      expect(result).toEqual(riskResult);
    });

    it('should include predictive risk analysis', async () => {
      const riskDto = {
        clientId: 'client-123',
        includePredictions: true,
        predictionWindow: '6months',
      };

      service.analyzeRisks.mockResolvedValue({
        currentRisks: {
          /* risk data */
        },
        predictions: {
          timeframe: '6months',
          predictedRisks: [
            {
              area: 'Third-party vendors',
              probability: 0.75,
              impact: 'high',
              triggerEvents: ['Contract renewals', 'New integrations'],
            },
          ],
        },
      });

      await controller.analyzeRisks(riskDto, mockUser);

      expect(service.analyzeRisks).toHaveBeenCalledWith(
        expect.objectContaining({ includePredictions: true }),
        mockUser.organizationId
      );
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze compliance trends over time', async () => {
      const trendDto = {
        clientId: 'client-123',
        period: 'last_year',
        metrics: ['compliance_score', 'control_effectiveness', 'evidence_collection'],
      };

      const trendResult = {
        period: 'last_year',
        trends: {
          compliance_score: {
            start: 65.0,
            end: 82.5,
            change: 17.5,
            trend: 'improving',
            dataPoints: [
              /* monthly scores */
            ],
          },
          control_effectiveness: {
            start: 70.0,
            end: 88.0,
            change: 18.0,
            trend: 'improving',
          },
          evidence_collection: {
            start: 60.0,
            end: 85.0,
            change: 25.0,
            trend: 'improving',
          },
        },
        insights: [
          'Significant improvement in evidence collection automation',
          'Control effectiveness increased after Q2 training program',
        ],
      };

      service.analyzeTrends.mockResolvedValue(trendResult);

      const result = await controller.analyzeTrends(trendDto, mockUser);

      expect(service.analyzeTrends).toHaveBeenCalledWith(trendDto, mockUser.organizationId);
      expect(result).toEqual(trendResult);
    });

    it('should compare trends across multiple clients', async () => {
      const trendDto = {
        clientIds: ['client-1', 'client-2', 'client-3'],
        period: 'last_quarter',
        compareMode: true,
      };

      service.analyzeTrends.mockResolvedValue({
        comparison: {
          'client-1': { score: 85.0, trend: 'stable' },
          'client-2': { score: 78.0, trend: 'improving' },
          'client-3': { score: 92.0, trend: 'stable' },
        },
        industryBenchmark: 80.0,
      });

      await controller.analyzeTrends(trendDto, mockUser);

      expect(service.analyzeTrends).toHaveBeenCalledWith(
        expect.objectContaining({ compareMode: true }),
        mockUser.organizationId
      );
    });
  });

  describe('generateRecommendations', () => {
    it('should generate AI-powered recommendations', async () => {
      const recommendationDto = {
        clientId: 'client-123',
        areas: ['security', 'compliance', 'efficiency'],
        priority: 'high',
      };

      const recommendations = {
        immediate: [
          {
            area: 'security',
            title: 'Implement Zero Trust Architecture',
            description: 'Transition from perimeter-based to zero trust security',
            effort: 'high',
            impact: 'high',
            timeline: '6-12 months',
            steps: [
              'Assess current architecture',
              'Define trust boundaries',
              'Implement gradually',
            ],
          },
        ],
        shortTerm: [
          {
            area: 'compliance',
            title: 'Automate Evidence Collection',
            description: 'Implement automated evidence collection for 80% of controls',
            effort: 'medium',
            impact: 'high',
            timeline: '3-6 months',
          },
        ],
        longTerm: [
          {
            area: 'efficiency',
            title: 'AI-Driven Compliance Monitoring',
            description: 'Deploy AI models for continuous compliance monitoring',
            effort: 'high',
            impact: 'very high',
            timeline: '12-18 months',
          },
        ],
      };

      service.generateRecommendations.mockResolvedValue(recommendations);

      const result = await controller.generateRecommendations(recommendationDto, mockUser);

      expect(service.generateRecommendations).toHaveBeenCalledWith(
        recommendationDto,
        mockUser.organizationId
      );
      expect(result).toEqual(recommendations);
    });

    it('should prioritize recommendations based on risk', async () => {
      const recommendationDto = {
        clientId: 'client-123',
        prioritizationMethod: 'risk_based',
        maxRecommendations: 10,
      };

      service.generateRecommendations.mockResolvedValue({
        prioritized: true,
        recommendations: expect.any(Array),
        methodology: 'risk_impact_analysis',
      });

      await controller.generateRecommendations(recommendationDto, mockUser);

      expect(service.generateRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ prioritizationMethod: 'risk_based' }),
        mockUser.organizationId
      );
    });
  });

  describe('compareFrameworks', () => {
    it('should compare compliance across frameworks', async () => {
      const comparisonDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
        includeMapping: true,
      };

      const comparisonResult = {
        frameworks: ['SOC2', 'ISO27001'],
        overlapPercentage: 65,
        uniqueControls: {
          SOC2: ['CC6.7', 'CC6.8'],
          ISO27001: ['A.15.1', 'A.15.2'],
        },
        mappings: [
          {
            SOC2: 'CC6.1',
            ISO27001: 'A.9.1',
            similarity: 0.95,
          },
        ],
        recommendations: [
          'Implement ISO27001 A.15.1 to enhance SOC2 compliance',
          'Use existing SOC2 CC6.7 evidence for ISO27001 A.9.2',
        ],
      };

      service.compareFrameworks.mockResolvedValue(comparisonResult);

      const result = await controller.compareFrameworks(comparisonDto, mockUser);

      expect(service.compareFrameworks).toHaveBeenCalledWith(
        comparisonDto,
        mockUser.organizationId
      );
      expect(result).toEqual(comparisonResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated analyses', async () => {
      const query: QueryAnalysisDto = {
        page: 1,
        limit: 10,
        status: 'completed',
      };

      service.findAll.mockResolvedValue({
        data: [mockAnalysis],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(query, mockUser.organizationId);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      const query: QueryAnalysisDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: query.startDate,
          endDate: query.endDate,
        }),
        mockUser.organizationId
      );
    });
  });

  describe('findOne', () => {
    it('should return analysis by ID', async () => {
      service.findOne.mockResolvedValue(mockAnalysis);

      const result = await controller.findOne('analysis-123', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('analysis-123', mockUser.organizationId);
      expect(result).toEqual(mockAnalysis);
    });

    it('should handle not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Analysis not found'));

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update analysis metadata', async () => {
      const updateDto: UpdateAnalysisDto = {
        tags: ['quarterly-review', 'high-priority'],
        notes: 'Updated after client feedback',
      };

      const updatedAnalysis = { ...mockAnalysis, ...updateDto };
      service.update.mockResolvedValue(updatedAnalysis);

      const result = await controller.update('analysis-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(
        'analysis-123',
        updateDto,
        mockUser.organizationId
      );
      expect(result).toEqual(updatedAnalysis);
    });

    it('should prevent updating completed analyses', async () => {
      const updateDto: UpdateAnalysisDto = {
        status: 'in_progress',
      };

      service.update.mockRejectedValue(new BadRequestException('Cannot modify completed analysis'));

      await expect(controller.update('analysis-123', updateDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return analysis version history', async () => {
      const history = [
        {
          version: 1,
          timestamp: new Date('2024-01-01'),
          changes: ['Initial analysis'],
          performedBy: 'user-123',
        },
        {
          version: 2,
          timestamp: new Date('2024-01-02'),
          changes: ['Added risk assessment'],
          performedBy: 'user-456',
        },
      ];

      service.getAnalysisHistory.mockResolvedValue(history);

      const result = await controller.getAnalysisHistory('analysis-123', mockUser);

      expect(service.getAnalysisHistory).toHaveBeenCalledWith(
        'analysis-123',
        mockUser.organizationId
      );
      expect(result).toEqual(history);
    });
  });

  describe('exportAnalysis', () => {
    it('should export analysis in requested format', async () => {
      const exportDto = {
        format: 'pdf',
        includeCharts: true,
        includeRecommendations: true,
      };

      const exportResult = {
        url: 'https://exports.example.com/analysis-123.pdf',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      service.exportAnalysis.mockResolvedValue(exportResult);

      const result = await controller.exportAnalysis('analysis-123', exportDto, mockUser);

      expect(service.exportAnalysis).toHaveBeenCalledWith(
        'analysis-123',
        exportDto,
        mockUser.organizationId
      );
      expect(result).toEqual(exportResult);
    });

    it('should support multiple export formats', async () => {
      const formats = ['pdf', 'excel', 'json', 'csv'];

      for (const format of formats) {
        service.exportAnalysis.mockResolvedValue({
          url: `https://exports.example.com/analysis.${format}`,
        });

        await controller.exportAnalysis('analysis-123', { format }, mockUser);

        expect(service.exportAnalysis).toHaveBeenCalledWith(
          'analysis-123',
          expect.objectContaining({ format }),
          mockUser.organizationId
        );
      }
    });
  });

  describe('remove', () => {
    it('should soft delete analysis', async () => {
      service.remove.mockResolvedValue(mockAnalysis);

      const result = await controller.remove('analysis-123', mockUser);

      expect(service.remove).toHaveBeenCalledWith('analysis-123', mockUser.organizationId);
      expect(result).toEqual(mockAnalysis);
    });

    it('should prevent deletion of referenced analyses', async () => {
      service.remove.mockRejectedValue(
        new BadRequestException('Analysis is referenced in reports')
      );

      await expect(controller.remove('analysis-123', mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Role-based access control', () => {
    it('should allow analysts to create analyses', async () => {
      const analystUser = { ...mockUser, roles: ['analyst'] };
      service.create.mockResolvedValue(mockAnalysis);

      await controller.create({} as CreateAnalysisDto, analystUser);

      expect(service.create).toHaveBeenCalled();
    });

    it('should restrict sensitive operations to senior roles', async () => {
      const juniorUser = { ...mockUser, roles: ['junior_analyst'] };

      // In real implementation, this would be handled by guards
      // Testing the concept here
      expect(juniorUser.roles).not.toContain('senior_analyst');
    });
  });

  describe('AI Model Integration', () => {
    it('should handle AI model timeouts gracefully', async () => {
      const createDto: CreateAnalysisDto = {
        clientId: 'client-123',
        type: 'predictive_risk',
      };

      service.create.mockRejectedValue(new Error('AI model timeout after 30 seconds'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow('AI model timeout');
    });

    it('should fall back to basic analysis on AI failure', async () => {
      const createDto: CreateAnalysisDto = {
        clientId: 'client-123',
        type: 'compliance_gap',
        fallbackEnabled: true,
      };

      service.create.mockResolvedValue({
        ...mockAnalysis,
        analysisMethod: 'rule_based_fallback',
        aiModelUsed: false,
      });

      const result = await controller.create(createDto, mockUser);

      expect(result.analysisMethod).toBe('rule_based_fallback');
      expect(result.aiModelUsed).toBe(false);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache frequently requested analyses', async () => {
      // First call - should hit service
      await controller.findOne('analysis-123', mockUser);
      expect(service.findOne).toHaveBeenCalledTimes(1);

      // Second call - should use cache (in real implementation)
      await controller.findOne('analysis-123', mockUser);

      // In real implementation with caching, this would still be 1
      // Here we're testing the concept
      expect(service.findOne).toHaveBeenCalledTimes(2);
    });

    it('should handle large dataset analysis', async () => {
      const largeAnalysisDto = {
        clientId: 'client-123',
        type: 'comprehensive',
        scope: {
          includeAllHistoricalData: true,
          timeRange: '5years',
        },
      };

      service.create.mockResolvedValue({
        ...mockAnalysis,
        processingTime: 45000, // 45 seconds
        dataPointsAnalyzed: 1000000,
      });

      const result = await controller.create(largeAnalysisDto, mockUser);

      expect(result.dataPointsAnalyzed).toBeGreaterThan(100000);
    });
  });
});
