import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CreateMappingDto, QueryMappingDto, UpdateMappingDto } from './dto';
import { MappingsController } from './mappings.controller';
import { MappingsService } from './mappings.service';

describe('MappingsController', () => {
  let controller: MappingsController;
  let service: any;

  const mockUser = {
    id: 'user-123',
    email: 'analyst@example.com',
    organizationId: 'org-123',
    roles: ['compliance_analyst'],
  };

  const mockMapping = {
    id: 'mapping-123',
    sourceFramework: 'SOC2',
    targetFramework: 'ISO27001',
    mappings: [
      {
        sourceControl: 'CC6.1',
        targetControl: 'A.9.1',
        similarity: 0.92,
        mappingType: 'direct',
        notes: 'Both controls address logical access',
      },
      {
        sourceControl: 'CC6.7',
        targetControl: 'A.9.4',
        similarity: 0.85,
        mappingType: 'partial',
        notes: 'Partial coverage - additional controls needed',
      },
    ],
    coverage: {
      sourceToTarget: 0.78,
      targetToSource: 0.82,
      bidirectional: 0.75,
    },
    metadata: {
      version: '1.0',
      lastUpdated: new Date(),
      approvedBy: 'compliance-team',
      methodology: 'AI-assisted with manual review',
    },
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      generateFrameworkMapping: jest.fn(),
      analyzeControlSimilarity: jest.fn(),
      findGapControls: jest.fn(),
      suggestConsolidation: jest.fn(),
      exportMapping: jest.fn(),
      importMapping: jest.fn(),
      validateMapping: jest.fn(),
      getMappingCoverage: jest.fn(),
      autoMapControls: jest.fn(),
    };

    // Manual instantiation
    controller = new MappingsController(service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new framework mapping', async () => {
      const createDto: CreateMappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappings: [
          {
            sourceControl: 'CC6.1',
            targetControl: 'A.9.1',
            mappingType: 'direct',
            notes: 'Logical access controls',
          },
        ],
      };

      service.create.mockResolvedValue(mockMapping);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
        organizationId: mockUser.organizationId,
      });
      expect(result).toEqual(mockMapping);
    });

    it('should validate framework compatibility', async () => {
      const createDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'INVALID_FRAMEWORK',
        mappings: [],
      } as any;

      service.create.mockRejectedValue(new BadRequestException('Invalid framework'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateFrameworkMapping', () => {
    it('should generate AI-powered framework mapping', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappingStrategy: 'comprehensive',
        includePartialMatches: true,
        similarityThreshold: 0.7,
      };

      const generatedMapping = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappings: [
          {
            sourceControl: 'CC6.1',
            targetControl: 'A.9.1',
            similarity: 0.92,
            mappingType: 'direct',
            confidence: 'high',
            explanation: 'Both controls address user access management',
          },
          {
            sourceControl: 'CC6.2',
            targetControl: 'A.9.2',
            similarity: 0.88,
            mappingType: 'direct',
            confidence: 'high',
            explanation: 'User registration and deregistration processes',
          },
          {
            sourceControl: 'CC6.3',
            targetControls: ['A.9.2', 'A.9.4'],
            similarity: 0.75,
            mappingType: 'one-to-many',
            confidence: 'medium',
            explanation: 'Source control maps to multiple target controls',
          },
        ],
        statistics: {
          totalSourceControls: 45,
          totalTargetControls: 114,
          mappedSourceControls: 38,
          mappedTargetControls: 67,
          unmappedSourceControls: 7,
          unmappedTargetControls: 47,
        },
        coverage: {
          sourceToTarget: 0.84,
          targetToSource: 0.59,
        },
      };

      service.generateFrameworkMapping.mockResolvedValue(generatedMapping);

      const result = await controller.generateMapping(mappingDto, mockUser);

      expect(service.generateFrameworkMapping).toHaveBeenCalledWith(
        mappingDto,
        mockUser.organizationId
      );
      expect(result).toEqual(generatedMapping);
    });

    it('should handle multi-framework mapping', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFrameworks: ['ISO27001', 'NIST', 'PCI-DSS'],
        includeTransitiveMappings: true,
      };

      service.generateFrameworkMapping.mockResolvedValue({
        sourceFramework: 'SOC2',
        multiFrameworkMappings: {
          ISO27001: { mappings: [], coverage: 0.82 },
          NIST: { mappings: [], coverage: 0.78 },
          'PCI-DSS': { mappings: [], coverage: 0.65 },
        },
        transitiveRelationships: [
          {
            path: ['SOC2', 'ISO27001', 'NIST'],
            strength: 0.75,
          },
        ],
      });

      await controller.generateMapping(mappingDto, mockUser);

      expect(service.generateFrameworkMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          targetFrameworks: expect.arrayContaining(['ISO27001', 'NIST', 'PCI-DSS']),
        }),
        mockUser.organizationId
      );
    });
  });

  describe('analyzeControlSimilarity', () => {
    it('should analyze similarity between controls', async () => {
      const similarityDto = {
        control1: {
          framework: 'SOC2',
          controlId: 'CC6.1',
          description: 'Logical access controls',
        },
        control2: {
          framework: 'ISO27001',
          controlId: 'A.9.1',
          description: 'Access control policy',
        },
        analysisDepth: 'comprehensive',
      };

      const similarityResult = {
        overallSimilarity: 0.92,
        dimensions: {
          semantic: 0.94,
          structural: 0.88,
          objective: 0.95,
          implementation: 0.91,
        },
        commonElements: ['User authentication', 'Access authorization', 'Access review'],
        differences: ['ISO27001 includes physical access', 'SOC2 focuses more on logical access'],
        mappingRecommendation: 'direct',
        confidence: 0.93,
      };

      service.analyzeControlSimilarity.mockResolvedValue(similarityResult);

      const result = await controller.analyzeControlSimilarity(similarityDto, mockUser);

      expect(service.analyzeControlSimilarity).toHaveBeenCalledWith(
        similarityDto,
        mockUser.organizationId
      );
      expect(result).toEqual(similarityResult);
    });

    it('should perform batch similarity analysis', async () => {
      const similarityDto = {
        sourceControls: ['CC6.1', 'CC6.2', 'CC6.3'],
        targetFramework: 'ISO27001',
        findBestMatches: true,
        topN: 3,
      };

      service.analyzeControlSimilarity.mockResolvedValue({
        batchResults: [
          {
            sourceControl: 'CC6.1',
            bestMatches: [
              { control: 'A.9.1', similarity: 0.92 },
              { control: 'A.9.2', similarity: 0.78 },
              { control: 'A.9.4', similarity: 0.72 },
            ],
          },
        ],
      });

      await controller.analyzeControlSimilarity(similarityDto, mockUser);

      expect(service.analyzeControlSimilarity).toHaveBeenCalledWith(
        expect.objectContaining({
          findBestMatches: true,
          topN: 3,
        }),
        mockUser.organizationId
      );
    });
  });

  describe('findGapControls', () => {
    it('should identify unmapped controls', async () => {
      const gapDto = {
        mappingId: 'mapping-123',
        framework: 'target',
      };

      const gapAnalysis = {
        framework: 'ISO27001',
        unmappedControls: [
          {
            controlId: 'A.5.1',
            title: 'Information security policies',
            category: 'Organizational controls',
            criticality: 'high',
            suggestedActions: ['Create new SOC2 custom control', 'Map to existing policy controls'],
          },
          {
            controlId: 'A.15.1',
            title: 'Information security in supplier relationships',
            category: 'Supplier relationships',
            criticality: 'medium',
            suggestedActions: ['Enhance vendor management controls'],
          },
        ],
        statistics: {
          totalControls: 114,
          mappedControls: 67,
          unmappedControls: 47,
          coveragePercentage: 58.8,
        },
        recommendations: [
          'Implement 5 high-priority controls to achieve 70% coverage',
          'Consider custom controls for organization-specific requirements',
        ],
      };

      service.findGapControls.mockResolvedValue(gapAnalysis);

      const result = await controller.findGapControls(gapDto, mockUser);

      expect(service.findGapControls).toHaveBeenCalledWith(gapDto, mockUser.organizationId);
      expect(result).toEqual(gapAnalysis);
    });

    it('should analyze bidirectional gaps', async () => {
      const gapDto = {
        mappingId: 'mapping-123',
        analyzeBidirectional: true,
      };

      service.findGapControls.mockResolvedValue({
        sourceGaps: {
          framework: 'SOC2',
          unmappedControls: [],
          coveragePercentage: 84.4,
        },
        targetGaps: {
          framework: 'ISO27001',
          unmappedControls: [],
          coveragePercentage: 58.8,
        },
        overallGapScore: 0.286, // Average gap
      });

      await controller.findGapControls(gapDto, mockUser);

      expect(service.findGapControls).toHaveBeenCalledWith(
        expect.objectContaining({ analyzeBidirectional: true }),
        mockUser.organizationId
      );
    });
  });

  describe('suggestConsolidation', () => {
    it('should suggest control consolidation opportunities', async () => {
      const consolidationDto = {
        frameworks: ['SOC2', 'ISO27001', 'NIST'],
        clientId: 'client-123',
        consolidationStrategy: 'maximize_efficiency',
      };

      const consolidationSuggestions = {
        opportunities: [
          {
            unifiedControl: {
              title: 'Unified Access Control',
              description: 'Comprehensive access control covering all frameworks',
            },
            sourceControls: [
              { framework: 'SOC2', control: 'CC6.1' },
              { framework: 'ISO27001', control: 'A.9.1' },
              { framework: 'NIST', control: 'AC-2' },
            ],
            coverageScore: 0.95,
            implementationEffort: 'medium',
            benefits: [
              'Single implementation for 3 frameworks',
              'Reduced testing effort by 60%',
              'Simplified evidence collection',
            ],
          },
          {
            unifiedControl: {
              title: 'Unified Change Management',
              description: 'Integrated change control process',
            },
            sourceControls: [
              { framework: 'SOC2', control: 'CC8.1' },
              { framework: 'ISO27001', control: 'A.12.1' },
              { framework: 'NIST', control: 'CM-3' },
            ],
            coverageScore: 0.88,
            implementationEffort: 'low',
            benefits: ['Streamlined change process', 'Better tracking and audit trail'],
          },
        ],
        summary: {
          totalOpportunities: 15,
          potentialEffortReduction: '45%',
          recommendedPriority: ['Access Control', 'Change Management', 'Incident Response'],
        },
      };

      service.suggestConsolidation.mockResolvedValue(consolidationSuggestions);

      const result = await controller.suggestConsolidation(consolidationDto, mockUser);

      expect(service.suggestConsolidation).toHaveBeenCalledWith(
        consolidationDto,
        mockUser.organizationId
      );
      expect(result).toEqual(consolidationSuggestions);
    });
  });

  describe('autoMapControls', () => {
    it('should automatically map controls using AI', async () => {
      const autoMapDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappingMode: 'aggressive',
        minSimilarity: 0.6,
        includeManualReview: true,
      };

      const autoMapResult = {
        mappings: {
          automatic: [
            {
              source: 'CC6.1',
              target: 'A.9.1',
              similarity: 0.92,
              confidence: 'high',
            },
          ],
          requiresReview: [
            {
              source: 'CC7.1',
              target: 'A.10.1',
              similarity: 0.68,
              confidence: 'low',
              reviewReason: 'Below confidence threshold',
            },
          ],
          failed: [
            {
              source: 'CC9.1',
              reason: 'No suitable match found',
            },
          ],
        },
        statistics: {
          totalProcessed: 45,
          automaticallyMapped: 35,
          requiresReview: 7,
          failed: 3,
          successRate: 0.778,
        },
        reviewUrl: 'https://app.example.com/mappings/review/mapping-456',
      };

      service.autoMapControls.mockResolvedValue(autoMapResult);

      const result = await controller.autoMapControls(autoMapDto, mockUser);

      expect(service.autoMapControls).toHaveBeenCalledWith(autoMapDto, mockUser.organizationId);
      expect(result).toEqual(autoMapResult);
    });
  });

  describe('validateMapping', () => {
    it('should validate mapping completeness and accuracy', async () => {
      const validationDto = {
        mappingId: 'mapping-123',
        validationRules: ['completeness', 'consistency', 'bidirectional'],
      };

      const validationResult = {
        overallStatus: 'passed_with_warnings',
        validationResults: {
          completeness: {
            status: 'warning',
            score: 0.78,
            issues: ['Source framework coverage is 78%', '7 controls have no mapping'],
          },
          consistency: {
            status: 'passed',
            score: 0.95,
            issues: [],
          },
          bidirectional: {
            status: 'passed',
            score: 0.92,
            issues: [],
          },
        },
        recommendations: [
          'Map remaining 7 controls to achieve full coverage',
          'Review partial mappings for completeness',
        ],
      };

      service.validateMapping.mockResolvedValue(validationResult);

      const result = await controller.validateMapping(validationDto, mockUser);

      expect(service.validateMapping).toHaveBeenCalledWith(validationDto, mockUser.organizationId);
      expect(result).toEqual(validationResult);
    });
  });

  describe('getMappingCoverage', () => {
    it('should calculate detailed mapping coverage', async () => {
      const coverageDto = {
        includeCategories: true,
        includeHeatmap: true,
      };

      const coverageAnalysis = {
        overall: {
          sourceToTarget: 0.84,
          targetToSource: 0.59,
          bidirectional: 0.71,
        },
        byCategory: {
          'Access Control': {
            sourceToTarget: 0.95,
            targetToSource: 0.88,
          },
          'Change Management': {
            sourceToTarget: 0.82,
            targetToSource: 0.75,
          },
          'Incident Response': {
            sourceToTarget: 0.78,
            targetToSource: 0.45,
          },
        },
        heatmap: {
          data: [
            { source: 'CC6', target: 'A.9', coverage: 0.92 },
            { source: 'CC7', target: 'A.10', coverage: 0.65 },
          ],
          legend: {
            high: '>= 0.8',
            medium: '0.6 - 0.79',
            low: '< 0.6',
          },
        },
        insights: [
          'Strong coverage in Access Control domain',
          'Incident Response needs improvement',
          'Consider additional mappings for comprehensive coverage',
        ],
      };

      service.getMappingCoverage.mockResolvedValue(coverageAnalysis);

      const result = await controller.getMappingCoverage('mapping-123', coverageDto, mockUser);

      expect(service.getMappingCoverage).toHaveBeenCalledWith(
        { ...coverageDto, mappingId: 'mapping-123' },
        mockUser.organizationId
      );
      expect(result).toEqual(coverageAnalysis);
    });
  });

  describe('findAll', () => {
    it('should return paginated mappings', async () => {
      const query: QueryMappingDto = {
        page: 1,
        limit: 10,
        sourceFramework: 'SOC2',
        status: 'approved',
      };

      service.findAll.mockResolvedValue({
        data: [mockMapping],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(query, mockUser.organizationId);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by coverage threshold', async () => {
      const query: QueryMappingDto = {
        minCoverage: 0.8,
      };

      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ minCoverage: 0.8 }),
        mockUser.organizationId
      );
    });
  });

  describe('findOne', () => {
    it('should return mapping by ID', async () => {
      service.findOne.mockResolvedValue(mockMapping);

      const result = await controller.findOne('mapping-123', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('mapping-123', mockUser.organizationId);
      expect(result).toEqual(mockMapping);
    });

    it('should handle not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Mapping not found'));

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update mapping details', async () => {
      const updateDto: UpdateMappingDto = {
        mappings: [
          {
            sourceControl: 'CC6.8',
            targetControl: 'A.9.4.5',
            mappingType: 'partial',
            notes: 'Updated mapping',
          },
        ],
        status: 'pending_review',
      };

      const updatedMapping = { ...mockMapping, ...updateDto };
      service.update.mockResolvedValue(updatedMapping);

      const result = await controller.update('mapping-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(
        'mapping-123',
        updateDto,
        mockUser.organizationId
      );
      expect(result).toEqual(updatedMapping);
    });
  });

  describe('exportMapping', () => {
    it('should export mapping in requested format', async () => {
      const exportDto = {
        format: 'excel',
        includeAnalysis: true,
        includeVisualizations: true,
      };

      const exportResult = {
        url: 'https://exports.example.com/mapping-123.xlsx',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        format: 'excel',
      };

      service.exportMapping.mockResolvedValue(exportResult);

      const result = await controller.exportMapping('mapping-123', exportDto, mockUser);

      expect(service.exportMapping).toHaveBeenCalledWith(
        'mapping-123',
        exportDto,
        mockUser.organizationId
      );
      expect(result).toEqual(exportResult);
    });

    it('should support multiple export formats', async () => {
      const formats = ['excel', 'csv', 'json', 'pdf'];

      for (const format of formats) {
        service.exportMapping.mockResolvedValue({
          url: `https://exports.example.com/mapping.${format}`,
          format,
        });

        await controller.exportMapping('mapping-123', { format }, mockUser);

        expect(service.exportMapping).toHaveBeenCalledWith(
          'mapping-123',
          expect.objectContaining({ format }),
          mockUser.organizationId
        );
      }
    });
  });

  describe('importMapping', () => {
    it('should import mapping from file', async () => {
      const importDto = {
        format: 'csv',
        fileUrl: 'https://imports.example.com/mapping.csv',
        validationMode: 'strict',
      };

      const importResult = {
        mappingId: 'mapping-456',
        status: 'imported',
        statistics: {
          totalMappings: 150,
          validMappings: 145,
          invalidMappings: 5,
          warnings: [
            'Control CC9.5 not found in source framework',
            '5 mappings have similarity below threshold',
          ],
        },
      };

      service.importMapping.mockResolvedValue(importResult);

      const result = await controller.importMapping(importDto, mockUser);

      expect(service.importMapping).toHaveBeenCalledWith(importDto, mockUser.organizationId);
      expect(result).toEqual(importResult);
    });
  });

  describe('remove', () => {
    it('should soft delete mapping', async () => {
      service.remove.mockResolvedValue(mockMapping);

      const result = await controller.remove('mapping-123', mockUser);

      expect(service.remove).toHaveBeenCalledWith('mapping-123', mockUser.organizationId);
      expect(result).toEqual(mockMapping);
    });
  });

  describe('Role-based access control', () => {
    it('should allow compliance managers to create mappings', async () => {
      const managerUser = { ...mockUser, roles: ['compliance_manager'] };
      service.create.mockResolvedValue(mockMapping);

      await controller.create({} as CreateMappingDto, managerUser);

      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('AI-Powered Features', () => {
    it('should use natural language processing for mapping', async () => {
      const nlpDto = {
        sourceText: 'The organization shall implement logical access controls',
        targetFramework: 'ISO27001',
        useNLP: true,
      };

      service.analyzeControlSimilarity.mockResolvedValue({
        nlpAnalysis: {
          extractedConcepts: ['logical access', 'access controls', 'implementation'],
          bestMatches: [
            {
              control: 'A.9.1',
              conceptOverlap: 0.85,
              semanticSimilarity: 0.92,
            },
          ],
        },
      });

      await controller.analyzeControlSimilarity(nlpDto, mockUser);

      expect(service.analyzeControlSimilarity).toHaveBeenCalledWith(
        expect.objectContaining({ useNLP: true }),
        mockUser.organizationId
      );
    });

    it('should provide mapping explanations', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        explainMappings: true,
      };

      service.generateFrameworkMapping.mockResolvedValue({
        mappings: [
          {
            source: 'CC6.1',
            target: 'A.9.1',
            similarity: 0.92,
            explanation: {
              reasoning: 'Both controls focus on user access management',
              commonConcepts: ['authentication', 'authorization', 'access review'],
              differences: ['ISO includes physical access'],
              confidence: 'high',
            },
          },
        ],
      });

      const result = await controller.generateMapping(mappingDto, mockUser);

      expect(result.mappings[0].explanation).toBeDefined();
    });
  });
});
