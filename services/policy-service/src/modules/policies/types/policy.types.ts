/**
 * Enterprise-grade type definitions for Policy Service
 * These replace all Record<string, any> with proper type safety
 */

import { ComplianceFramework } from '../../compliance/entities/framework.entity';

/**
 * Policy metadata with full type safety
 */
export interface PolicyMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: string;
  tags: string[];
  category?: string;
  department?: string;
  owner?: string;
  reviewers?: string[];
  approvers?: string[];
  keywords?: string[];
  references?: PolicyReference[];
  customFields?: PolicyCustomFields;
}

/**
 * Policy reference for external documents
 */
export interface PolicyReference {
  title: string;
  url?: string;
  type: 'internal' | 'external' | 'regulation' | 'standard';
  description?: string;
}

/**
 * Custom fields with validation
 */
export interface PolicyCustomFields {
  [key: string]: string | number | boolean | Date | null;
}

/**
 * Policy action parameters with full typing
 */
export interface PolicyActionParameters {
  message?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  notificationRecipients?: string[];
  automationScript?: string;
  webhookUrl?: string;
  retryAttempts?: number;
  timeout?: number;
  escalationPath?: string[];
  remediationSteps?: string[];
  customData?: PolicyCustomFields;
}

/**
 * Policy evaluation context with security
 */
export interface PolicyEvaluationContext {
  timestamp: Date;
  userId: string;
  organizationId: string;
  resource: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  environment: PolicyEnvironment;
  attributes: PolicyAttributes;
  riskScore?: number;
  previousDecisions?: PolicyDecision[];
}

/**
 * Policy environment context
 */
export interface PolicyEnvironment {
  location?: string;
  country?: string;
  region?: string;
  timezone?: string;
  platform?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'api';
  networkType?: 'internal' | 'external' | 'vpn';
  securityLevel?: 'low' | 'medium' | 'high';
  [key: string]: string | undefined;
}

/**
 * Policy attributes for evaluation
 */
export interface PolicyAttributes {
  userRole?: string;
  userGroups?: string[];
  userPermissions?: string[];
  resourceOwner?: string;
  resourceType?: string;
  resourceSensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  dataClassification?: string;
  complianceRequirements?: ComplianceFramework[];
  [key: string]: unknown;
}

/**
 * Policy decision record
 */
export interface PolicyDecision {
  timestamp: Date;
  decision: 'allow' | 'deny' | 'require_mfa' | 'require_approval';
  reason: string;
  policyId: string;
  policyVersion: string;
  evaluationTime: number;
}

/**
 * Control metadata with proper typing
 */
export interface ControlMetadata {
  source?: string;
  sourceVersion?: string;
  lastAssessed?: Date;
  assessor?: string;
  assessmentMethod?: 'manual' | 'automated' | 'hybrid';
  certificationLevel?: 'none' | 'self' | 'internal' | 'external';
  certificationDate?: Date;
  certificationExpiry?: Date;
  complianceScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  mitigationStatus?: 'not_started' | 'in_progress' | 'completed' | 'verified';
  evidenceRequired?: string[];
  testingFrequency?: string;
  automationSupported?: boolean;
  customFields?: ControlCustomFields;
}

/**
 * Control custom fields
 */
export interface ControlCustomFields {
  [key: string]: string | number | boolean | Date | null;
}

/**
 * Compliance mapping structure
 */
export interface ComplianceMapping {
  framework: ComplianceFramework;
  controlIds: string[];
  mappingType: 'direct' | 'partial' | 'derived';
  mappingStrength: number; // 0-100
  notes?: string;
  lastValidated?: Date;
  validator?: string;
}

/**
 * Policy automation rule
 */
export interface PolicyAutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  priority: number;
  schedule?: string; // Cron expression
  maxExecutions?: number;
  cooldownPeriod?: number; // seconds
}

/**
 * Automation trigger configuration
 */
export interface AutomationTrigger {
  type: 'event' | 'schedule' | 'threshold' | 'manual';
  eventName?: string;
  schedule?: string;
  threshold?: ThresholdConfig;
}

/**
 * Threshold configuration for triggers
 */
export interface ThresholdConfig {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  window?: number; // Time window in seconds
}

/**
 * Automation condition
 */
export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Automation action
 */
export interface AutomationAction {
  type: 'notify' | 'remediate' | 'escalate' | 'log' | 'webhook' | 'script';
  parameters: AutomationActionParameters;
  retryConfig?: RetryConfig;
}

/**
 * Automation action parameters
 */
export interface AutomationActionParameters {
  recipients?: string[];
  message?: string;
  webhookUrl?: string;
  scriptId?: string;
  escalationLevel?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  customData?: Record<string, unknown>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  maxBackoffSeconds: number;
}

/**
 * Policy template structure
 */
export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  framework?: ComplianceFramework;
  version: string;
  fields: TemplateField[];
  defaultValues?: Record<string, unknown>;
  validationRules?: ValidationRule[];
  requiredApprovals?: number;
  expiryDays?: number;
}

/**
 * Template field definition
 */
export interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'json';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: FieldValidation;
  options?: FieldOption[];
  dependsOn?: FieldDependency[];
}

/**
 * Field validation rules
 */
export interface FieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  customValidator?: string;
  errorMessage?: string;
}

/**
 * Field option for select fields
 */
export interface FieldOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

/**
 * Field dependency configuration
 */
export interface FieldDependency {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_empty';
  value?: unknown;
}

/**
 * Validation rule for templates
 */
export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  expression: string;
  errorMessage: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Policy integration configuration
 */
export interface PolicyIntegrationConfig {
  provider: string;
  enabled: boolean;
  endpoint?: string;
  authentication?: IntegrationAuth;
  mapping?: IntegrationMapping;
  syncFrequency?: string;
  lastSync?: Date;
  errorHandling?: ErrorHandlingConfig;
}

/**
 * Integration authentication
 */
export interface IntegrationAuth {
  type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  credentials?: IntegrationCredentials;
  tokenEndpoint?: string;
  scope?: string[];
}

/**
 * Integration credentials (encrypted in storage)
 */
export interface IntegrationCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Integration field mapping
 */
export interface IntegrationMapping {
  inbound?: Record<string, string>;
  outbound?: Record<string, string>;
  transformations?: TransformationRule[];
}

/**
 * Transformation rule for data mapping
 */
export interface TransformationRule {
  source: string;
  target: string;
  type: 'direct' | 'function' | 'lookup' | 'constant';
  function?: string;
  lookupTable?: Record<string, unknown>;
  constantValue?: unknown;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  strategy: 'retry' | 'skip' | 'fail' | 'fallback';
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: unknown;
  alertOnError?: boolean;
  alertRecipients?: string[];
}

/**
 * Policy search parameters
 */
export interface PolicySearchParams {
  query?: string;
  frameworks?: ComplianceFramework[];
  status?: string[];
  tags?: string[];
  dateRange?: DateRange;
  organizationId: string;
  includeArchived?: boolean;
  sortBy?: 'relevance' | 'date' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Date range for filtering
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Policy metrics data
 */
export interface PolicyMetrics {
  totalPolicies: number;
  activePolicies: number;
  pendingReview: number;
  expiringSoon: number;
  complianceScore: number;
  coverageByFramework: FrameworkCoverage[];
  recentActivity: PolicyActivity[];
  riskDistribution: RiskDistribution;
}

/**
 * Framework coverage metrics
 */
export interface FrameworkCoverage {
  framework: ComplianceFramework;
  totalControls: number;
  coveredControls: number;
  coverage: number; // percentage
  gaps: string[];
}

/**
 * Policy activity record
 */
export interface PolicyActivity {
  timestamp: Date;
  action: 'created' | 'updated' | 'approved' | 'published' | 'archived' | 'reviewed';
  policyId: string;
  policyTitle: string;
  userId: string;
  userName: string;
  details?: string;
}

/**
 * Risk distribution data
 */
export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/**
 * Policy compliance score calculation
 */
export interface ComplianceScoreCalculation {
  policyId: string;
  framework: ComplianceFramework;
  totalControls: number;
  implementedControls: number;
  partiallyImplementedControls: number;
  notImplementedControls: number;
  score: number; // 0-100
  details: ControlImplementationDetail[];
  calculatedAt: Date;
}

/**
 * Control implementation detail
 */
export interface ControlImplementationDetail {
  controlId: string;
  controlName: string;
  status: 'implemented' | 'partially_implemented' | 'not_implemented' | 'not_applicable';
  evidence?: string[];
  notes?: string;
  lastAssessed?: Date;
}

// All types are already exported as individual interfaces above