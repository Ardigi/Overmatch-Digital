export const PolicyTemplates = {
  // Access Control Templates
  'require-mfa': {
    name: 'Require Multi-Factor Authentication',
    description: 'Require MFA for specified user roles or actions',
    code: `policy "require-mfa" {
  description = "Require MFA for sensitive operations"
  
  condition = user.role == "admin" && !user.mfaEnabled
  
  action {
    type = "require"
    target = "mfa"
    message = "Multi-factor authentication is required for this action"
  }
}`,
    category: 'Access Control',
    frameworks: ['SOC2', 'ISO27001'],
  },

  'ip-restriction': {
    name: 'IP Address Restriction',
    description: 'Restrict access based on IP address ranges',
    code: `policy "ip-restriction" {
  description = "Restrict access to approved IP ranges"
  
  condition = !contains(env.allowedIpRanges, env.ip)
  
  action {
    type = "deny"
    message = "Access denied from unauthorized IP address"
  }
  
  action {
    type = "notify"
    target = "security-team"
    message = "Unauthorized access attempt detected"
  }
}`,
    category: 'Network Security',
    frameworks: ['SOC2', 'PCI-DSS'],
  },

  'time-based-access': {
    name: 'Time-Based Access Control',
    description: 'Restrict access based on time of day',
    code: `policy "time-based-access" {
  description = "Restrict access during non-business hours"
  
  condition = env.hour < 8 || env.hour > 18
  
  action {
    type = "deny"
    message = "Access restricted outside business hours"
  }
}`,
    category: 'Access Control',
    frameworks: ['SOC2'],
  },

  // Data Protection Templates
  'data-classification': {
    name: 'Data Classification Enforcement',
    description: 'Enforce access based on data classification',
    code: `policy "data-classification" {
  description = "Enforce data classification access controls"
  
  condition = resource.classification == "confidential" && !contains(user.clearanceLevels, "confidential")
  
  action {
    type = "deny"
    message = "Insufficient clearance level for confidential data"
  }
  
  action {
    type = "notify"
    target = "data-governance"
    parameters = {
      severity = "high"
      userId = user.id
      resourceId = resource.id
    }
  }
}`,
    category: 'Data Protection',
    frameworks: ['SOC2', 'ISO27001', 'GDPR'],
  },

  'encryption-required': {
    name: 'Encryption Requirements',
    description: 'Ensure data encryption in transit and at rest',
    code: `policy "encryption-required" {
  description = "Require encryption for sensitive data"
  
  condition = resource.type == "database" && !resource.encryptionEnabled
  
  action {
    type = "deny"
    message = "Encryption must be enabled for database resources"
  }
  
  action {
    type = "remediate"
    target = "enable-encryption"
    parameters = {
      encryptionType = "AES-256"
      scope = "at-rest"
    }
  }
}`,
    category: 'Data Protection',
    frameworks: ['SOC2', 'HIPAA', 'PCI-DSS'],
  },

  // Change Management Templates
  'change-approval': {
    name: 'Change Approval Requirements',
    description: 'Enforce change approval process',
    code: `policy "change-approval" {
  description = "Require approval for production changes"
  
  condition = resource.environment == "production" && action == "deploy" && !data.approvals
  
  action {
    type = "require"
    target = "approval"
    parameters = {
      minApprovers = 2
      approverRoles = ["change-manager", "tech-lead"]
    }
    message = "Production deployments require approval"
  }
}`,
    category: 'Change Management',
    frameworks: ['SOC2', 'ISO27001'],
  },

  'maintenance-window': {
    name: 'Maintenance Window Enforcement',
    description: 'Restrict changes outside maintenance windows',
    code: `policy "maintenance-window" {
  description = "Enforce maintenance window for production changes"
  
  condition = resource.environment == "production" && !env.inMaintenanceWindow
  
  action {
    type = "deny"
    message = "Production changes must be performed during maintenance windows"
  }
}`,
    category: 'Change Management',
    frameworks: ['SOC2'],
  },

  // Compliance Templates
  'password-policy': {
    name: 'Password Policy Enforcement',
    description: 'Enforce strong password requirements',
    code: `policy "password-policy" {
  description = "Enforce password complexity requirements"
  
  condition = action == "password-change" && (
    data.password.length < 14 ||
    !matches(data.password, "[A-Z]") ||
    !matches(data.password, "[a-z]") ||
    !matches(data.password, "[0-9]") ||
    !matches(data.password, "[^A-Za-z0-9]")
  )
  
  action {
    type = "deny"
    message = "Password must be at least 14 characters and contain uppercase, lowercase, numbers, and special characters"
  }
}`,
    category: 'Access Control',
    frameworks: ['SOC2', 'ISO27001', 'NIST'],
  },

  'audit-logging': {
    name: 'Audit Logging Requirements',
    description: 'Ensure audit logging for sensitive operations',
    code: `policy "audit-logging" {
  description = "Require audit logging for sensitive operations"
  
  condition = contains(["delete", "modify", "access"], action) && resource.sensitive && !env.auditingEnabled
  
  action {
    type = "require"
    target = "audit-log"
    parameters = {
      level = "detailed"
      retention = "90days"
    }
    message = "Audit logging required for sensitive operations"
  }
}`,
    category: 'Logging & Monitoring',
    frameworks: ['SOC2', 'HIPAA', 'PCI-DSS'],
  },

  // Risk Management Templates
  'risk-threshold': {
    name: 'Risk Threshold Enforcement',
    description: 'Block actions exceeding risk thresholds',
    code: `policy "risk-threshold" {
  description = "Block high-risk actions"
  
  condition = data.riskScore > 80
  
  action {
    type = "deny"
    message = "Action blocked due to high risk score"
  }
  
  action {
    type = "notify"
    target = "risk-management"
    parameters = {
      priority = "high"
      riskScore = data.riskScore
    }
  }
}`,
    category: 'Risk Management',
    frameworks: ['SOC2', 'ISO27001'],
  },

  // Separation of Duties
  'separation-of-duties': {
    name: 'Separation of Duties',
    description: 'Enforce separation of duties for critical operations',
    code: `policy "separation-of-duties" {
  description = "Enforce separation of duties"
  
  condition = action == "approve" && user.id == data.requesterId
  
  action {
    type = "deny"
    message = "Cannot approve your own request - separation of duties required"
  }
}`,
    category: 'Access Control',
    frameworks: ['SOC2', 'ISO27001', 'PCI-DSS'],
  },
};

export interface PolicyTemplate {
  name: string;
  description: string;
  code: string;
  category: string;
  frameworks: string[];
}
