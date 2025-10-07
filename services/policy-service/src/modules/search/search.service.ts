import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { Policy } from '../policies/entities/policy.entity';
import type { SearchAggregations } from '../shared/types';
import type {
  ElasticsearchBulkResponse,
  ElasticsearchSearchResponse,
  PolicyDocument,
  FrameworkDocument,
  ControlDocument,
  SearchBody,
  SearchQuery,
} from './types/elasticsearch.types';

export interface SearchResult<T> {
  items: T[];
  total: number;
  aggregations?: SearchAggregations;
}

export interface PolicySearchOptions {
  query?: string;
  filters?: {
    type?: string[];
    status?: string[];
    organizationId?: string;
    frameworks?: string[];
    tags?: string[];
    dateRange?: {
      field: string;
      from?: Date;
      to?: Date;
    };
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  pagination?: {
    page: number;
    limit: number;
  };
  highlight?: boolean;
  aggregations?: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexPrefix: string;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService
  ) {
    const esConfig = this.configService.get('policyService.elasticsearch');
    this.indexPrefix = esConfig.index || 'policies';
  }

  async indexPolicy(policy: Policy): Promise<void> {
    try {
      const document = this.transformPolicyToDocument(policy);

      await this.elasticsearchService.index({
        index: this.getPolicyIndex(),
        id: policy.id,
        document: document,
        refresh: true,
      });

      this.logger.debug(`Indexed policy ${policy.id} (${policy.policyNumber})`);
    } catch (error) {
      this.logger.error(`Failed to index policy ${policy.id}:`, error);
      throw error;
    }
  }

  async bulkIndexPolicies(policies: Policy[]): Promise<void> {
    if (policies.length === 0) return;

    try {
      const operations = policies.flatMap((policy) => [
        { index: { _index: this.getPolicyIndex(), _id: policy.id } },
        this.transformPolicyToDocument(policy),
      ]);

      const response = await this.elasticsearchService.bulk({
        operations: operations,
        refresh: true,
      });

      if (response.errors) {
        const bulkResponse = response as ElasticsearchBulkResponse;
        const errors = bulkResponse.items
          .filter((item) => item.index?.error)
          .map((item) => item.index?.error);

        this.logger.error('Bulk indexing errors:', errors);
        throw new Error('Some policies failed to index');
      }

      this.logger.debug(`Bulk indexed ${policies.length} policies`);
    } catch (error) {
      this.logger.error('Failed to bulk index policies:', error);
      throw error;
    }
  }

  async deletePolicy(policyId: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: this.getPolicyIndex(),
        id: policyId,
        refresh: true,
      });

      this.logger.debug(`Deleted policy ${policyId} from index`);
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.warn(`Policy ${policyId} not found in index`);
        return;
      }
      this.logger.error(`Failed to delete policy ${policyId}:`, error);
      throw error;
    }
  }

  async searchPolicies(options: PolicySearchOptions): Promise<SearchResult<any>> {
    try {
      const query = this.buildSearchQuery(options);

      const response = await this.elasticsearchService.search({
        index: this.getPolicyIndex(),
        ...query,
      });

      return this.parseSearchResponse(response, options);
    } catch (error) {
      this.logger.error('Failed to search policies:', error);
      throw error;
    }
  }

  async suggestPolicies(
    prefix: string,
    field: string = 'title',
    size: number = 10
  ): Promise<string[]> {
    try {
      const response = await this.elasticsearchService.search({
        index: this.getPolicyIndex(),
        suggest: {
          policy_suggestions: {
            prefix,
            completion: {
              field: `${field}.suggest`,
              size,
              skip_duplicates: true,
            },
          },
        },
      });

      const suggestions = response.suggest?.policy_suggestions?.[0]?.options;
      if (!suggestions || !Array.isArray(suggestions)) {
        return [];
      }
      return suggestions.map((option) => option.text);
    } catch (error) {
      this.logger.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async analyzePolicyTrends(
    organizationId: string,
    timeRange: { from: Date; to: Date }
  ): Promise<any> {
    try {
      const response = await this.elasticsearchService.search({
        index: this.getPolicyIndex(),
        query: {
          bool: {
            filter: [
              { term: { organizationId } },
              {
                range: {
                  createdAt: {
                    gte: timeRange.from,
                    lte: timeRange.to,
                  },
                },
              },
            ],
          },
        },
        aggs: {
          policies_over_time: {
            date_histogram: {
              field: 'createdAt',
              calendar_interval: 'month',
            },
            aggs: {
              by_type: {
                terms: {
                  field: 'type',
                },
              },
              by_status: {
                terms: {
                  field: 'status',
                },
              },
            },
          },
          compliance_scores: {
            stats: {
              field: 'complianceScore',
            },
          },
          frameworks: {
            terms: {
              field: 'complianceMapping.frameworks',
              size: 20,
            },
          },
        },
        size: 0,
      });

      return response.aggregations;
    } catch (error) {
      this.logger.error('Failed to analyze policy trends:', error);
      throw error;
    }
  }

  async findSimilarPolicies(policyId: string, maxResults: number = 10): Promise<Policy[]> {
    try {
      // First get the policy
      const policyResponse = await this.elasticsearchService.get({
        index: this.getPolicyIndex(),
        id: policyId,
      });

      const policy = policyResponse._source;

      // Find similar using more_like_this query
      const response = await this.elasticsearchService.search({
        index: this.getPolicyIndex(),
        query: {
          more_like_this: {
            fields: ['title', 'description', 'content.sections.content', 'tags'],
            like: [
              {
                _index: this.getPolicyIndex(),
                _id: policyId,
              },
            ],
            min_term_freq: 1,
            max_query_terms: 25,
            min_doc_freq: 1,
          },
        },
        size: maxResults,
      });

      return response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      }));
    } catch (error) {
      this.logger.error(`Failed to find similar policies for ${policyId}:`, error);
      throw error;
    }
  }

  async indexFramework(framework: any): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: 'frameworks',
        id: framework.id,
        document: {
          id: framework.id,
          identifier: framework.identifier,
          name: framework.name,
          version: framework.version,
          description: framework.description,
          type: framework.type,
          regulatoryBody: framework.regulatoryBody,
          isActive: framework.isActive,
          metadata: framework.metadata,
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Error indexing framework:', error);
    }
  }

  async indexControl(control: any): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: 'controls',
        id: control.id,
        document: {
          id: control.id,
          identifier: control.identifier,
          title: control.title,
          description: control.description,
          category: control.category,
          priority: control.priority,
          frameworkId: control.frameworkId,
          implementationStatus: control.implementationStatus,
          implementationGuidance: control.implementationGuidance,
          assessmentCriteria: control.assessmentCriteria,
          createdAt: control.createdAt,
          updatedAt: control.updatedAt,
        },
      });
    } catch (error) {
      this.logger.error('Error indexing control:', error);
    }
  }

  async createIndex(): Promise<void> {
    const indexName = this.getPolicyIndex();

    try {
      const exists = await this.elasticsearchService.indices.exists({
        index: indexName,
      });

      if (exists) {
        this.logger.debug(`Index ${indexName} already exists`);
        return;
      }

      await this.elasticsearchService.indices.create({
        index: indexName,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              policy_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'stop', 'snowball'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            policyNumber: { type: 'keyword' },
            title: {
              type: 'text',
              analyzer: 'policy_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' },
              },
            },
            description: {
              type: 'text',
              analyzer: 'policy_analyzer',
            },
            type: { type: 'keyword' },
            status: { type: 'keyword' },
            workflowState: { type: 'keyword' },
            priority: { type: 'keyword' },
            scope: { type: 'keyword' },
            organizationId: { type: 'keyword' },
            ownerId: { type: 'keyword' },
            tags: { type: 'keyword' },
            keywords: { type: 'keyword' },
            'complianceMapping.frameworks': { type: 'keyword' },
            'complianceMapping.controls': { type: 'keyword' },
            complianceScore: { type: 'float' },
            effectiveDate: { type: 'date' },
            expirationDate: { type: 'date' },
            nextReviewDate: { type: 'date' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            'content.sections.content': {
              type: 'text',
              analyzer: 'policy_analyzer',
            },
            regoPolicy: {
              type: 'text',
              index: false,
            },
          },
        },
      });

      this.logger.log(`Created index ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to create index ${indexName}:`, error);
      throw error;
    }
  }

  async reindexAll(policies: Policy[]): Promise<void> {
    const indexName = this.getPolicyIndex();
    const tempIndex = `${indexName}_temp`;

    try {
      // Create temp index with same mappings
      const settings = await this.getIndexSettings();
      await this.elasticsearchService.indices.create({
        index: tempIndex,
        ...settings,
      });

      // Bulk index to temp
      await this.bulkIndexPolicies(policies);

      // Delete old index
      await this.elasticsearchService.indices.delete({
        index: indexName,
        ignore_unavailable: true,
      });

      // Create alias from temp to main
      await this.elasticsearchService.indices.putAlias({
        index: tempIndex,
        name: indexName,
      });

      this.logger.log(`Reindexed ${policies.length} policies`);
    } catch (error) {
      this.logger.error('Failed to reindex policies:', error);
      throw error;
    }
  }

  private getPolicyIndex(): string {
    return this.indexPrefix;
  }

  private transformPolicyToDocument(policy: Policy): any {
    return {
      ...policy,
      // Flatten nested fields for better search
      frameworksList: policy.complianceMapping?.frameworks || [],
      controlsList: policy.complianceMapping?.controls || [],
      contentText: this.extractContentText(policy.content),
      // Remove large fields not needed for search
      evaluationHistory: undefined,
      changeHistory: undefined,
      viewHistory: undefined,
      downloadHistory: undefined,
    };
  }

  private extractContentText(content: any): string {
    if (!content?.sections) return '';

    return content.sections
      .map((section: any) => {
        let text = `${section.title} ${section.content}`;
        if (section.subsections) {
          text +=
            ' ' + section.subsections.map((sub: any) => `${sub.title} ${sub.content}`).join(' ');
        }
        return text;
      })
      .join(' ');
  }

  private buildSearchQuery(options: PolicySearchOptions): any {
    const query: any = {
      bool: {
        must: [],
        filter: [],
        should: [],
      },
    };

    // Text search
    if (options.query) {
      query.bool.must.push({
        multi_match: {
          query: options.query,
          fields: ['title^3', 'description^2', 'policyNumber^2', 'contentText', 'tags', 'keywords'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Filters
    if (options.filters) {
      const { filters } = options;

      if (filters.organizationId) {
        query.bool.filter.push({ term: { organizationId: filters.organizationId } });
      }

      if (filters.type?.length) {
        query.bool.filter.push({ terms: { type: filters.type } });
      }

      if (filters.status?.length) {
        query.bool.filter.push({ terms: { status: filters.status } });
      }

      if (filters.frameworks?.length) {
        query.bool.filter.push({ terms: { 'complianceMapping.frameworks': filters.frameworks } });
      }

      if (filters.tags?.length) {
        query.bool.filter.push({ terms: { tags: filters.tags } });
      }

      if (filters.dateRange) {
        const rangeQuery: any = {};
        if (filters.dateRange.from) {
          rangeQuery.gte = filters.dateRange.from;
        }
        if (filters.dateRange.to) {
          rangeQuery.lte = filters.dateRange.to;
        }
        query.bool.filter.push({
          range: { [filters.dateRange.field]: rangeQuery },
        });
      }
    }

    // Build complete query
    const searchBody: any = {
      query: query.bool.must.length || query.bool.filter.length ? query : { match_all: {} },
    };

    // Sorting
    if (options.sort?.length) {
      searchBody.sort = options.sort.map((s) => ({ [s.field]: { order: s.order } }));
    }

    // Pagination
    if (options.pagination) {
      searchBody.from = (options.pagination.page - 1) * options.pagination.limit;
      searchBody.size = options.pagination.limit;
    }

    // Highlighting
    if (options.highlight) {
      searchBody.highlight = {
        fields: {
          title: {},
          description: {},
          contentText: { number_of_fragments: 3 },
        },
      };
    }

    // Aggregations
    if (options.aggregations?.length) {
      searchBody.aggs = {};
      options.aggregations.forEach((agg) => {
        searchBody.aggs[agg] = { terms: { field: agg, size: 20 } };
      });
    }

    return searchBody;
  }

  private parseSearchResponse(response: any, options: PolicySearchOptions): SearchResult<any> {
    const items = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      _highlights: hit.highlight,
    }));

    // Handle both old (number) and new (object) total format
    const totalHits = typeof response.hits.total === 'number' 
      ? response.hits.total 
      : response.hits.total?.value || 0;

    const result: SearchResult<any> = {
      items,
      total: totalHits,
    };

    if (response.aggregations) {
      result.aggregations = response.aggregations;
    }

    return result;
  }

  private async getIndexSettings(): Promise<any> {
    // Return the same settings used in createIndex
    return {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 1,
        analysis: {
          analyzer: {
            policy_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'stop', 'snowball'],
            },
          },
        },
      },
      mappings: {
        properties: {
          // Same mappings as createIndex
        },
      },
    };
  }

  async removeControl(id: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: 'controls',
        id,
        refresh: true,
      });
      this.logger.debug(`Control ${id} removed from search index`);
    } catch (error) {
      if (error.statusCode !== 404) {
        this.logger.error(`Failed to remove control ${id} from index: ${error.message}`);
        throw error;
      }
    }
  }

  async searchControls(options: any): Promise<SearchResult<any>> {
    // Implement control search logic similar to policies
    const searchBody: any = {
      query: {
        bool: {
          must: [],
          filter: [],
        },
      },
    };

    if (options.query) {
      searchBody.query.bool.must.push({
        multi_match: {
          query: options.query,
          fields: ['title^3', 'description^2', 'identifier^2', 'category'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    try {
      const response = await this.elasticsearchService.search({
        index: 'controls',
        ...searchBody,
      });

      return {
        items: response.hits.hits.map((hit: any) => ({
          ...hit._source,
          _score: hit._score,
          _highlights: hit.highlight,
        })),
        total: typeof response.hits.total === 'number' ? response.hits.total : (response.hits.total?.value || 0),
        aggregations: (response.aggregations || {}) as SearchAggregations,
      };
    } catch (error) {
      this.logger.error(`Control search failed: ${error.message}`);
      return { items: [], total: 0 };
    }
  }

  async findSimilarControls(id: string, limit: number = 5): Promise<any[]> {
    try {
      const control = await this.elasticsearchService.get({
        index: 'controls',
        id,
      });

      const response = await this.elasticsearchService.search({
        index: 'controls',
        query: {
          more_like_this: {
            fields: ['title', 'description', 'category'],
            like: [
              {
                _index: 'controls',
                _id: id,
              },
            ],
            min_term_freq: 1,
            max_query_terms: 12,
          },
        },
        size: limit,
      });

      return response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _score: hit._score,
      }));
    } catch (error) {
      this.logger.error(`Failed to find similar controls for ${id}: ${error.message}`);
      return [];
    }
  }
}
