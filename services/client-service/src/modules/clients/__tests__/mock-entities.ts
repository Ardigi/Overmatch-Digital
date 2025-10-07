// Mock entities for testing - avoids TypeORM imports
// These match the actual entity enums but don't require TypeORM

export enum ClientType {
  DIRECT = 'direct',
  PARTNER_REFERRAL = 'partner_referral',
  MANAGED = 'managed',
}

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export enum CompanySize {
  STARTUP = '1-50',
  SMALL = '51-200',
  MEDIUM = '201-500',
  LARGE = '501-1000',
  ENTERPRISE = '1000+',
}

export enum Industry {
  TECHNOLOGY = 'technology',
  HEALTHCARE = 'healthcare',
  FINANCE = 'finance',
  RETAIL = 'retail',
  MANUFACTURING = 'manufacturing',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
  NONPROFIT = 'nonprofit',
  OTHER = 'other',
}

export enum ComplianceStatus {
  NOT_STARTED = 'not_started',
  ASSESSMENT = 'assessment',
  REMEDIATION = 'remediation',
  IMPLEMENTATION = 'implementation',
  READY_FOR_AUDIT = 'ready_for_audit',
  UNDER_AUDIT = 'under_audit',
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  EXPIRED = 'expired',
}

export enum ComplianceFramework {
  SOC1_TYPE1 = 'soc1_type1',
  SOC1_TYPE2 = 'soc1_type2',
  SOC2_TYPE1 = 'soc2_type1',
  SOC2_TYPE2 = 'soc2_type2',
  ISO27001 = 'iso27001',
  HIPAA = 'hipaa',
  GDPR = 'gdpr',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  FEDRAMP = 'fedramp',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Mock entity classes for testing
export class Client {
  id: string;
  name: string;
  legalName?: string;
  slug: string;
  clientType: ClientType;
  organizationId: string;
  parentClientId?: string;
  parentClient?: Client;
  subsidiaries?: Client[];
  logo?: string;
  website?: string;
  description?: string;
  industry?: Industry;
  size?: CompanySize;
  employeeCount?: number;
  annualRevenue?: string;
  status: ClientStatus;
  complianceStatus: ComplianceStatus;
  targetFrameworks: ComplianceFramework[];
  riskLevel?: RiskLevel;
  complianceScore?: number;
  contactInfo?: any;
  address?: any;
  billingInfo?: any;
  partnerId?: string;
  salesRepId?: string;
  accountManagerId?: string;
  technicalLeadId?: string;
  onboardingStartDate?: Date;
  onboardingCompleteDate?: Date;
  firstAuditDate?: Date;
  lastAuditDate?: Date;
  nextAuditDate?: Date;
  certificateExpiryDate?: Date;
  settings?: any;
  metadata?: Record<string, any>;
  tags?: string[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  users?: ClientUser[];
  documents?: ClientDocument[];
  audits?: ClientAudit[];
  contracts?: any[];
  integrations?: any;
}

export class ClientUser {
  id: string;
  clientId: string;
  client: Client;
  userId: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastAccessAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ClientDocument {
  id: string;
  clientId: string;
  client: Client;
  name: string;
  type: string;
  category: string;
  description?: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  version: number;
  isActive: boolean;
  expiryDate?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ClientAudit {
  id: string;
  clientId: string;
  client: Client;
  auditType: string;
  framework: ComplianceFramework;
  status: string;
  scheduledDate: Date;
  startDate?: Date;
  endDate?: Date;
  auditorName?: string;
  auditorCompany?: string;
  findings?: any;
  score?: number;
  reportUrl?: string;
  certificateUrl?: string;
  certificateExpiryDate?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
