/**
 * Example: Using the Policy Engine for Access Control
 */
export const AccessControlExample = {
  // Policy code
  policy: `policy "admin-mfa-requirement" {
    description = "Require MFA for admin users accessing sensitive resources"
    
    condition = user.role == "admin" && resource.classification == "sensitive" && !user.mfaVerified
    
    action {
      type = "deny"
      message = "MFA verification required for admin access to sensitive resources"
    }
    
    action {
      type = "require"
      target = "mfa-verification"
      parameters = {
        timeout = 300
        methods = ["totp", "sms", "biometric"]
      }
    }
  }`,

  // Context for evaluation
  context: {
    subject: {
      id: 'user-123',
      type: 'user',
      attributes: {
        role: 'admin',
        department: 'IT',
        clearanceLevel: 'high',
        mfaEnabled: true,
        mfaVerified: false,
      },
    },
    resource: {
      id: 'resource-456',
      type: 'database',
      attributes: {
        name: 'customer-data',
        classification: 'sensitive',
        environment: 'production',
        encryptionEnabled: true,
      },
    },
    action: 'read',
    environment: {
      timestamp: new Date(),
      ip: '192.168.1.100',
      location: 'office',
      deviceType: 'desktop',
    },
  },

  // Expected result
  expectedResult: {
    allowed: false,
    ruleSatisfied: true,
    actions: [
      {
        type: 'deny',
        message: 'MFA verification required for admin access to sensitive resources',
      },
      {
        type: 'require',
        target: 'mfa-verification',
        parameters: {
          timeout: 300,
          methods: ['totp', 'sms', 'biometric'],
        },
      },
    ],
  },
};

/**
 * Example: Using the Policy Engine for Data Protection
 */
export const DataProtectionExample = {
  policy: `policy "encryption-enforcement" {
    description = "Enforce encryption for PII data storage"
    
    condition = resource.type == "storage" && contains(resource.dataTypes, "PII") && !resource.encryptionEnabled
    
    action {
      type = "deny"
      message = "Encryption must be enabled for storage containing PII"
    }
    
    action {
      type = "remediate"
      target = "enable-encryption"
      parameters = {
        encryptionType = "AES-256"
        keyRotation = true
        keyRotationPeriod = 90
      }
    }
    
    action {
      type = "notify"
      target = "security-team"
      parameters = {
        severity = "high"
        channel = "slack"
      }
    }
  }`,

  context: {
    subject: {
      id: 'service-account-789',
      type: 'service',
      attributes: {
        name: 'data-processor',
        owner: 'data-team',
      },
    },
    resource: {
      id: 's3-bucket-001',
      type: 'storage',
      attributes: {
        provider: 'aws',
        region: 'us-east-1',
        dataTypes: ['PII', 'financial'],
        encryptionEnabled: false,
        publicAccess: false,
      },
    },
    action: 'create',
    environment: {
      timestamp: new Date(),
      deploymentType: 'automated',
    },
  },
};

/**
 * Example: Using the Policy Engine for Change Management
 */
export const ChangeManagementExample = {
  policy: `policy "production-change-approval" {
    description = "Require approval for production changes during business hours"
    
    condition = resource.environment == "production" && 
                action == "deploy" && 
                env.hour >= 9 && env.hour <= 17 &&
                (!data.approvals || data.approvals.length < 2)
    
    action {
      type = "require"
      target = "approval"
      parameters = {
        minApprovers = 2
        approverRoles = ["tech-lead", "devops-manager"]
        timeout = 3600
      }
      message = "Production deployments during business hours require 2 approvals"
    }
  }`,

  context: {
    subject: {
      id: 'developer-234',
      type: 'user',
      attributes: {
        role: 'developer',
        team: 'backend',
        experienceLevel: 'senior',
      },
    },
    resource: {
      id: 'app-backend-api',
      type: 'application',
      attributes: {
        name: 'backend-api',
        environment: 'production',
        criticality: 'high',
        lastDeployment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    action: 'deploy',
    environment: {
      timestamp: new Date(),
      hour: 14, // 2 PM
      dayOfWeek: 3, // Wednesday
    },
    data: {
      changeTicket: 'CHG-12345',
      version: '2.3.1',
      approvals: [
        {
          approver: 'tech-lead-567',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          comment: 'Reviewed and approved',
        },
      ],
    },
  },
};

/**
 * Example: Policy Set for Comprehensive Security
 */
export const SecurityPolicySetExample = {
  policySet: {
    id: 'comprehensive-security',
    name: 'Comprehensive Security Policy Set',
    description: 'Multiple security policies evaluated together',
    version: '1.0.0',
    combiningAlgorithm: 'all' as const,
    enabled: true,
    rules: [
      {
        id: 'ip-restriction',
        name: 'IP Restriction',
        description: 'Restrict access from unauthorized IPs',
        condition: '!contains(env.allowedIps, env.ip)',
        actions: [
          {
            type: 'deny' as const,
            message: 'Access denied from unauthorized IP',
          },
        ],
      },
      {
        id: 'time-restriction',
        name: 'Time-based Access',
        description: 'Restrict access outside business hours',
        condition: 'env.hour < 6 || env.hour > 22',
        actions: [
          {
            type: 'deny' as const,
            message: 'Access restricted outside business hours',
          },
        ],
      },
      {
        id: 'mfa-requirement',
        name: 'MFA Requirement',
        description: 'Require MFA for sensitive operations',
        condition: 'action == "delete" && !user.mfaVerified',
        actions: [
          {
            type: 'require' as const,
            target: 'mfa',
            message: 'MFA required for delete operations',
          },
        ],
      },
    ],
  },

  context: {
    subject: {
      id: 'user-999',
      type: 'user',
      attributes: {
        role: 'analyst',
        mfaEnabled: true,
        mfaVerified: false,
      },
    },
    resource: {
      id: 'report-123',
      type: 'document',
      attributes: {
        classification: 'internal',
      },
    },
    action: 'delete',
    environment: {
      timestamp: new Date(),
      ip: '10.0.0.50',
      allowedIps: ['10.0.0.0/24', '192.168.1.0/24'],
      hour: 10,
    },
  },
};
