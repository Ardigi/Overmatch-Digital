// Common Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    version: string;
  };
}

// User & Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId?: string;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AUDITOR = 'AUDITOR',
  CPA_PARTNER = 'CPA_PARTNER',
  CLIENT_ADMIN = 'CLIENT_ADMIN',
  CLIENT_USER = 'CLIENT_USER',
  VIEWER = 'VIEWER',
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
}

// Client/Organization
export interface Client {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: CompanySize;
  status: ClientStatus;
  complianceStatus: ComplianceStatus;
  contactInfo: ContactInfo;
  billingInfo?: BillingInfo;
  cpaPartnerId?: string;
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum CompanySize {
  SMALL = 'small_1_50',
  MEDIUM = 'medium_51_200',
  LARGE = 'large_201_500',
  ENTERPRISE = 'enterprise_501_1000',
  ENTERPRISE_PLUS = 'enterprise_plus_1000',
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
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

export interface ContactInfo {
  primaryEmail: string;
  primaryPhone?: string;
  address?: Address;
}

export interface BillingInfo {
  billingEmail?: string;
  billingAddress?: Address;
  taxId?: string;
  paymentMethod?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Audit & Projects
export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  type: ProjectType;
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

export enum ProjectType {
  SOC1_TYPE1 = 'SOC1_TYPE1',
  SOC1_TYPE2 = 'SOC1_TYPE2',
  SOC2_TYPE1 = 'SOC2_TYPE1',
  SOC2_TYPE2 = 'SOC2_TYPE2',
  READINESS_ASSESSMENT = 'READINESS_ASSESSMENT',
  GAP_REMEDIATION = 'GAP_REMEDIATION',
  PENETRATION_TEST = 'PENETRATION_TEST',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

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

// Controls
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

// Evidence
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

export enum EvidenceType {
  SCREENSHOT = 'SCREENSHOT',
  DOCUMENT = 'DOCUMENT',
  LOG_FILE = 'LOG_FILE',
  CONFIGURATION = 'CONFIGURATION',
  REPORT = 'REPORT',
  ATTESTATION = 'ATTESTATION',
  OTHER = 'OTHER',
}

// Policies
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

export enum PolicyStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

// Risks
export interface Risk {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  inherentRisk: RiskLevel;
  residualRisk?: RiskLevel;
  mitigationPlan?: string;
  owner?: string;
  reviewDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum RiskLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

// Service Response Types
export * from './service-responses';
