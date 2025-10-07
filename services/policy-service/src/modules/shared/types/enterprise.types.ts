/**
 * Enterprise-grade type definitions for Policy Service
 * Replaces all 'any' types with proper type safety
 */

// ==================== Bulk Operation Types ====================

export interface BulkOperationResult<T = unknown> {
  success: number;
  failed: number;
  errors: BulkOperationError[];
  results?: T[];
  skipped?: number;
}

export interface BulkOperationError {
  index: number;
  item?: unknown;
  error: string;
  code?: string;
  field?: string;
}

export interface BulkUpdateDto {
  ids: string[];
  updates: Record<string, unknown>;
  options?: {
    skipValidation?: boolean;
    continueOnError?: boolean;
    returnUpdated?: boolean;
  };
}

// ==================== Import/Export Types ====================

export interface ImportResult {
  imported: number;
  updated?: number;
  skipped?: number;
  errors: ImportError[];
  warnings?: string[];
}

export interface ImportError {
  row?: number;
  field?: string;
  value?: unknown;
  error: string;
  code?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'excel' | 'pdf';
  includeDeleted?: boolean;
  includeMetadata?: boolean;
  includeRelations?: boolean;
  fields?: string[];
  filters?: Record<string, unknown>;
  frameworkId?: string;
  organizationId?: string;
}

export interface ExportResult {
  data: string | Buffer;
  format: string;
  mimeType: string;
  filename: string;
  recordCount: number;
  metadata?: Record<string, unknown>;
}

// ==================== Test Management Types ====================

export interface TestScheduleDto {
  scheduledDate: Date;
  assignedTo?: string;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  endDate?: Date;
  notificationSettings?: {
    reminderDays?: number[];
    notifyOnComplete?: boolean;
    notifyOnFail?: boolean;
    recipients?: string[];
  };
  metadata?: Record<string, unknown>;
}

export interface TestResultDto {
  testDate: Date;
  status: 'passed' | 'failed' | 'partial' | 'skipped';
  score?: number;
  findings?: TestFinding[];
  evidence?: TestEvidence[];
  testedBy: string;
  notes?: string;
  nextTestDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface TestFinding {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  recommendation?: string;
  affectedArea?: string;
  remediation?: {
    required: boolean;
    dueDate?: Date;
    assignedTo?: string;
    status?: 'pending' | 'in_progress' | 'completed';
  };
}

export interface TestEvidence {
  id?: string;
  type: 'screenshot' | 'log' | 'document' | 'report' | 'other';
  filename?: string;
  url?: string;
  description?: string;
  collectedDate: Date;
  collectedBy: string;
}

// ==================== Evidence Management Types ====================

export interface EvidenceDto {
  type: 'document' | 'screenshot' | 'log' | 'report' | 'audit_trail' | 'approval' | 'test_result';
  title: string;
  description?: string;
  url?: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  collectionDate: Date;
  collectedBy: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verificationDate?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// ==================== Query Types ====================

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string | string[];
  order?: 'ASC' | 'DESC' | Array<'ASC' | 'DESC'>;
  fields?: string[];
  relations?: string[];
  filters?: QueryFilters;
  search?: string;
  includeDeleted?: boolean;
  includeArchived?: boolean;
}

export interface QueryFilters {
  [key: string]: string | number | boolean | Date | string[] | number[] | QueryFilter;
}

export interface QueryFilter {
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'between' | 'exists';
  value: unknown;
  caseSensitive?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  from?: number;
  to?: number;
}

// ==================== Statistics Types ====================

export interface ControlStatistics {
  total: number;
  byStatus: Record<string, number>;
  byFramework: Record<string, number>;
  byCategory: Record<string, number>;
  byCriticality: Record<string, number>;
  implementationRate: number;
  testingCoverage: number;
  averageEffectiveness: number;
  trendsLastMonth?: {
    implemented: number;
    tested: number;
    failed: number;
  };
  upcomingTests?: number;
  overdueTests?: number;
}

// ==================== Framework Types ====================

export interface FrameworkImportData {
  name: string;
  version: string;
  description?: string;
  categories: FrameworkCategoryData[];
  controls: FrameworkControlData[];
  metadata?: Record<string, unknown>;
  mappings?: FrameworkMappingData[];
}

export interface FrameworkCategoryData {
  id?: string;
  name: string;
  description?: string;
  order?: number;
  parent?: string;
}

export interface FrameworkControlData {
  id?: string;
  code: string;
  title: string;
  description: string;
  category: string;
  criticality?: 'critical' | 'high' | 'medium' | 'low';
  implementation?: string;
  testing?: string;
  evidence?: string[];
  references?: string[];
  metadata?: Record<string, unknown>;
}

export interface FrameworkMappingData {
  sourceControl: string;
  targetFramework: string;
  targetControl: string;
  mappingType: 'exact' | 'partial' | 'related';
  confidence?: number;
  notes?: string;
}

// ==================== Coverage Types ====================

export interface CoverageAnalysis {
  totalControls: number;
  coveredControls: number;
  coveragePercentage: number;
  byFramework: Record<string, FrameworkCoverage>;
  gaps: CoverageGap[];
  recommendations: string[];
  lastAnalyzed: Date;
}

export interface FrameworkCoverage {
  framework: string;
  totalControls: number;
  mappedControls: number;
  coveragePercentage: number;
  byCategory?: Record<string, number>;
}

export interface CoverageGap {
  framework: string;
  control: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestedPolicies?: string[];
  estimatedEffort?: 'low' | 'medium' | 'high';
}

// ==================== Module Configuration Types ====================

export interface ModuleImports {
  imports: unknown[];
  providers: unknown[];
  controllers?: unknown[];
  exports?: unknown[];
}

export interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  entities: unknown[];
  synchronize?: boolean;
  logging?: boolean;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

// ==================== Where Clause Types ====================

export interface WhereClause {
  [key: string]: unknown | WhereCondition;
}

export interface WhereCondition {
  $eq?: unknown;
  $ne?: unknown;
  $gt?: unknown;
  $gte?: unknown;
  $lt?: unknown;
  $lte?: unknown;
  $in?: unknown[];
  $nin?: unknown[];
  $like?: string;
  $ilike?: string;
  $between?: [unknown, unknown];
  $exists?: boolean;
  $not?: WhereCondition;
  $or?: WhereCondition[];
  $and?: WhereCondition[];
}

// ==================== Type Guards ====================

export function isBulkOperationResult(obj: unknown): obj is BulkOperationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    'failed' in obj &&
    'errors' in obj &&
    Array.isArray((obj as BulkOperationResult).errors)
  );
}

export function isQueryOptions(obj: unknown): obj is QueryOptions {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as QueryOptions).page === undefined || typeof (obj as QueryOptions).page === 'number'
  );
}

export function isPaginatedResult<T>(obj: unknown): obj is PaginatedResult<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'items' in obj &&
    'total' in obj &&
    Array.isArray((obj as PaginatedResult<T>).items)
  );
}

export function isTestResultDto(obj: unknown): obj is TestResultDto {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'testDate' in obj &&
    'status' in obj &&
    'testedBy' in obj
  );
}

export function isEvidenceDto(obj: unknown): obj is EvidenceDto {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'title' in obj &&
    'collectionDate' in obj &&
    'collectedBy' in obj
  );
}