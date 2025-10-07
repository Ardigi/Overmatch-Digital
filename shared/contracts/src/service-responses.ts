// ==========================================
// Base Entity Types (to avoid circular imports)
// ==========================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId?: string;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  status: string;
  complianceStatus: ComplianceStatus;
  contactInfo: {
    primaryEmail: string;
    primaryPhone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  billingInfo?: {
    billingEmail?: string;
    billingAddress?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    taxId?: string;
    paymentMethod?: string;
  };
  cpaPartnerId?: string;
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Control {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  frameworks: Framework[];
  organizationId: string;
  implementationStatus: ImplementationStatus;
  effectiveness?: Effectiveness;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evidence {
  id: string;
  projectId: string;
  controlId: string;
  title: string;
  description?: string;
  type: EvidenceType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  collectedDate: Date;
  expiryDate?: Date;
  isAutomated: boolean;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Policy {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  version: string;
  category: string;
  status: PolicyStatus;
  approvedBy?: string;
  approvedAt?: Date;
  effectiveDate?: Date;
  nextReviewDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  type: string;
  status: ProjectStatus;
  frameworks: Framework[];
  startDate?: Date;
  targetEndDate?: Date;
  actualEndDate?: Date;
  auditPeriodStart?: Date;
  auditPeriodEnd?: Date;
  auditorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Enums
// ==========================================

export enum Framework {
  SOC1 = 'SOC1',
  SOC2_SECURITY = 'SOC2_SECURITY',
  SOC2_AVAILABILITY = 'SOC2_AVAILABILITY',
  SOC2_PROCESSING_INTEGRITY = 'SOC2_PROCESSING_INTEGRITY',
  SOC2_CONFIDENTIALITY = 'SOC2_CONFIDENTIALITY',
  SOC2_PRIVACY = 'SOC2_PRIVACY',
  ISO_27001 = 'ISO_27001',
  HIPAA = 'HIPAA',
  PCI_DSS = 'PCI_DSS',
  GDPR = 'GDPR',
}

export enum ImplementationStatus {
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  PARTIALLY_IMPLEMENTED = 'PARTIALLY_IMPLEMENTED',
  IMPLEMENTED = 'IMPLEMENTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum Effectiveness {
  NOT_TESTED = 'NOT_TESTED',
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  NOT_EFFECTIVE = 'NOT_EFFECTIVE',
}

export enum EvidenceType {
  SCREENSHOT = 'SCREENSHOT',
  DOCUMENT = 'DOCUMENT',
  LOG_FILE = 'LOG_FILE',
  CONFIGURATION = 'CONFIGURATION',
  REPORT = 'REPORT',
  ATTESTATION = 'ATTESTATION',
  OTHER = 'OTHER',
}

export enum PolicyStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum RiskLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

export enum ComplianceStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  READY_FOR_AUDIT = 'ready_for_audit',
  UNDER_AUDIT = 'under_audit',
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  EXPIRED = 'expired',
}

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  OBSERVATION = 'OBSERVATION',
}

export enum FindingStatus {
  IDENTIFIED = 'IDENTIFIED',
  CONFIRMED = 'CONFIRMED',
  IN_REMEDIATION = 'IN_REMEDIATION',
  REMEDIATED = 'REMEDIATED',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export enum FindingType {
  CONTROL_DEFICIENCY = 'CONTROL_DEFICIENCY',
  CONTROL_GAP = 'CONTROL_GAP',
  OPERATING_EFFECTIVENESS = 'OPERATING_EFFECTIVENESS',
  DESIGN_DEFICIENCY = 'DESIGN_DEFICIENCY',
  DOCUMENTATION_GAP = 'DOCUMENTATION_GAP',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  COMPLIANCE_GAP = 'COMPLIANCE_GAP',
}

// ==========================================
// Core Service Response Types
// ==========================================

/**
 * Base interface for individual service responses
 * Compatible with ServiceResponse<T> from @soc-compliance/http-common
 */
export interface BaseServiceData {
  success?: boolean;
  message?: string;
  timestamp?: Date;
}

// ==========================================
// Organization & Client Service Responses
// ==========================================

/**
 * Response for organization/client data from client-service
 */
export interface OrganizationResponse extends BaseServiceData {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: string;
  status: string;
  complianceStatus: ComplianceStatus;
  contactInfo: {
    primaryEmail: string;
    primaryPhone?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  cpaPartnerId?: string;
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Control Service Responses
// ==========================================

/**
 * Paginated response for controls from control-service
 */
export interface PaginatedControlsResponse extends BaseServiceData {
  items: Control[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Bulk controls response (non-paginated)
 */
export interface BulkControlsResponse extends BaseServiceData {
  items: Control[];
  total?: number;
}

/**
 * Control summary for reporting and dashboards
 */
export interface ControlSummaryResponse extends BaseServiceData {
  totalControls: number;
  effectiveControls: number;
  failedControls: number;
  notTestedControls: number;
  complianceScore: number;
  implementationBreakdown: {
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
  };
  effectivenessBreakdown: {
    effective: number;
    partiallyEffective: number;
    notEffective: number;
    notTested: number;
  };
  frameworkBreakdown: Array<{
    framework: Framework;
    totalControls: number;
    implementedControls: number;
    effectiveControls: number;
    complianceScore: number;
  }>;
}

/**
 * Control metrics response
 */
export interface ControlMetricsResponse extends BaseServiceData {
  metrics: Array<{
    name: string;
    value: number;
    unit?: string;
    description?: string;
    category: 'implementation' | 'effectiveness' | 'compliance' | 'coverage';
    timestamp: Date;
  }>;
  summary: {
    totalControls: number;
    implementedControls: number;
    effectiveControls: number;
    complianceScore: number;
  };
}

// ==========================================
// Audit Service Responses
// ==========================================

/**
 * Audit finding interface for responses
 */
export interface AuditFinding {
  id: string;
  findingNumber: string;
  auditId: string;
  controlId: string;
  controlCode: string;
  controlName: string;
  findingType: FindingType;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  condition: string;
  criteria: string;
  cause: string;
  effect: string;
  recommendation: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedTrustServiceCriteria: string[];
  businessImpact?: string;
  isSystematic: boolean;
  isPervasive: boolean;
  isCompensatingControlsExist: boolean;
  managementResponse?: string;
  managementResponseBy?: string;
  managementResponseDate?: Date;
  targetRemediationDate?: Date;
  remediationOwner?: string;
  remediationPlan?: string;
  evidenceIds: string[];
  testingProcedures?: string;
  testingDate?: Date;
  testedBy?: string;
  sampleSize: number;
  exceptionsFound: number;
  remediationStartDate?: Date;
  remediationCompleteDate?: Date;
  remediationEvidence?: string;
  remediationValidatedBy?: string;
  remediationValidationDate?: Date;
  requiresRetest: boolean;
  retestDate?: Date;
  retestResults?: string;
  relatedFindingIds: string[];
  rootCauseFindingId?: string;
  isPriorYearFinding: boolean;
  priorYearFindingId?: string;
  isRecurring: boolean;
  occurrenceCount: number;
  includeInReport: boolean;
  reportNarrative?: string;
  reportSection?: string;
  reportOrder: number;
  assignedTo?: string;
  reviewedBy?: string;
  reviewDate?: Date;
  approvedBy?: string;
  approvalDate?: Date;
  communicatedToClient: boolean;
  clientCommunicationDate?: Date;
  clientFeedback?: string;
  customFields?: Record<string, any>;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/**
 * Paginated response for audit findings
 */
export interface PaginatedFindingsResponse extends BaseServiceData {
  items: AuditFinding[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Audit findings summary for reporting
 */
export interface AuditFindingsSummaryResponse extends BaseServiceData {
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  totalFindings: number;
  openFindings: number;
  resolvedFindings: number;
  recommendations: Array<{
    id: string;
    title: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    description: string;
    estimatedEffort?: string;
    implementationDate?: Date;
  }>;
  severityDistribution: Array<{
    severity: FindingSeverity;
    count: number;
    percentage: number;
  }>;
  statusDistribution: Array<{
    status: FindingStatus;
    count: number;
    percentage: number;
  }>;
}

/**
 * Audit metrics response
 */
export interface AuditMetricsResponse extends BaseServiceData {
  metrics: Array<{
    name: string;
    value: number;
    unit?: string;
    description?: string;
    category: 'findings' | 'resolution' | 'compliance' | 'effort';
    timestamp: Date;
  }>;
  summary: {
    totalAudits: number;
    activeAudits: number;
    completedAudits: number;
    averageResolutionTime: number; // in days
    findingsResolutionRate: number; // percentage
  };
}

// ==========================================
// Evidence Service Responses
// ==========================================

/**
 * Paginated response for evidence
 */
export interface PaginatedEvidenceResponse extends BaseServiceData {
  items: Evidence[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Evidence count response
 */
export interface EvidenceCountResponse extends BaseServiceData {
  count: number;
  breakdown?: {
    byType: Array<{
      type: EvidenceType;
      count: number;
    }>;
    byControl: Array<{
      controlId: string;
      controlCode: string;
      count: number;
    }>;
    verified: number;
    unverified: number;
    automated: number;
    manual: number;
  };
}

/**
 * Evidence metrics response
 */
export interface EvidenceMetricsResponse extends BaseServiceData {
  metrics: Array<{
    name: string;
    value: number;
    unit?: string;
    description?: string;
    category: 'collection' | 'verification' | 'coverage' | 'quality';
    timestamp: Date;
  }>;
  summary: {
    totalEvidence: number;
    verifiedEvidence: number;
    automatedEvidence: number;
    coveragePercentage: number;
    averageVerificationTime: number; // in days
  };
}

// ==========================================
// Policy Service Responses
// ==========================================

/**
 * Policy compliance response with overall score
 */
export interface PolicyComplianceResponse extends BaseServiceData {
  overallScore: number;
  totalPolicies: number;
  approvedPolicies: number;
  publishedPolicies: number;
  pendingReviewPolicies: number;
  expiredPolicies: number;
  complianceBreakdown: Array<{
    category: string;
    score: number;
    policiesCount: number;
    approvedCount: number;
  }>;
  recentChanges: Array<{
    policyId: string;
    policyTitle: string;
    changeType: 'CREATED' | 'UPDATED' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
    changeDate: Date;
    changedBy: string;
  }>;
}

/**
 * Policy metrics response
 */
export interface PolicyMetricsResponse extends BaseServiceData {
  metrics: Array<{
    name: string;
    value: number;
    unit?: string;
    description?: string;
    category: 'coverage' | 'compliance' | 'approval' | 'maintenance';
    timestamp: Date;
  }>;
  summary: {
    totalPolicies: number;
    publishedPolicies: number;
    complianceScore: number;
    averageApprovalTime: number; // in days
    upcomingReviews: number;
  };
}

// ==========================================
// Cross-Service Metrics & Reporting
// ==========================================

/**
 * Generic metric interface
 */
export interface Metric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  description?: string;
  category: string;
  source: string; // service that generated the metric
  metadata?: Record<string, any>;
  timestamp: Date;
  tags?: string[];
}

/**
 * Comprehensive metrics response for reporting
 */
export interface MetricsResponse extends BaseServiceData {
  metrics: Metric[];
  aggregations?: {
    byCategory: Array<{
      category: string;
      count: number;
      averageValue: number;
      totalValue: number;
    }>;
    bySource: Array<{
      source: string;
      count: number;
      lastUpdated: Date;
    }>;
    byTimeframe: Array<{
      period: string; // e.g., '2024-01', 'Q1-2024'
      count: number;
      averageValue: number;
    }>;
  };
  summary: {
    totalMetrics: number;
    dataPointsCount: number;
    lastUpdated: Date;
    coverageScore: number;
  };
}

// ==========================================
// Dashboard & Analytics Responses
// ==========================================

/**
 * Comprehensive dashboard response combining multiple service data
 */
export interface DashboardResponse extends BaseServiceData {
  organization: OrganizationResponse;
  summary: {
    overallScore: number;
    complianceStatus: ComplianceStatus;
    lastAssessmentDate?: Date;
    nextAuditDate?: Date;
    riskLevel: RiskLevel;
  };
  controls: {
    total: number;
    implemented: number;
    effective: number;
    complianceScore: number;
  };
  findings: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
  };
  evidence: {
    total: number;
    verified: number;
    coveragePercentage: number;
  };
  policies: {
    total: number;
    approved: number;
    published: number;
    complianceScore: number;
  };
  trends: Array<{
    metric: string;
    current: number;
    previous: number;
    change: number;
    changeType: 'IMPROVEMENT' | 'REGRESSION' | 'STABLE';
  }>;
}

/**
 * Project progress response for audit tracking
 */
export interface ProjectProgressResponse extends BaseServiceData {
  project: Project;
  progress: {
    overallPercentage: number;
    controlsAssessed: number;
    controlsTotal: number;
    evidenceCollected: number;
    evidenceRequired: number;
    findingsResolved: number;
    findingsTotal: number;
  };
  milestones: Array<{
    id: string;
    name: string;
    targetDate: Date;
    completedDate?: Date;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
    progress: number;
  }>;
  risksAndIssues: Array<{
    id: string;
    type: 'RISK' | 'ISSUE';
    title: string;
    severity: RiskLevel;
    status: 'OPEN' | 'RESOLVED' | 'MITIGATED';
    assignedTo?: string;
  }>;
}

// ==========================================
// User & Permission Responses
// ==========================================

/**
 * User profile response with permissions
 */
export interface UserProfileResponse extends BaseServiceData {
  user: User;
  permissions: string[];
  organizationAccess: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    permissions: string[];
  }>;
  preferences: {
    timezone?: string;
    language?: string;
    notifications?: {
      email: boolean;
      dashboard: boolean;
      findings: boolean;
      reports: boolean;
    };
  };
  lastActivity: {
    loginAt: Date;
    lastActionAt: Date;
    ipAddress?: string;
  };
}

// ==========================================
// Error Response Types
// ==========================================

/**
 * Standardized error response for all services
 */
export interface ErrorResponse extends BaseServiceData {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string; // for validation errors
    type: 'VALIDATION' | 'AUTHORIZATION' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL' | 'EXTERNAL';
  };
  requestId?: string;
  timestamp: Date;
}

/**
 * Validation error response with field-specific errors
 */
export interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_FAILED';
    message: string;
    type: 'VALIDATION';
    validationErrors: Array<{
      field: string;
      message: string;
      value?: any;
      constraint?: string;
    }>;
  };
}
