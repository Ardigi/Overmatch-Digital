import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { FrameworkMapping } from './entities/framework-mapping.entity';
import { MappingsService } from './mappings.service';

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
    softDelete: jest.fn(),
    findAndCount: jest.fn(),
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
    })),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  }) as any;

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

describe('MappingsService', () => {
  let service: MappingsService;
  let repository: any;
  let eventEmitter: any;
  let httpService: any;
  let configService: any;
  let cacheManager: any;
  let mockQueryBuilder: any;

  const mockMapping = {
    id: 'mapping-123',
    organizationId: 'org-123',
    sourceFramework: 'SOC2',
    targetFramework: 'ISO27001',
    mappings: [
      {
        sourceControl: 'CC6.1',
        targetControl: 'A.9.1',
        similarity: 0.92,
        mappingType: 'direct',
      },
    ],
    coverage: {
      sourceToTarget: 0.78,
      targetToSource: 0.82,
      bidirectional: 0.75,
    },
    metadata: {
      version: '1.0',
      methodology: 'AI-assisted',
    },
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create consistent mockQueryBuilder
    mockQueryBuilder = {
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
    };

    // Create mocks
    repository = createMockRepository();
    repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    eventEmitter = createMockEventEmitter();
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
    } as any;
    configService = {
      get: jest.fn(),
    } as any;
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    // Manual instantiation
    service = new MappingsService(
      repository,
      eventEmitter,
      httpService,
      configService,
      cacheManager
    );

    jest.clearAllMocks();

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const configs = {
        AI_SERVICE_URL: 'http://ai-engine:8080',
        MAPPING_SERVICE_URL: 'http://mapping-engine:8082',
        AI_SERVICE_TIMEOUT: 30000,
        MAPPING_CACHE_TTL: 3600,
      };
      return configs[key];
    });
  });

  describe('create', () => {
    it('should create a new framework mapping', async () => {
      const createDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappings: [
          {
            sourceControl: 'CC6.1',
            targetControl: 'A.9.1',
            mappingType: 'direct',
          },
        ],
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockMapping);
      repository.save.mockResolvedValue(mockMapping);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        status: 'draft',
        coverage: expect.any(Object),
      });
      expect(repository.save).toHaveBeenCalledWith(mockMapping);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'mapping.created',
        expect.objectContaining({ mapping: mockMapping })
      );
      expect(result).toEqual(mockMapping);
    });

    it('should calculate initial coverage metrics', async () => {
      const createDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappings: [
          { sourceControl: 'CC6.1', targetControl: 'A.9.1', mappingType: 'direct' },
          { sourceControl: 'CC6.2', targetControl: 'A.9.2', mappingType: 'direct' },
        ],
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockMapping);
      repository.save.mockResolvedValue(mockMapping);
      httpService.get.mockReturnValue(
        of({
          data: {
            SOC2: { totalControls: 45 },
            ISO27001: { totalControls: 114 },
          },
        })
      );

      await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coverage: expect.objectContaining({
            sourceToTarget: expect.any(Number),
            targetToSource: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('generateFrameworkMapping', () => {
    it('should generate AI-powered framework mapping', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        similarityThreshold: 0.7,
      };
      const organizationId = 'org-123';

      const mockAIResponse = {
        data: {
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
            },
          ],
          statistics: {
            totalSourceControls: 45,
            mappedSourceControls: 38,
            coverage: 0.844,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockAIResponse));

      const result = await service.generateFrameworkMapping(mappingDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/generate',
        expect.objectContaining({
          sourceFramework: mappingDto.sourceFramework,
          targetFramework: mappingDto.targetFramework,
          threshold: mappingDto.similarityThreshold,
          organizationId,
        })
      );
      expect(result).toEqual(mockAIResponse.data);
    });

    it('should handle multi-framework mapping', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFrameworks: ['ISO27001', 'NIST', 'PCI-DSS'],
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            multiFrameworkMappings: {
              ISO27001: { mappings: [], coverage: 0.82 },
              NIST: { mappings: [], coverage: 0.78 },
              'PCI-DSS': { mappings: [], coverage: 0.65 },
            },
          },
        })
      );

      const result = await service.generateFrameworkMapping(mappingDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          targetFrameworks: mappingDto.targetFrameworks,
        })
      );
      expect(result.multiFrameworkMappings).toBeDefined();
    });

    it('should use cached mappings when available', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
      };
      const organizationId = 'org-123';
      const cacheKey = `mapping:${organizationId}:SOC2:ISO27001`;
      const cachedMapping = { mappings: [], cached: true };

      cacheManager.get.mockResolvedValue(cachedMapping);

      const result = await service.generateFrameworkMapping(mappingDto, organizationId);

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(result).toEqual(cachedMapping);
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
      };
      const organizationId = 'org-123';

      const mockSimilarityResponse = {
        data: {
          overallSimilarity: 0.92,
          dimensions: {
            semantic: 0.94,
            structural: 0.88,
            objective: 0.95,
            implementation: 0.91,
          },
          analysis: {
            method: 'transformer_embeddings',
            confidence: 0.93,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockSimilarityResponse));

      const result = await service.analyzeControlSimilarity(similarityDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/analyze/similarity',
        expect.objectContaining({
          control1: similarityDto.control1,
          control2: similarityDto.control2,
        })
      );
      expect(result).toEqual(mockSimilarityResponse.data);
    });

    it('should perform batch similarity analysis', async () => {
      const similarityDto = {
        sourceControls: ['CC6.1', 'CC6.2', 'CC6.3'],
        targetFramework: 'ISO27001',
        findBestMatches: true,
        topN: 3,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            batchResults: [
              {
                sourceControl: 'CC6.1',
                bestMatches: [
                  { control: 'A.9.1', similarity: 0.92 },
                  { control: 'A.9.2', similarity: 0.78 },
                ],
              },
            ],
          },
        })
      );

      const result = await service.analyzeControlSimilarity(similarityDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          batch: true,
          sourceControls: similarityDto.sourceControls,
          topN: 3,
        })
      );
      expect(result.batchResults).toBeDefined();
    });
  });

  describe('findGapControls', () => {
    it('should identify unmapped controls', async () => {
      const gapDto = {
        mappingId: 'mapping-123',
        framework: 'target',
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.get.mockReturnValue(
        of({
          data: {
            ISO27001: {
              controls: [
                { id: 'A.9.1', title: 'Access control policy' },
                { id: 'A.9.2', title: 'User access management' },
                { id: 'A.5.1', title: 'Information security policies' },
              ],
            },
          },
        })
      );

      const result = await service.findGapControls(gapDto, organizationId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: gapDto.mappingId, organizationId },
      });
      expect(result.unmappedControls).toHaveLength(2); // A.5.1 is unmapped
      expect(result.statistics.coveragePercentage).toBeDefined();
    });

    it('should analyze bidirectional gaps', async () => {
      const gapDto = {
        mappingId: 'mapping-123',
        analyzeBidirectional: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.get.mockReturnValue(
        of({
          data: {
            SOC2: { controls: Array(45).fill({}) },
            ISO27001: { controls: Array(114).fill({}) },
          },
        })
      );

      const result = await service.findGapControls(gapDto, organizationId);

      expect(result.sourceGaps).toBeDefined();
      expect(result.targetGaps).toBeDefined();
      expect(result.overallGapScore).toBeDefined();
    });
  });

  describe('suggestConsolidation', () => {
    it('should suggest control consolidation opportunities', async () => {
      const consolidationDto = {
        frameworks: ['SOC2', 'ISO27001', 'NIST'],
        clientId: 'client-123',
      };
      const organizationId = 'org-123';

      const mockConsolidationResponse = {
        data: {
          opportunities: [
            {
              unifiedControl: {
                title: 'Unified Access Control',
                description: 'Comprehensive access control',
              },
              sourceControls: [
                { framework: 'SOC2', control: 'CC6.1' },
                { framework: 'ISO27001', control: 'A.9.1' },
                { framework: 'NIST', control: 'AC-2' },
              ],
              coverageScore: 0.95,
              implementationEffort: 'medium',
            },
          ],
          summary: {
            totalOpportunities: 15,
            potentialEffortReduction: '45%',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockConsolidationResponse));

      const result = await service.suggestConsolidation(consolidationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/consolidate',
        expect.objectContaining({
          frameworks: consolidationDto.frameworks,
          clientId: consolidationDto.clientId,
        })
      );
      expect(result).toEqual(mockConsolidationResponse.data);
    });

    it('should prioritize consolidation by effort reduction', async () => {
      const consolidationDto = {
        frameworks: ['SOC2', 'ISO27001'],
        consolidationStrategy: 'maximize_efficiency',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            opportunities: [
              { effortReduction: '60%', priority: 1 },
              { effortReduction: '45%', priority: 2 },
              { effortReduction: '30%', priority: 3 },
            ],
          },
        })
      );

      const result = await service.suggestConsolidation(consolidationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          strategy: 'maximize_efficiency',
        })
      );
      expect(result.opportunities[0].priority).toBe(1);
    });
  });

  describe('autoMapControls', () => {
    it('should automatically map controls using AI', async () => {
      const autoMapDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappingMode: 'aggressive',
        minSimilarity: 0.6,
      };
      const organizationId = 'org-123';

      const mockAutoMapResponse = {
        data: {
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
            successRate: 0.778,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockAutoMapResponse));

      const result = await service.autoMapControls(autoMapDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/automap',
        expect.objectContaining({
          sourceFramework: autoMapDto.sourceFramework,
          targetFramework: autoMapDto.targetFramework,
          mode: autoMapDto.mappingMode,
          threshold: autoMapDto.minSimilarity,
        })
      );
      expect(result).toEqual(mockAutoMapResponse.data);
    });

    it('should handle conservative mapping mode', async () => {
      const autoMapDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        mappingMode: 'conservative',
        minSimilarity: 0.85,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            mappings: {
              automatic: [],
              requiresReview: [],
              failed: [],
            },
            statistics: {
              automaticallyMapped: 25,
              successRate: 0.556,
            },
          },
        })
      );

      const result = await service.autoMapControls(autoMapDto, organizationId);

      expect(result.statistics.successRate).toBeLessThan(0.6);
    });
  });

  describe('validateMapping', () => {
    it('should validate mapping completeness', async () => {
      const validationDto = {
        mappingId: 'mapping-123',
        validationRules: ['completeness', 'consistency'],
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.post.mockReturnValue(
        of({
          data: {
            overallStatus: 'passed_with_warnings',
            validationResults: {
              completeness: {
                status: 'warning',
                score: 0.78,
                issues: ['7 controls have no mapping'],
              },
              consistency: {
                status: 'passed',
                score: 0.95,
                issues: [],
              },
            },
          },
        })
      );

      const result = await service.validateMapping(validationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/validate',
        expect.objectContaining({
          mapping: mockMapping,
          rules: validationDto.validationRules,
        })
      );
      expect(result.overallStatus).toBe('passed_with_warnings');
    });
  });

  describe('getMappingCoverage', () => {
    it('should calculate detailed mapping coverage', async () => {
      const coverageDto = {
        mappingId: 'mapping-123',
        includeCategories: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.post.mockReturnValue(
        of({
          data: {
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
            },
          },
        })
      );

      const result = await service.getMappingCoverage(coverageDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/coverage',
        expect.objectContaining({
          mapping: mockMapping,
          includeCategories: true,
        })
      );
      expect(result.overall).toBeDefined();
      expect(result.byCategory).toBeDefined();
    });

    it('should generate coverage heatmap', async () => {
      const coverageDto = {
        mappingId: 'mapping-123',
        includeHeatmap: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.post.mockReturnValue(
        of({
          data: {
            heatmap: {
              data: [{ source: 'CC6', target: 'A.9', coverage: 0.92 }],
              visualization: 'base64_encoded_image',
            },
          },
        })
      );

      const result = await service.getMappingCoverage(coverageDto, organizationId);

      expect(result.heatmap).toBeDefined();
      expect(result.heatmap.data).toHaveLength(1);
    });
  });

  describe('exportMapping', () => {
    it('should export mapping in requested format', async () => {
      const mappingId = 'mapping-123';
      const exportDto = { format: 'excel', includeAnalysis: true };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.post.mockReturnValue(
        of({
          data: {
            url: 'https://exports.example.com/mapping-123.xlsx',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
      );

      const result = await service.exportMapping(mappingId, exportDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/export',
        expect.objectContaining({
          mapping: mockMapping,
          format: 'excel',
          includeAnalysis: true,
        })
      );
      expect(result.url).toContain('.xlsx');
    });
  });

  describe('importMapping', () => {
    it('should import mapping from file', async () => {
      const importDto = {
        format: 'csv',
        fileUrl: 'https://imports.example.com/mapping.csv',
        validationMode: 'strict',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            mappingId: 'mapping-456',
            status: 'imported',
            statistics: {
              totalMappings: 150,
              validMappings: 145,
              invalidMappings: 5,
            },
          },
        })
      );

      repository.create.mockReturnValue({ id: 'mapping-456' });
      repository.save.mockResolvedValue({ id: 'mapping-456' });

      const result = await service.importMapping(importDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://mapping-engine:8082/import',
        expect.objectContaining({
          format: importDto.format,
          fileUrl: importDto.fileUrl,
          validationMode: importDto.validationMode,
        })
      );
      expect(result.status).toBe('imported');
    });
  });

  describe('findAll', () => {
    it('should return paginated mappings', async () => {
      const query = {
        page: 1,
        limit: 10,
        sourceFramework: 'SOC2',
      };
      const organizationId = 'org-123';

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockMapping], 1]);

      const result = await service.findAll(query, organizationId);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'mapping.organizationId = :organizationId',
        { organizationId }
      );
      expect(result).toEqual({
        data: [mockMapping],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter by coverage threshold', async () => {
      const query = {
        minCoverage: 0.8,
      };
      const organizationId = 'org-123';

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(query, organizationId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "(mapping.coverage->>'bidirectional')::float >= :minCoverage",
        { minCoverage: 0.8 }
      );
    });
  });

  describe('findOne', () => {
    it('should return mapping by ID', async () => {
      repository.findOne.mockResolvedValue(mockMapping);

      const result = await service.findOne('mapping-123', 'org-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'mapping-123',
          organizationId: 'org-123',
        },
      });
      expect(result).toEqual(mockMapping);
    });

    it('should use cache for frequently accessed mappings', async () => {
      const cacheKey = 'mapping:mapping-123';
      cacheManager.get.mockResolvedValue(mockMapping);

      const result = await service.findOne('mapping-123', 'org-123');

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockMapping);
    });
  });

  describe('update', () => {
    it('should update mapping details', async () => {
      const updateDto = {
        mappings: [
          {
            sourceControl: 'CC6.8',
            targetControl: 'A.9.4.5',
            mappingType: 'partial',
          },
        ],
        status: 'pending_review',
      };

      repository.findOne.mockResolvedValue(mockMapping);
      repository.save.mockResolvedValue({
        ...mockMapping,
        ...updateDto,
      });

      const result = await service.update('mapping-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith({
        ...mockMapping,
        ...updateDto,
        updatedAt: expect.any(Date),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('mapping.updated', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('mapping:mapping-123');
    });

    it('should recalculate coverage on mapping update', async () => {
      const updateDto = {
        mappings: [
          { sourceControl: 'CC6.1', targetControl: 'A.9.1' },
          { sourceControl: 'CC6.2', targetControl: 'A.9.2' },
          { sourceControl: 'CC6.3', targetControl: 'A.9.3' },
        ],
      };

      repository.findOne.mockResolvedValue(mockMapping);
      httpService.get.mockReturnValue(
        of({
          data: {
            SOC2: { totalControls: 45 },
            ISO27001: { totalControls: 114 },
          },
        })
      );
      repository.save.mockResolvedValue(mockMapping);

      await service.update('mapping-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          coverage: expect.objectContaining({
            sourceToTarget: expect.any(Number),
            targetToSource: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Natural Language Processing', () => {
    it('should use NLP for control text analysis', async () => {
      const similarityDto = {
        sourceText: 'The organization shall implement logical access controls',
        targetFramework: 'ISO27001',
        useNLP: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            nlpAnalysis: {
              extractedConcepts: ['logical access', 'access controls'],
              embeddings: [0.123, 0.456, 0.789],
              bestMatches: [
                {
                  control: 'A.9.1',
                  conceptOverlap: 0.85,
                  semanticSimilarity: 0.92,
                },
              ],
            },
          },
        })
      );

      const result = await service.analyzeControlSimilarity(similarityDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          useNLP: true,
          sourceText: similarityDto.sourceText,
        })
      );
      expect(result.nlpAnalysis).toBeDefined();
    });
  });

  describe('Machine Learning Model Management', () => {
    it('should use latest ML model version', async () => {
      const mappingDto = {
        sourceFramework: 'SOC2',
        targetFramework: 'ISO27001',
        useLatestModel: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            modelVersion: 'v3.2.1',
            modelMetrics: {
              accuracy: 0.94,
              precision: 0.92,
              recall: 0.93,
            },
            mappings: [],
          },
        })
      );

      const result = await service.generateFrameworkMapping(mappingDto, organizationId);

      expect(result.modelVersion).toBe('v3.2.1');
      expect(result.modelMetrics).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should soft delete mapping', async () => {
      repository.findOne.mockResolvedValue(mockMapping);
      repository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('mapping-123', 'org-123');

      expect(repository.softDelete).toHaveBeenCalledWith('mapping-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('mapping.deleted', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('mapping:mapping-123');
    });
  });
});
