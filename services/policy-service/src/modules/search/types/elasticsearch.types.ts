/**
 * Elasticsearch Type Definitions
 * These types replace all any types in search service for enterprise-grade type safety
 */

export interface ElasticsearchBulkResponse {
  took: number;
  errors: boolean;
  items: Array<{
    index?: {
      _index: string;
      _id: string;
      _version?: number;
      result?: string;
      status: number;
      error?: {
        type: string;
        reason: string;
        index?: string;
      };
    };
    delete?: {
      _index: string;
      _id: string;
      status: number;
      error?: {
        type: string;
        reason: string;
      };
    };
  }>;
}

export interface ElasticsearchSearchHit<T = unknown> {
  _index: string;
  _id: string;
  _score: number;
  _source: T;
  highlight?: Record<string, string[]>;
}

export interface ElasticsearchSearchResponse<T = unknown> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: Array<ElasticsearchSearchHit<T>>;
  };
  aggregations?: Record<string, any>;
  suggest?: Record<string, Array<{
    text: string;
    offset: number;
    length: number;
    options: Array<{
      text: string;
      score: number;
      freq?: number;
    }>;
  }>>;
}

export interface PolicyDocument {
  id: string;
  policyNumber: string;
  title: string;
  description: string;
  content: string;
  status: string;
  type: string;
  priority: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  frameworks?: string[];
  controls?: string[];
}

export interface FrameworkDocument {
  id: string;
  identifier: string;
  name: string;
  description: string;
  version: string;
  type: string;
  organizationId: string;
  isActive: boolean;
  controlCount?: number;
}

export interface ControlDocument {
  id: string;
  identifier: string;
  title: string;
  description: string;
  category: string;
  type: string;
  priority: string;
  frameworkId: string;
  organizationId: string;
  implementationStatus: string;
}

export interface SearchQuery {
  bool?: {
    must?: Array<Record<string, unknown>>;
    should?: Array<Record<string, unknown>>;
    must_not?: Array<Record<string, unknown>>;
    filter?: Array<Record<string, unknown>>;
  };
  match?: Record<string, string | { query: string; operator?: string }>;
  multi_match?: {
    query: string;
    fields: string[];
    type?: string;
    operator?: string;
  };
  range?: Record<string, {
    gte?: string | number | Date;
    lte?: string | number | Date;
    gt?: string | number | Date;
    lt?: string | number | Date;
  }>;
  term?: Record<string, string | number | boolean>;
  terms?: Record<string, Array<string | number>>;
}

export interface SearchBody {
  query: SearchQuery;
  size?: number;
  from?: number;
  sort?: Array<Record<string, { order: 'asc' | 'desc' }>>;
  highlight?: {
    fields: Record<string, Record<string, unknown>>;
    pre_tags?: string[];
    post_tags?: string[];
  };
  aggs?: Record<string, unknown>;
  suggest?: Record<string, {
    text: string;
    completion: {
      field: string;
      skip_duplicates?: boolean;
      fuzzy?: {
        fuzziness?: string | number;
      };
    };
  }>;
}