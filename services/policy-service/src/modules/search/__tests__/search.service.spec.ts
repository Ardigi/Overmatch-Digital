import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchService } from '../search.service';

describe('SearchService', () => {
  let service: SearchService;
  let elasticsearchService: ElasticsearchService;
  let configService: ConfigService;

  const mockElasticsearchService = {
    index: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    search: jest.fn(),
    bulk: jest.fn(),
    get: jest.fn(),
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      putMapping: jest.fn(),
      refresh: jest.fn(),
      analyze: jest.fn(),
      putAlias: jest.fn(),
    },
    count: jest.fn(),
    mget: jest.fn(),
    ping: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key) => {
      if (key === 'policyService.elasticsearch') {
        return { index: 'policies' };
      }
      return null;
    }),
  };

  const mockPolicy = {
    id: 'policy-123',
    policyNumber: 'POL-001',
    title: 'Access Control Policy',
    description: 'Policy for managing user access controls',
    purpose: 'To establish access control procedures',
    type: 'security',
    status: 'active',
    workflowState: 'approved',
    priority: 'high',
    scope: 'organization',
    organizationId: 'org-123',
    ownerId: 'user-123',
    ownerName: 'Security Team',
    ownerEmail: 'security@example.com',
    version: '1.0',
    content: {
      sections: [
        {
          title: 'Overview',
          content: 'Policy content here',
          subsections: []
        }
      ]
    },
    complianceMapping: {
      frameworks: ['SOC2', 'ISO27001'],
      controls: ['CC1.1', 'A.5.1.1']
    },
    complianceScore: 0.95,
    tags: ['security', 'access', 'compliance'],
    keywords: ['access', 'control'],
    effectiveDate: new Date('2024-01-01'),
    expirationDate: new Date('2024-12-31'),
    nextReviewDate: new Date('2024-06-01'),
    lastReviewDate: new Date('2023-12-01'),
    approvalDate: new Date('2024-01-01'),
    publishedDate: new Date('2024-01-01'),
    viewCount: 100,
    downloadCount: 25,
    adoptionRate: 0.85,
    isEvaluatable: true,
    isTemplate: false,
    createdBy: 'user-123',
    updatedBy: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    regoPolicy: 'package policy.access_control',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Manual instantiation pattern
    elasticsearchService = mockElasticsearchService as any;
    configService = mockConfigService as any;
    service = new SearchService(elasticsearchService, configService);
  });

  describe('indexPolicy', () => {
    it('should index a policy document', async () => {
      mockElasticsearchService.index.mockResolvedValue({
        _id: 'policy-123',
        result: 'created'
      });

      await service.indexPolicy(mockPolicy);

      expect(elasticsearchService.index).toHaveBeenCalledWith({
        index: 'policies',
        id: 'policy-123',
        document: expect.objectContaining({
          id: mockPolicy.id,
          title: mockPolicy.title,
          description: mockPolicy.description,
          type: mockPolicy.type,
          tags: mockPolicy.tags,
        }),
        refresh: true,
      });
    });

    it('should handle indexing errors', async () => {
      mockElasticsearchService.index.mockRejectedValue(new Error('Elasticsearch unavailable'));

      await expect(service.indexPolicy(mockPolicy)).rejects.toThrow('Elasticsearch unavailable');
    });
  });

  describe('searchPolicies', () => {
    it('should search policies with query', async () => {
      const searchResponse = {
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: 'policy-123',
              _score: 1.5,
              _source: mockPolicy,
              highlight: {
                title: ['<em>Access Control</em> Policy'],
              },
            },
            {
              _id: 'policy-456',
              _score: 1.2,
              _source: { ...mockPolicy, id: 'policy-456' },
            },
          ],
        },
        aggregations: {
          type: {
            buckets: [
              { key: 'security', doc_count: 10 },
              { key: 'privacy', doc_count: 5 },
            ],
          },
        },
      };

      mockElasticsearchService.search.mockResolvedValue(searchResponse);

      const result = await service.searchPolicies({
        query: 'access control',
        filters: { type: ['security'] },
        pagination: { page: 1, limit: 20 },
      });

      expect(result).toMatchObject({
        total: 2,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'policy-123',
            _score: 1.5,
            _highlights: expect.any(Object),
          }),
        ]),
        aggregations: expect.any(Object),
      });

      expect(elasticsearchService.search).toHaveBeenCalledWith({
        index: 'policies',
        query: expect.any(Object),
        from: 0,
        size: 20,
      });
    });

    it('should handle empty search results', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      const result = await service.searchPolicies({ query: 'nonexistent' });

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should apply filters correctly', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.searchPolicies({
        query: 'test',
        filters: {
          type: ['security'],
          tags: ['compliance'],
          dateRange: {
            field: 'createdAt',
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
        },
      });

      const searchCall = mockElasticsearchService.search.mock.calls[0][0];
      expect(searchCall.query.bool.filter).toContainEqual(
        expect.objectContaining({
          terms: { type: ['security'] },
        })
      );
    });
  });

  describe('indexFramework', () => {
    it('should index a framework document', async () => {
      const mockFramework = {
        id: 'framework-123',
        identifier: 'SOC2',
        name: 'SOC 2 Type II',
        description: 'Service Organization Control 2',
        version: '2017',
        type: 'audit',
        regulatoryBody: 'AICPA',
        isActive: true,
        metadata: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockElasticsearchService.index.mockResolvedValue({
        result: 'created',
      });

      await service.indexFramework(mockFramework);

      expect(elasticsearchService.index).toHaveBeenCalledWith({
        index: 'frameworks',
        id: 'framework-123',
        document: expect.objectContaining({
          identifier: mockFramework.identifier,
          name: mockFramework.name,
        }),
      });
    });
  });

  describe('indexControl', () => {
    it('should index a control document', async () => {
      const mockControl = {
        id: 'control-123',
        identifier: 'CC1.1',
        title: 'Control Environment',
        description: 'The control environment sets the tone',
        category: 'preventive',
        priority: 'high',
        frameworkId: 'framework-123',
        implementationStatus: 'implemented',
        implementationGuidance: 'Implementation guidance here',
        assessmentCriteria: ['Criterion 1'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockElasticsearchService.index.mockResolvedValue({
        result: 'created',
      });

      await service.indexControl(mockControl);

      expect(elasticsearchService.index).toHaveBeenCalledWith({
        index: 'controls',
        id: 'control-123',
        document: expect.objectContaining({
          identifier: mockControl.identifier,
          frameworkId: mockControl.frameworkId,
        }),
      });
    });
  });

  describe('bulkIndexPolicies', () => {
    it('should perform bulk indexing', async () => {
      const policies = [mockPolicy, { ...mockPolicy, id: 'policy-456' }];
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: false,
        items: [
          { index: { _id: 'policy-123', status: 201 } },
          { index: { _id: 'policy-456', status: 201 } },
        ],
      });

      await service.bulkIndexPolicies(policies);

      expect(elasticsearchService.bulk).toHaveBeenCalledWith({
        operations: expect.any(Array),
        refresh: true,
      });
    });

    it('should handle bulk indexing errors', async () => {
      mockElasticsearchService.bulk.mockResolvedValue({
        errors: true,
        items: [
          { index: { _id: 'policy-123', status: 201 } },
          {
            index: {
              _id: 'policy-456',
              status: 400,
              error: { type: 'validation_error' },
            },
          },
        ],
      });

      await expect(
        service.bulkIndexPolicies([
          mockPolicy,
          { ...mockPolicy, id: 'policy-456' },
        ])
      ).rejects.toThrow('Some policies failed to index');
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy from index', async () => {
      mockElasticsearchService.delete.mockResolvedValue({
        result: 'deleted',
      });

      await service.deletePolicy('policy-123');

      expect(elasticsearchService.delete).toHaveBeenCalledWith({
        index: 'policies',
        id: 'policy-123',
        refresh: true,
      });
    });

    it('should handle deletion of non-existent documents', async () => {
      mockElasticsearchService.delete.mockRejectedValue({
        statusCode: 404,
      });

      await expect(service.deletePolicy('non-existent')).resolves.not.toThrow();
    });
  });

  describe('suggestPolicies', () => {
    it('should return policy suggestions', async () => {
      mockElasticsearchService.search.mockResolvedValue({
        suggest: {
          policy_suggestions: [{
            options: [
              { text: 'Access Control Policy' },
              { text: 'Access Management Policy' }
            ]
          }]
        }
      });

      const result = await service.suggestPolicies('access', 'title', 5);

      expect(result).toEqual([
        'Access Control Policy',
        'Access Management Policy'
      ]);
    });
  });

  describe('findSimilarPolicies', () => {
    it('should find similar policies using more_like_this', async () => {
      mockElasticsearchService.get.mockResolvedValue({
        _source: mockPolicy,
      });

      mockElasticsearchService.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _id: 'policy-456',
              _score: 0.85,
              _source: { ...mockPolicy, id: 'policy-456' },
            },
          ],
        },
      });

      const result = await service.findSimilarPolicies('policy-123', 5);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'policy-456',
        _score: 0.85,
      });
    });
  });

  describe('analyzePolicyTrends', () => {
    it('should analyze policy trends with aggregations', async () => {
      const aggregations = {
        policies_over_time: {
          buckets: [
            {
              key_as_string: '2024-01',
              doc_count: 5,
              by_type: { buckets: [{ key: 'security', doc_count: 3 }] }
            }
          ]
        }
      };

      mockElasticsearchService.search.mockResolvedValue({
        aggregations,
      });

      const result = await service.analyzePolicyTrends('org-123', {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
      });

      expect(result).toEqual(aggregations);
    });
  });

  describe('createIndex', () => {
    it('should create index with mappings', async () => {
      mockElasticsearchService.indices.exists.mockResolvedValue(false);
      mockElasticsearchService.indices.create.mockResolvedValue({ 
        acknowledged: true 
      });

      await service.createIndex();

      expect(elasticsearchService.indices.create).toHaveBeenCalledWith({
        index: 'policies',
        settings: expect.any(Object),
        mappings: expect.any(Object),
      });
    });

    it('should not recreate existing index', async () => {
      mockElasticsearchService.indices.exists.mockResolvedValue(true);

      await service.createIndex();

      expect(elasticsearchService.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('reindexAll', () => {
    it('should reindex all policies', async () => {
      mockElasticsearchService.indices.create.mockResolvedValue({ acknowledged: true });
      mockElasticsearchService.bulk.mockResolvedValue({ errors: false, items: [] });
      mockElasticsearchService.indices.delete.mockResolvedValue({ acknowledged: true });
      mockElasticsearchService.indices.putAlias.mockResolvedValue({ acknowledged: true });

      await service.reindexAll([mockPolicy]);

      expect(elasticsearchService.bulk).toHaveBeenCalled();
      expect(elasticsearchService.indices.putAlias).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle search errors', async () => {
      mockElasticsearchService.search.mockRejectedValue(new Error('Search failed'));

      await expect(service.searchPolicies({ query: 'test' })).rejects.toThrow('Search failed');
    });
  });
});