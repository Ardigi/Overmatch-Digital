/**
 * Centralized type definitions for Policy Service
 * These types replace ALL Record<string, any> instances for enterprise-grade type safety
 */

// Export all response types
export * from './response.types';

// ============================================================================
// OPA Service Types
// ============================================================================

export interface OpaInput {
  userId?: string;
  resourceId?: string;
  action?: string;
  organizationId?: string;
  environment?: string;
  context?: OpaContext;
  [key: string]: unknown;
}

export interface OpaContext {
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface OpaData {
  policies?: unknown[];
  rules?: unknown[];
  resources?: unknown[];
  [key: string]: unknown;
}

export interface OpaMetrics {
  timer_rego_query_eval_ns?: number;
  timer_rego_query_compile_ns?: number;
  timer_server_handler_ns?: number;
  counter_server_query_cache_hit?: number;
  histogram_rego_input_parse_ns?: number;
  [key: string]: number | undefined;
}

// ============================================================================
// Audit and Change Tracking Types
// ============================================================================

export interface AuditChanges {
  [fieldName: string]: {
    oldValue?: unknown;
    newValue?: unknown;
    type?: 'create' | 'update' | 'delete';
    timestamp?: Date;
  };
}

export interface ControlChanges {
  [fieldName: string]: {
    oldValue?: unknown;
    newValue?: unknown;
    timestamp: Date;
    changedBy: string;
    reason?: string;
  };
}

export interface RiskChanges {
  [fieldName: string]: {
    oldValue?: unknown;
    newValue?: unknown;
    timestamp: Date;
    changedBy: string;
    impact?: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ============================================================================
// Compliance and Framework Types
// ============================================================================

export interface ComplianceMappingMetadata {
  source?: string;
  mappingDate?: Date;
  validator?: string;
  confidence?: number;
  notes?: string;
  mappingType?: 'direct' | 'indirect' | 'partial';
  lastReviewed?: Date;
  [key: string]: string | number | Date | boolean | null | undefined;
}

export interface FrameworkCrossMappings {
  [frameworkId: string]: {
    mappingType: 'direct' | 'indirect' | 'partial';
    confidence: number;
    mappedControls: string[];
    lastUpdated: Date;
    validatedBy?: string;
  };
}

// ============================================================================
// Search and Aggregation Types
// ============================================================================

export interface SearchAggregations {
  [aggregationName: string]: {
    buckets?: Array<{
      key: string;
      key_as_string?: string;
      doc_count: number;
      sub_aggregations?: SearchAggregations;
    }>;
    value?: number;
    values?: Record<string, number>;
    doc_count?: number;
  };
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MonitoringMetadata {
  timestamp: Date;
  service: string;
  environment: string;
  version?: string;
  hostname?: string;
  tags?: Record<string, string>;
  metrics?: Record<string, number>;
  alerts?: Array<{
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
  }>;
  [key: string]: unknown;
}

// ============================================================================
// Policy Engine Types
// ============================================================================

export interface PolicyEvaluationParameters {
  userId?: string;
  organizationId?: string;
  resourceId?: string;
  resourceType?: string;
  action?: string;
  environment?: string;
  context?: PolicyEvaluationContext;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PolicyEvaluationContext {
  timestamp: Date;
  requestId?: string;
  correlationId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface TemplateParameters {
  [parameterName: string]: string | number | boolean | Date | null;
}

export interface ParsedParameters {
  [key: string]: string | number | boolean | unknown[] | ParsedParameters;
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowTransitionMetadata {
  triggeredBy?: string;
  timestamp?: Date;
  reason?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notificationSent?: boolean;
  [key: string]: unknown;
}

export interface WorkflowTransitionAttributes {
  approvers?: string[];
  requiredEvidence?: string[];
  dueDate?: Date;
  escalationLevel?: number;
  [key: string]: unknown;
}

export interface WorkflowAdditionalContext {
  sourceSystem?: string;
  correlationId?: string;
  businessJustification?: string;
  riskAssessment?: string;
  [key: string]: unknown;
}

// ============================================================================
// Policy Operation Types
// ============================================================================

export interface PolicyEvaluationResult {
  result: 'allow' | 'deny' | 'require' | 'notify';
  reason?: string;
  conditions?: string[];
  metadata?: Record<string, unknown>;
}

export interface PolicyMetricsResult {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageCompletionTime?: number;
  complianceScore?: number;
}

export interface NotificationData {
  type: string;
  policyId?: string;
  policyName?: string;
  message?: string;
  priority?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface WorkflowInstance {
  id: string;
  type: string;
  entityId: string;
  status: string;
  currentState: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyQueryFilters {
  status?: string;
  priority?: string;
  owner?: string;
  tags?: string[];
  frameworks?: string[];
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  pagination?: {
    page: number;
    limit: number;
  };
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkOperationParams {
  batchSize?: number;
  continueOnError?: boolean;
  notifyOnCompletion?: boolean;
  targetStatus?: string;
  reason?: string;
  scheduledAt?: Date;
  priority?: 'low' | 'normal' | 'high';
  [key: string]: unknown;
}

// ============================================================================
// Service Method Return Types
// ============================================================================

export interface PolicyOperationContext {
  userId: string;
  organizationId: string;
  timestamp: Date;
  source?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface ControlDetails {
  [controlId: string]: {
    id: string;
    code?: string;
    controlId?: string;
    name?: string;
    title?: string;
    description?: string;
    status?: string;
    framework?: string | { name?: string };
    frameworkName?: string;
    category?: string;
    priority?: string;
    lastUpdated?: Date;
    implementationStatus?: string;
  };
}

export interface EvidenceDetails {
  [evidenceId: string]: {
    id: string;
    name?: string;
    type?: string;
    status?: string;
    uploadedAt?: Date;
    uploadedBy?: string;
    fileSize?: number;
    validated?: boolean;
  };
}

// ============================================================================
// MongoDB Error Types
// ============================================================================

export interface MongoKeyPattern {
  [fieldName: string]: 1 | -1 | string | boolean;
}

// ============================================================================
// Additional Types for Type Safety
// ============================================================================

// All types exported above are available for import