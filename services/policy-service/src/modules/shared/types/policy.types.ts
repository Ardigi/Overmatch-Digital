/**
 * Enterprise-grade type definitions for Policy Service
 * Ensures complete type safety across all policy operations
 */

import { PolicyStatus, PolicyPriority, PolicyScope, WorkflowState } from '../../policies/entities/policy.entity';

// ==================== Core Policy Types ====================

export interface PolicyException {
  reason: string;
  description: string;
  scope?: string;
  startDate?: Date;
  endDate?: Date;
  conditions?: string[];
  approvedBy?: string;
  approvalDate?: Date;
  riskAcceptance?: string;
  compensatingControls?: string[];
  reviewDate?: Date;
  id?: string;
}

export interface PolicyOperationContext {
  userId: string;
  organizationId: string;
  operation: PolicyOperation;
  timestamp: Date;
  source: string;
  metadata?: PolicyOperationMetadata;
  permissions?: string[];
  traceId?: string;
}

export enum PolicyOperation {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  PUBLISH = 'publish',
  EVALUATE = 'evaluate',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  MAP_CONTROL = 'map_control',
  UNMAP_CONTROL = 'unmap_control',
}

export interface PolicyOperationMetadata {
  resourceId?: string;
  resourceType?: string;
  requestId?: string;
  clientIp?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  [key: string]: string | number | boolean | undefined;
}

// ==================== Control & Framework Types ====================

export interface ControlDetails {
  [controlId: string]: {
    id: string;
    code: string;
    name: string;
    description?: string;
    framework: string;
    category?: string;
    implementation?: string;
    testing?: string;
    evidence?: string[];
    status?: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable';
    lastAssessed?: Date;
    assessedBy?: string;
    gaps?: string[];
    remediationPlan?: string;
    dueDate?: Date;
    owner?: string;
    risk?: RiskLevel;
  };
}

export interface FrameworkDetails {
  id: string;
  name: string;
  version?: string;
  description?: string;
  totalControls: number;
  implementedControls?: number;
  categories?: FrameworkCategory[];
  certificationBody?: string;
  validUntil?: Date;
  lastAudit?: Date;
  nextAudit?: Date;
  complianceScore?: number;
}

export interface FrameworkCategory {
  id: string;
  name: string;
  description?: string;
  controls: string[];
  weight?: number;
}

// ==================== Evidence Types ====================

export interface EvidenceDetails {
  [evidenceId: string]: {
    id: string;
    title: string;
    description?: string;
    type: EvidenceType;
    collectionDate: Date;
    collectedBy: string;
    source: string;
    status: EvidenceStatus;
    verificationStatus?: VerificationStatus;
    attachments?: EvidenceAttachment[];
    linkedControls?: string[];
    linkedPolicies?: string[];
    metadata?: Record<string, unknown>;
  };
}

export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG = 'log',
  REPORT = 'report',
  AUDIT_TRAIL = 'audit_trail',
  CONFIGURATION = 'configuration',
  TEST_RESULT = 'test_result',
  APPROVAL = 'approval',
  EXTERNAL = 'external',
}

export enum EvidenceStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

export enum VerificationStatus {
  NOT_VERIFIED = 'not_verified',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  FAILED = 'failed',
}

export interface EvidenceAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  uploadedAt: Date;
  uploadedBy: string;
  checksum?: string;
}

// ==================== Evaluation Types ====================

export interface PolicyEvaluationResult {
  result: 'allow' | 'deny' | 'conditional';
  reason?: string;
  conditions?: string[];
  metadata?: PolicyEvaluationMetadata;
  violations?: PolicyViolation[];
  recommendations?: string[];
  score?: number;
  confidence?: number;
}

export interface PolicyEvaluationMetadata {
  decision_id: string;
  evaluationTime: number;
  allowed: boolean;
  evaluatedRules?: string[];
  matchedConditions?: string[];
  failedConditions?: string[];
  policyVersion?: string;
  engineVersion?: string;
}

export interface PolicyViolation {
  id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
  remediation?: string;
  documentation?: string;
}

// ==================== Metrics Types ====================

export interface PolicyMetricsResult {
  total: number;
  byStatus: Record<PolicyStatus, number>;
  byPriority: Record<PolicyPriority, number>;
  byScope?: Record<PolicyScope, number>;
  byType?: Record<string, number>;
  averageCompletionTime: number;
  complianceScore: number;
  coverageMetrics?: PolicyCoverageMetrics;
  effectivenessMetrics?: PolicyEffectivenessMetrics;
  riskMetrics?: PolicyRiskMetrics;
}

export interface PolicyCoverageMetrics {
  totalControls: number;
  coveredControls: number;
  coveragePercentage: number;
  byFramework: Record<string, {
    total: number;
    covered: number;
    percentage: number;
  }>;
  gaps: string[];
}

export interface PolicyEffectivenessMetrics {
  adoptionRate: number;
  violationRate: number;
  remediationTime: number;
  trainingCompletionRate: number;
  incidentReductionRate: number;
  lastAssessment: Date;
  trend: 'improving' | 'stable' | 'declining';
}

export interface PolicyRiskMetrics {
  overallRisk: RiskLevel;
  inherentRisk: number;
  residualRisk: number;
  riskReduction: number;
  byCategory: Record<string, RiskLevel>;
  topRisks: PolicyRisk[];
}

export interface PolicyRisk {
  id: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  score: number;
  level: RiskLevel;
  mitigation?: string;
  owner?: string;
  dueDate?: Date;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// ==================== Notification Types ====================

export interface NotificationData {
  type: NotificationType;
  priority: NotificationPriority;
  subject: string;
  body: string;
  recipients: NotificationRecipient[];
  metadata?: Record<string, unknown>;
  templateId?: string;
  attachments?: NotificationAttachment[];
  scheduledFor?: Date;
  expiresAt?: Date;
}

export enum NotificationType {
  POLICY_CREATED = 'policy_created',
  POLICY_UPDATED = 'policy_updated',
  POLICY_APPROVED = 'policy_approved',
  POLICY_PUBLISHED = 'policy_published',
  POLICY_EXPIRED = 'policy_expired',
  POLICY_REVIEW_NEEDED = 'policy_review_needed',
  CONTROL_MAPPED = 'control_mapped',
  VIOLATION_DETECTED = 'violation_detected',
  COMPLIANCE_ALERT = 'compliance_alert',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface NotificationRecipient {
  id: string;
  type: 'user' | 'role' | 'group' | 'email';
  value: string;
  name?: string;
}

export interface NotificationAttachment {
  filename: string;
  content: string | Buffer;
  mimeType: string;
}

// ==================== Workflow Types ====================

export interface WorkflowInstance {
  id: string;
  workflowType: string;
  entityId: string;
  entityType: string;
  currentState: WorkflowState;
  data: WorkflowData;
  history: WorkflowHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowData {
  policyId?: string;
  title?: string;
  description?: string;
  approvers?: string[];
  comments?: WorkflowComment[];
  attachments?: string[];
  dueDate?: Date;
  priority?: PolicyPriority;
  [key: string]: unknown;
}

export interface WorkflowHistoryEntry {
  id: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  transitionedBy: string;
  transitionedAt: Date;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowComment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  type: 'comment' | 'approval' | 'rejection' | 'request_changes';
  attachments?: string[];
}

// ==================== Query Filter Types ====================

export interface PolicyQueryFilters {
  organizationId?: string;
  type?: string;
  status?: PolicyStatus;
  priority?: PolicyPriority;
  scope?: PolicyScope;
  frameworks?: string[];
  tags?: string[];
  ownerId?: string;
  department?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  includeArchived?: boolean;
  includeMetrics?: boolean;
}

// ==================== OPA Integration Types ====================

export interface OpaInput {
  userId: string;
  resourceId: string;
  action: string;
  organizationId: string;
  environment: 'development' | 'staging' | 'production';
  context: OpaContext;
  attributes?: Record<string, unknown>;
}

export interface OpaContext {
  timestamp: Date;
  requestId: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface OpaData {
  policies?: Record<string, unknown>;
  users?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  roles?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
}

export interface OpaMetrics {
  timer_rego_query_eval_ns?: number;
  timer_rego_query_compile_ns?: number;
  timer_server_handler_ns?: number;
  counter_server_query_cache_hit?: number;
  histogram_eval_duration?: number[];
}

// ==================== Validation Types ====================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  value: unknown;
  constraint: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ==================== Audit Types ====================

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: AuditChange[];
  metadata?: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
}

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AuditMetadata {
  requestId?: string;
  sessionId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

// ==================== Response Types ====================

export interface PolicyResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: PolicyError;
  metadata?: ResponseMetadata;
}

export interface PolicyError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ResponseMetadata {
  timestamp: Date;
  requestId: string;
  version: string;
  pagination?: PaginationMetadata;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ==================== Cache Types ====================

export interface PolicyCacheEntry {
  key: string;
  value: unknown;
  ttl: number;
  tags: string[];
  createdAt: Date;
  expiresAt: Date;
  hits: number;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
  ttlExpirations: number;
}

// Type guards for runtime type checking
export function isPolicyOperationContext(obj: unknown): obj is PolicyOperationContext {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'userId' in obj &&
    'organizationId' in obj &&
    'operation' in obj &&
    'timestamp' in obj &&
    'source' in obj
  );
}

export function isPolicyEvaluationResult(obj: unknown): obj is PolicyEvaluationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'result' in obj &&
    ['allow', 'deny', 'conditional'].includes((obj as PolicyEvaluationResult).result)
  );
}

export function isControlDetails(obj: unknown): obj is ControlDetails {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Object.values(obj).every(
      control =>
        typeof control === 'object' &&
        'id' in control &&
        'code' in control &&
        'name' in control &&
        'framework' in control
    )
  );
}