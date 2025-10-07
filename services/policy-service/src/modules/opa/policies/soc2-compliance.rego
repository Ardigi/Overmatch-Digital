package soc2.compliance

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# Default deny
default allow = false

# SOC 2 Trust Service Criteria
trust_service_criteria := {
    "security": {
        "cc6.1": "logical_access_controls",
        "cc6.2": "user_access_provisioning",
        "cc6.3": "user_authentication",
        "cc6.6": "encryption",
        "cc6.7": "system_operations",
        "cc6.8": "vulnerability_management"
    },
    "availability": {
        "a1.1": "capacity_planning",
        "a1.2": "system_availability",
        "a1.3": "incident_management"
    },
    "processing_integrity": {
        "pi1.1": "data_processing_accuracy",
        "pi1.2": "data_completeness",
        "pi1.3": "data_validity"
    },
    "confidentiality": {
        "c1.1": "confidential_information_protection",
        "c1.2": "confidential_information_disposal"
    },
    "privacy": {
        "p1.1": "personal_information_collection",
        "p2.1": "personal_information_use",
        "p3.1": "personal_information_retention"
    }
}

# Access Control Rules
allow if {
    input.action == "read"
    user_has_permission[input.user.role][input.resource.type]["read"]
}

allow if {
    input.action == "write"
    user_has_permission[input.user.role][input.resource.type]["write"]
    resource_ownership_valid
}

# Role-based permissions
user_has_permission := {
    "SUPER_ADMIN": {
        "policy": {"read": true, "write": true, "delete": true},
        "control": {"read": true, "write": true, "delete": true},
        "evidence": {"read": true, "write": true, "delete": true},
        "audit": {"read": true, "write": true, "delete": true}
    },
    "ADMIN": {
        "policy": {"read": true, "write": true, "delete": false},
        "control": {"read": true, "write": true, "delete": false},
        "evidence": {"read": true, "write": true, "delete": false},
        "audit": {"read": true, "write": true, "delete": false}
    },
    "AUDITOR": {
        "policy": {"read": true, "write": false, "delete": false},
        "control": {"read": true, "write": false, "delete": false},
        "evidence": {"read": true, "write": true, "delete": false},
        "audit": {"read": true, "write": true, "delete": false}
    },
    "CLIENT_USER": {
        "policy": {"read": true, "write": false, "delete": false},
        "control": {"read": true, "write": false, "delete": false},
        "evidence": {"read": true, "write": false, "delete": false},
        "audit": {"read": true, "write": false, "delete": false}
    }
}

# Resource ownership validation
resource_ownership_valid if {
    input.resource.organizationId == input.user.organizationId
}

resource_ownership_valid if {
    input.user.role in ["SUPER_ADMIN", "AUDITOR"]
}

# MFA Requirements
mfa_required if {
    input.action in ["delete", "approve", "publish"]
}

mfa_required if {
    input.resource.type in ["policy", "audit_report"]
    input.action == "write"
}

mfa_valid if {
    input.user.mfaVerified == true
    time.now_ns() - input.user.mfaVerifiedAt < 300000000000  # 5 minutes
}

# Encryption Requirements
encryption_required if {
    input.resource.type in ["evidence", "audit_report", "personal_data"]
}

encryption_valid if {
    input.resource.encrypted == true
    input.resource.encryptionAlgorithm in ["AES-256-GCM", "RSA-2048"]
}

# Audit Trail Requirements
audit_required if {
    input.action in ["create", "update", "delete", "approve", "reject"]
}

audit_trail_complete if {
    input.auditLog.userId == input.user.id
    input.auditLog.timestamp
    input.auditLog.action == input.action
    input.auditLog.resourceId == input.resource.id
    input.auditLog.ipAddress
}

# Data Retention Rules
retention_period_days := {
    "evidence": 2555,      # 7 years
    "audit_report": 2555,  # 7 years
    "policy": 1095,        # 3 years
    "control_test": 365,   # 1 year
    "log": 90              # 90 days
}

retention_expired if {
    days_since_creation := (time.now_ns() - input.resource.createdAt) / 86400000000000
    days_since_creation > retention_period_days[input.resource.type]
}

# Compliance Violations
violations[msg] {
    mfa_required
    not mfa_valid
    msg := "Multi-factor authentication is required for this action"
}

violations[msg] {
    encryption_required
    not encryption_valid
    msg := "Resource must be encrypted with approved algorithms"
}

violations[msg] {
    audit_required
    not audit_trail_complete
    msg := "Complete audit trail is required for this action"
}

violations[msg] {
    retention_expired
    input.action != "delete"
    msg := "Resource has exceeded retention period and must be deleted"
}

violations[msg] {
    input.resource.type == "password"
    not password_complexity_valid
    msg := "Password does not meet complexity requirements"
}

# Password Complexity Rules
password_complexity_valid if {
    count(input.resource.value) >= 12
    regex.match("[A-Z]", input.resource.value)
    regex.match("[a-z]", input.resource.value)
    regex.match("[0-9]", input.resource.value)
    regex.match("[^A-Za-z0-9]", input.resource.value)
}

# Control Effectiveness Rules
control_effective if {
    input.control.implementationStatus == "IMPLEMENTED"
    input.control.testResults.passed == true
    input.control.testResults.exceptionsCount == 0
}

control_partially_effective if {
    input.control.implementationStatus == "IMPLEMENTED"
    input.control.testResults.passed == true
    input.control.testResults.exceptionsCount > 0
    input.control.testResults.exceptionsCount <= 3
}

# Continuous Monitoring Rules
monitoring_required if {
    input.control.criticalityLevel in ["HIGH", "CRITICAL"]
}

monitoring_frequency_days := {
    "CRITICAL": 1,
    "HIGH": 7,
    "MEDIUM": 30,
    "LOW": 90
}

monitoring_overdue if {
    monitoring_required
    days_since_last_test := (time.now_ns() - input.control.lastTestDate) / 86400000000000
    days_since_last_test > monitoring_frequency_days[input.control.criticalityLevel]
}

# Cross-Framework Mapping
framework_controls_mapped if {
    input.control.frameworks[_] == "SOC2_SECURITY"
    count(input.control.mappings) > 0
}

# Remediation Priority
remediation_priority := priority if {
    input.finding.severity == "CRITICAL"
    priority := 1
} else := priority if {
    input.finding.severity == "HIGH"
    priority := 2
} else := priority if {
    input.finding.severity == "MEDIUM"
    priority := 3
} else := priority if {
    input.finding.severity == "LOW"
    priority := 4
}

# Summary compliance score
compliance_score := score if {
    total_controls := count(input.controls)
    effective_controls := count([c | c := input.controls[_]; control_effective with input.control as c])
    partially_effective := count([c | c := input.controls[_]; control_partially_effective with input.control as c])
    
    score := ((effective_controls * 100) + (partially_effective * 50)) / total_controls
}