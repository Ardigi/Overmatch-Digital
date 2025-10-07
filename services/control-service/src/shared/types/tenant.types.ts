/**
 * Enterprise-grade multi-tenancy types for billion-dollar platform
 * Implements row-level security and complete tenant isolation
 */

export interface TenantContext {
  tenantId: string;
  organizationId: string;
  dataResidency: DataResidencyRegion;
  encryptionKeyId: string;
  isolationLevel: TenantIsolationLevel;
  complianceProfiles: ComplianceProfile[];
  dataClassification: DataClassificationLevel;
  auditLevel: AuditLevel;
  createdAt: Date;
  lastAccessedAt: Date;
}

export enum DataResidencyRegion {
  US_EAST = 'US_EAST',
  US_WEST = 'US_WEST',
  EU_WEST = 'EU_WEST',
  EU_CENTRAL = 'EU_CENTRAL',
  APAC_SYDNEY = 'APAC_SYDNEY',
  APAC_TOKYO = 'APAC_TOKYO',
  CANADA = 'CANADA',
  UK = 'UK',
  SWITZERLAND = 'SWITZERLAND', // For banking compliance
}

export enum TenantIsolationLevel {
  SHARED = 'SHARED', // Shared database, row-level security
  SCHEMA = 'SCHEMA', // Separate schema per tenant
  DATABASE = 'DATABASE', // Separate database per tenant
  CLUSTER = 'CLUSTER', // Dedicated cluster for enterprise
}

export enum ComplianceProfile {
  SOC2_TYPE2 = 'SOC2_TYPE2',
  ISO27001 = 'ISO27001',
  HIPAA = 'HIPAA',
  PCI_DSS_LEVEL1 = 'PCI_DSS_LEVEL1',
  GDPR = 'GDPR',
  CCPA = 'CCPA',
  FEDRAMP_HIGH = 'FEDRAMP_HIGH',
  FINRA = 'FINRA',
  BASEL_III = 'BASEL_III',
  NIST_800_53 = 'NIST_800_53',
}

export enum DataClassificationLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
  TOP_SECRET = 'TOP_SECRET', // Government contracts
}

export enum AuditLevel {
  BASIC = 'BASIC', // Standard logging
  ENHANCED = 'ENHANCED', // Detailed logging with metadata
  FORENSIC = 'FORENSIC', // Complete forensic trail
  IMMUTABLE = 'IMMUTABLE', // Blockchain-backed immutable logs
}

export interface TenantQuota {
  maxUsers: number;
  maxControls: number;
  maxDataRetentionDays: number;
  maxApiCallsPerMinute: number;
  maxStorageGB: number;
  maxConcurrentSessions: number;
  customControlsAllowed: boolean;
  advancedAnalyticsEnabled: boolean;
  mlPredictionsEnabled: boolean;
}

export interface TenantSecurity {
  mfaRequired: boolean;
  minPasswordLength: number;
  passwordComplexityRules: PasswordComplexityRule[];
  sessionTimeoutMinutes: number;
  ipWhitelist: string[];
  allowedDomains: string[];
  ssoProvider?: SSOProvider;
  encryptionAlgorithm: EncryptionAlgorithm;
  keyRotationDays: number;
}

export interface PasswordComplexityRule {
  rule: 'UPPERCASE' | 'LOWERCASE' | 'NUMBER' | 'SPECIAL' | 'NO_COMMON' | 'NO_DICTIONARY';
  required: boolean;
  minCount?: number;
}

export interface SSOProvider {
  type: 'SAML' | 'OIDC' | 'OAUTH2' | 'LDAP' | 'ACTIVE_DIRECTORY';
  issuer: string;
  metadataUrl?: string;
  clientId?: string;
  attributeMapping: Record<string, string>;
}

export enum EncryptionAlgorithm {
  AES_256_GCM = 'AES_256_GCM',
  AES_256_CBC = 'AES_256_CBC',
  RSA_4096 = 'RSA_4096',
  CHACHA20_POLY1305 = 'CHACHA20_POLY1305',
}

export interface TenantAccessLog {
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
  reason?: string;
  dataAccessed?: string[];
  performanceMs: number;
}

export interface CrossTenantAccessRequest {
  requestId: string;
  sourceTenantId: string;
  targetTenantId: string;
  requestedBy: string;
  reason: string;
  resources: string[];
  expiresAt: Date;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  approvedBy?: string;
  deniedBy?: string;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  details: Record<string, any>;
  hash?: string; // For immutable audit trail
  previousHash?: string; // For blockchain-style chaining
}