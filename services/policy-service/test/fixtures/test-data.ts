import {
  PolicyPriority,
  PolicyScope,
  PolicyStatus,
  PolicyType,
} from '../../src/modules/policies/entities/policy.entity';

// Test fixtures aligned with SOC2 and ISO27001 compliance requirements
export const TEST_POLICIES = {
  // SOC2 Policies
  SOC2_SECURITY: {
    id: 'policy-soc2-sec-001',
    policyNumber: 'SOC2-SEC-001',
    title: 'Information Security Policy',
    description: 'Comprehensive security policy for SOC2 Type II compliance',
    type: PolicyType.SECURITY,
    status: PolicyStatus.PUBLISHED,
    priority: PolicyPriority.HIGH,
    scope: PolicyScope.ORGANIZATION,
    version: '2.0',
    content: {
      sections: [
        {
          id: 'purpose',
          title: 'Purpose',
          content:
            'This policy establishes the security requirements for protecting customer data in accordance with SOC2 Trust Service Criteria.',
        },
        {
          id: 'scope',
          title: 'Scope',
          content:
            'This policy applies to all employees, contractors, and third parties who have access to company information systems.',
        },
        {
          id: 'controls',
          title: 'Security Controls',
          content:
            'Implementation of CC6.1 (Logical and Physical Access Controls), CC6.2 (System Boundaries), CC6.3 (Network Security)',
        },
      ],
    },
    effectiveDate: new Date('2024-01-01'),
    expirationDate: new Date('2025-01-01'),
    nextReviewDate: new Date('2024-07-01'),
    tags: ['soc2', 'security', 'compliance', 'trust-services'],
    ownerId: 'user-security-officer',
    organizationId: 'org-123',
    approvedBy: 'user-ciso',
    approvedAt: new Date('2023-12-15'),
    publishedAt: new Date('2024-01-01'),
    metadata: {
      complianceFrameworks: ['SOC2'],
      controls: ['CC6.1', 'CC6.2', 'CC6.3'],
      riskLevel: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
    },
  },

  SOC2_ACCESS_CONTROL: {
    id: 'policy-soc2-acc-001',
    policyNumber: 'SOC2-ACC-001',
    title: 'Access Control Policy',
    description: 'Access control policy for SOC2 compliance',
    type: PolicyType.ACCESS_CONTROL,
    status: PolicyStatus.PUBLISHED,
    priority: PolicyPriority.HIGH,
    scope: PolicyScope.ORGANIZATION,
    version: '1.5',
    content: {
      sections: [
        {
          id: 'authentication',
          title: 'Authentication Requirements',
          content: 'Multi-factor authentication required for all privileged accounts',
        },
        {
          id: 'authorization',
          title: 'Authorization Matrix',
          content: 'Role-based access control with principle of least privilege',
        },
        {
          id: 'review',
          title: 'Access Reviews',
          content: 'Quarterly access reviews for all critical systems',
        },
      ],
    },
    effectiveDate: new Date('2024-01-01'),
    expirationDate: new Date('2025-01-01'),
    nextReviewDate: new Date('2024-04-01'),
    tags: ['soc2', 'access-control', 'authentication', 'authorization'],
    ownerId: 'user-security-officer',
    organizationId: 'org-123',
  },

  // ISO 27001 Policies
  ISO_INFORMATION_SECURITY: {
    id: 'policy-iso-sec-001',
    policyNumber: 'ISO-SEC-001',
    title: 'ISO 27001 Information Security Policy',
    description: 'ISMS policy for ISO 27001 certification',
    type: PolicyType.SECURITY,
    status: PolicyStatus.PUBLISHED,
    priority: PolicyPriority.CRITICAL,
    scope: PolicyScope.GLOBAL,
    version: '3.0',
    content: {
      sections: [
        {
          id: 'isms',
          title: 'Information Security Management System',
          content: 'Establishment and maintenance of ISMS in accordance with ISO 27001:2022',
        },
        {
          id: 'risk',
          title: 'Risk Management',
          content: 'Risk assessment and treatment procedures per ISO 27001 Annex A',
        },
        {
          id: 'controls',
          title: 'Security Controls',
          content: 'Implementation of all 93 controls from ISO 27001 Annex A',
        },
      ],
    },
    effectiveDate: new Date('2024-01-01'),
    expirationDate: new Date('2025-01-01'),
    nextReviewDate: new Date('2024-06-01'),
    tags: ['iso27001', 'isms', 'security', 'certification'],
    ownerId: 'user-ciso',
    organizationId: 'org-123',
  },

  // Draft and Under Review Policies
  DRAFT_DATA_RETENTION: {
    id: 'policy-draft-ret-001',
    policyNumber: 'DRAFT-RET-001',
    title: 'Data Retention Policy',
    description: 'Policy for data retention and disposal',
    type: PolicyType.DATA_GOVERNANCE,
    status: PolicyStatus.DRAFT,
    priority: PolicyPriority.MEDIUM,
    scope: PolicyScope.DEPARTMENT,
    version: '0.1',
    content: {
      sections: [
        {
          id: 'retention',
          title: 'Retention Periods',
          content: 'Customer data: 7 years, Log data: 1 year, Temporary data: 30 days',
        },
      ],
    },
    effectiveDate: new Date('2024-06-01'),
    expirationDate: new Date('2025-06-01'),
    tags: ['data', 'retention', 'gdpr', 'privacy'],
    ownerId: 'user-dpo',
    organizationId: 'org-123',
  },

  UNDER_REVIEW_INCIDENT: {
    id: 'policy-review-inc-001',
    policyNumber: 'REV-INC-001',
    title: 'Incident Response Policy',
    description: 'Policy for incident response and management',
    type: PolicyType.OPERATIONAL,
    status: PolicyStatus.UNDER_REVIEW,
    priority: PolicyPriority.HIGH,
    scope: PolicyScope.ORGANIZATION,
    version: '1.0',
    content: {
      sections: [
        {
          id: 'response',
          title: 'Incident Response Procedures',
          content: 'Detailed steps for incident detection, containment, eradication, and recovery',
        },
      ],
    },
    effectiveDate: new Date('2024-03-01'),
    expirationDate: new Date('2025-03-01'),
    tags: ['incident', 'response', 'security', 'bcdr'],
    ownerId: 'user-security-officer',
    organizationId: 'org-123',
  },
};

// Test frameworks aligned with compliance standards
export const TEST_FRAMEWORKS = {
  SOC2: {
    id: 'framework-soc2',
    name: 'SOC 2 Type II',
    version: '2017',
    description: 'Service Organization Control 2 - Trust Service Criteria',
    isActive: true,
    controls: [
      {
        id: 'CC6.1',
        name: 'Logical and Physical Access Controls',
        description: 'The entity implements logical access security measures',
        category: 'Common Criteria',
        requirement: 'REQUIRED',
      },
      {
        id: 'CC6.2',
        name: 'Prior to Issuing System Credentials',
        description: 'Prior to issuing system credentials and granting access',
        category: 'Common Criteria',
        requirement: 'REQUIRED',
      },
      {
        id: 'CC6.3',
        name: 'Removal of Access',
        description: 'The entity removes access to protected information',
        category: 'Common Criteria',
        requirement: 'REQUIRED',
      },
    ],
    metadata: {
      certificationBody: 'AICPA',
      complianceType: 'ATTESTATION',
      auditFrequency: 'ANNUAL',
    },
  },

  ISO27001: {
    id: 'framework-iso27001',
    name: 'ISO/IEC 27001:2022',
    version: '2022',
    description: 'Information Security Management System',
    isActive: true,
    controls: [
      {
        id: 'A.9.1.1',
        name: 'Access control policy',
        description: 'An access control policy should be established',
        category: 'Access Control',
        requirement: 'REQUIRED',
      },
      {
        id: 'A.9.1.2',
        name: 'Access to networks and network services',
        description: 'Users should only be provided with access to networks',
        category: 'Access Control',
        requirement: 'REQUIRED',
      },
      {
        id: 'A.9.2.1',
        name: 'User registration and de-registration',
        description: 'A formal user registration and de-registration process',
        category: 'Access Control',
        requirement: 'REQUIRED',
      },
    ],
    metadata: {
      certificationBody: 'ISO',
      complianceType: 'CERTIFICATION',
      auditFrequency: 'ANNUAL',
    },
  },

  HIPAA: {
    id: 'framework-hipaa',
    name: 'HIPAA Security Rule',
    version: '2013',
    description: 'Health Insurance Portability and Accountability Act',
    isActive: true,
    controls: [
      {
        id: '164.308(a)(1)',
        name: 'Security Management Process',
        description: 'Implement policies and procedures to prevent violations',
        category: 'Administrative Safeguards',
        requirement: 'REQUIRED',
      },
    ],
    metadata: {
      certificationBody: 'HHS',
      complianceType: 'REGULATORY',
      auditFrequency: 'CONTINUOUS',
    },
  },
};

// Test compliance mappings
export const TEST_COMPLIANCE_MAPPINGS = {
  SOC2_TO_ISO: {
    id: 'mapping-soc2-iso-001',
    sourceFramework: 'SOC2',
    targetFramework: 'ISO27001',
    mappings: [
      {
        sourceControl: 'CC6.1',
        targetControl: 'A.9.1.1',
        mappingType: 'EQUIVALENT',
        coverage: 100,
        notes: 'Both controls address logical access controls',
      },
      {
        sourceControl: 'CC6.2',
        targetControl: 'A.9.2.1',
        mappingType: 'PARTIAL',
        coverage: 80,
        notes: 'SOC2 control is more specific about credential issuance',
      },
    ],
  },
};

// Test OPA policies for policy engine
export const TEST_OPA_POLICIES = {
  ALLOW_READ: `
    package policy.access

    default allow = false

    allow {
      input.action == "read"
      input.user.roles[_] == "viewer"
    }

    allow {
      input.action == "read"
      input.user.roles[_] == "admin"
    }
  `,

  ENFORCE_MFA: `
    package policy.security

    default require_mfa = false

    require_mfa {
      input.resource.sensitivity == "high"
    }

    require_mfa {
      input.user.roles[_] == "admin"
    }
  `,

  DATA_CLASSIFICATION: `
    package policy.data

    classification[level] {
      input.data.contains_pii
      level := "confidential"
    }

    classification[level] {
      input.data.public
      level := "public"
    }

    classification[level] {
      not input.data.contains_pii
      not input.data.public
      level := "internal"
    }
  `,
};

// Test audit entries
export const TEST_AUDIT_ENTRIES = {
  POLICY_CREATED: {
    id: 'audit-001',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    userId: 'user-policy-manager',
    action: 'POLICY_CREATED',
    resource: 'policy',
    resourceId: 'policy-soc2-sec-001',
    outcome: 'SUCCESS',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    details: {
      policyTitle: 'Information Security Policy',
      policyType: 'SECURITY',
    },
  },

  POLICY_APPROVED: {
    id: 'audit-002',
    timestamp: new Date('2024-01-15T14:45:00Z'),
    userId: 'user-ciso',
    action: 'POLICY_APPROVED',
    resource: 'policy',
    resourceId: 'policy-soc2-sec-001',
    outcome: 'SUCCESS',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0',
    details: {
      approvalNotes: 'Approved for SOC2 compliance',
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'APPROVED',
    },
  },

  UNAUTHORIZED_ACCESS: {
    id: 'audit-003',
    timestamp: new Date('2024-01-16T09:15:00Z'),
    userId: 'user-viewer',
    action: 'POLICY_DELETE_ATTEMPTED',
    resource: 'policy',
    resourceId: 'policy-soc2-sec-001',
    outcome: 'FAILURE',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0',
    details: {
      reason: 'Insufficient permissions',
      requiredRole: 'ADMIN',
      userRoles: ['VIEWER'],
    },
  },
};

// Test exceptions for policies
export const TEST_POLICY_EXCEPTIONS = {
  TEMPORARY_EXCEPTION: {
    id: 'exception-001',
    policyId: 'policy-soc2-sec-001',
    reason: 'Legacy system migration in progress',
    approvedBy: 'user-ciso',
    approvedAt: new Date('2024-01-20'),
    expiresAt: new Date('2024-04-20'),
    scope: {
      systems: ['legacy-app-01'],
      controls: ['CC6.1'],
    },
    compensatingControls: ['Manual access reviews conducted weekly', 'Enhanced monitoring enabled'],
    status: 'ACTIVE',
  },

  EXPIRED_EXCEPTION: {
    id: 'exception-002',
    policyId: 'policy-soc2-acc-001',
    reason: 'COVID-19 remote work exception',
    approvedBy: 'user-ciso',
    approvedAt: new Date('2023-01-01'),
    expiresAt: new Date('2023-12-31'),
    scope: {
      users: ['remote-workers'],
      controls: ['CC6.2'],
    },
    status: 'EXPIRED',
  },
};

// Test performance scenarios
export const TEST_PERFORMANCE_SCENARIOS = {
  BULK_POLICIES: Array.from({ length: 1000 }, (_, i) => ({
    id: `perf-policy-${i}`,
    policyNumber: `PERF-${String(i).padStart(5, '0')}`,
    title: `Performance Test Policy ${i}`,
    type: PolicyType.OPERATIONAL,
    status: PolicyStatus.PUBLISHED,
    priority: PolicyPriority.MEDIUM,
    scope: PolicyScope.DEPARTMENT,
    content: { sections: [] },
    tags: [`perf-${i % 10}`],
    organizationId: 'org-123',
  })),

  COMPLEX_SEARCH_QUERIES: [
    {
      query: 'security AND (soc2 OR iso27001) AND status:published',
      expectedResultCount: 2,
    },
    {
      query: 'type:security priority:high -status:draft',
      expectedResultCount: 3,
    },
    {
      query: 'tags:compliance effectiveDate:[2024-01-01 TO 2024-12-31]',
      expectedResultCount: 4,
    },
  ],
};
