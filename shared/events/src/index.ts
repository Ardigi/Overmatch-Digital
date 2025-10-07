// Event Types
export enum EventType {
  // Authentication Events
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',
  PASSWORD_RESET = 'user.password_reset',
  MFA_ENABLED = 'user.mfa_enabled',
  MFA_DISABLED = 'user.mfa_disabled',

  // Client Events
  CLIENT_CREATED = 'client.created',
  CLIENT_UPDATED = 'client.updated',
  CLIENT_DELETED = 'client.deleted',
  CLIENT_ONBOARDED = 'client.onboarded',

  // Audit Events
  AUDIT_STARTED = 'audit.started',
  AUDIT_COMPLETED = 'audit.completed',
  AUDIT_EVIDENCE_REQUESTED = 'audit.evidence_requested',
  AUDIT_FINDING_CREATED = 'audit.finding_created',
  AUDIT_FINDING_UPDATED = 'audit.finding_updated',
  AUDIT_FINDING_RESOLVED = 'audit.finding_resolved',

  // Compliance Events
  CONTROL_IMPLEMENTED = 'compliance.control_implemented',
  CONTROL_TESTED = 'compliance.control_tested',
  CONTROL_FAILED = 'compliance.control_failed',

  // Policy Events
  POLICY_CREATED = 'policy.created',
  POLICY_UPDATED = 'policy.updated',
  POLICY_APPROVED = 'policy.approved',
  POLICY_MAPPED_TO_CONTROL = 'policy.mapped_to_control',
  POLICY_UNMAPPED_FROM_CONTROL = 'policy.unmapped_from_control',
  POLICY_PUBLISHED = 'policy.published',
  POLICY_ARCHIVED = 'policy.archived',
  POLICY_WORKFLOW_TRANSITIONED = 'policy.workflow.transitioned',
  POLICY_NEEDS_REVIEW = 'policy.needs_review',

  // Control Events
  CONTROL_CREATED = 'control.created',
  CONTROL_UPDATED = 'control.updated',
  CONTROL_DELETED = 'control.deleted',
  CONTROL_ASSIGNED = 'control.assigned',
  CONTROL_UNASSIGNED = 'control.unassigned',
  CONTROL_IMPLEMENTATION_STARTED = 'control.implementation.started',
  CONTROL_IMPLEMENTATION_UPDATED = 'control.implementation.updated',
  CONTROL_IMPLEMENTATION_COMPLETED = 'control.implementation.completed',
  CONTROL_TEST_SCHEDULED = 'control.test.scheduled',
  CONTROL_TEST_STARTED = 'control.test.started',
  CONTROL_TEST_COMPLETED = 'control.test.completed',
  CONTROL_FINDING_CREATED = 'control.finding.created',
  CONTROL_FINDING_RESOLVED = 'control.finding.resolved',

  // Evidence Events
  EVIDENCE_COLLECTED = 'evidence.collected',
  EVIDENCE_COLLECTION_FAILED = 'evidence.collection.failed',
  EVIDENCE_UPLOADED = 'evidence.uploaded',
  EVIDENCE_VERIFIED = 'evidence.verified',
  EVIDENCE_EXPIRED = 'evidence.expired',
  EVIDENCE_LINKED_TO_CONTROL = 'evidence.linked_to_control',
  EVIDENCE_UNLINKED_FROM_CONTROL = 'evidence.unlinked_from_control',
  EVIDENCE_APPROVED = 'evidence.approved',
  EVIDENCE_REJECTED = 'evidence.rejected',

  // Risk Events
  RISK_IDENTIFIED = 'risk.identified',
  RISK_ASSESSED = 'risk.assessed',
  RISK_MITIGATED = 'risk.mitigated',

  // Security Events
  SECURITY_THREAT_DETECTED = 'security.threat_detected',
  SECURITY_INCIDENT_CREATED = 'security.incident_created',
  SECURITY_INCIDENT_RESOLVED = 'security.incident_resolved',

  // Workflow Events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_STEP_COMPLETED = 'workflow.step_completed',
  WORKFLOW_APPROVAL_REQUIRED = 'workflow.approval_required',

  // AI/Remediation Events
  REMEDIATION_GENERATED = 'remediation.generated',
  ANALYSIS_COMPLETED = 'analysis.completed',
  PREDICTION_GENERATED = 'prediction.generated',

  // Integration Events
  INTEGRATION_CONNECTED = 'integration.connected',
  INTEGRATION_DISCONNECTED = 'integration.disconnected',
  SYNC_STARTED = 'sync.started',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',

  // Notification Events
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_DELIVERED = 'notification.delivered',
  NOTIFICATION_FAILED = 'notification.failed',
}

// Base Event Interface
export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  version: string;
  source: string;
  correlationId?: string;
  userId?: string;
  organizationId?: string;
}

// Authentication Events
export interface UserRegisteredEvent extends BaseEvent {
  type: EventType.USER_REGISTERED;
  payload: {
    userId: string;
    email: string;
    organizationId: string;
    role: string;
  };
}

export interface UserLoggedInEvent extends BaseEvent {
  type: EventType.USER_LOGGED_IN;
  payload: {
    userId: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    mfaUsed: boolean;
  };
}

// Client Events
export interface ClientCreatedEvent extends BaseEvent {
  type: EventType.CLIENT_CREATED;
  payload: {
    clientId: string;
    name: string;
    industry: string;
    size: string;
    primaryContactEmail: string;
  };
}

// Audit Events
export interface AuditStartedEvent extends BaseEvent {
  type: EventType.AUDIT_STARTED;
  payload: {
    auditId: string;
    clientId: string;
    auditType: 'SOC1_TYPE1' | 'SOC1_TYPE2' | 'SOC2_TYPE1' | 'SOC2_TYPE2';
    startDate: Date;
    endDate: Date;
    trustServiceCriteria: string[];
  };
}

export interface AuditFindingCreatedEvent extends BaseEvent {
  type: EventType.AUDIT_FINDING_CREATED;
  payload: {
    findingId: string;
    auditId: string;
    controlId?: string;
    controlCode?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    findingType: string;
    status: string;
    description: string;
    recommendation?: string;
  };
}

export interface AuditFindingUpdatedEvent extends BaseEvent {
  type: EventType.AUDIT_FINDING_UPDATED;
  payload: {
    findingId: string;
    auditId: string;
    controlId?: string;
    controlCode?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: string;
    updatedBy: string;
    changes: Record<string, any>;
  };
}

export interface AuditFindingResolvedEvent extends BaseEvent {
  type: EventType.AUDIT_FINDING_RESOLVED;
  payload: {
    findingId: string;
    auditId: string;
    controlId?: string;
    controlCode?: string;
    resolvedBy: string;
    resolutionDate: Date;
    resolutionNotes?: string;
    evidenceIds?: string[];
  };
}

// Compliance Events
export interface ControlImplementedEvent extends BaseEvent {
  type: EventType.CONTROL_IMPLEMENTED;
  payload: {
    controlId: string;
    controlCode: string;
    implementedBy: string;
    implementationDate: Date;
    evidenceIds: string[];
  };
}

// Evidence Events
export interface EvidenceCollectedEvent extends BaseEvent {
  type: EventType.EVIDENCE_COLLECTED;
  payload: {
    evidenceId: string;
    controlId: string;
    type: 'SCREENSHOT' | 'DOCUMENT' | 'LOG' | 'CONFIGURATION';
    collectionMethod: 'MANUAL' | 'AUTOMATED';
    source: string;
    collectedBy: string;
  };
}

export interface EvidenceCollectionFailedEvent extends BaseEvent {
  type: EventType.EVIDENCE_COLLECTION_FAILED;
  payload: {
    source: string;
    controlId?: string;
    collectorType: string;
    error: string;
    organizationId: string;
    metadata?: Record<string, any>;
  };
}

// Event Publisher Interface
export interface EventPublisher {
  publish<T extends BaseEvent>(event: T): Promise<void>;
  publishBatch<T extends BaseEvent>(events: T[]): Promise<void>;
}

// Event Handler Interface
export interface EventHandler<T extends BaseEvent> {
  handle(event: T): Promise<void>;
}

// Control Events
export interface ControlCreatedEvent extends BaseEvent {
  type: EventType.CONTROL_CREATED;
  payload: {
    controlId: string;
    controlCode: string;
    name: string;
    frameworks: string[];
    category: string;
    type: string;
    priority: string;
  };
}

export interface ControlAssignedEvent extends BaseEvent {
  type: EventType.CONTROL_ASSIGNED;
  payload: {
    controlId: string;
    controlCode: string;
    organizationId: string;
    assignedBy: string;
    framework?: string;
  };
}

export interface ControlImplementationUpdatedEvent extends BaseEvent {
  type: EventType.CONTROL_IMPLEMENTATION_UPDATED;
  payload: {
    controlId: string;
    controlCode: string;
    organizationId: string;
    previousStatus: string;
    newStatus: string;
    updatedBy: string;
    effectiveness?: {
      score: number;
      strengths: string[];
      weaknesses: string[];
    };
  };
}

export interface ControlTestCompletedEvent extends BaseEvent {
  type: EventType.CONTROL_TEST_COMPLETED;
  payload: {
    testId: string;
    controlId: string;
    controlCode: string;
    organizationId: string;
    result: string;
    testMethod: string;
    testerId: string;
    findings: number;
    criticalFindings: number;
  };
}

export interface ControlFindingCreatedEvent extends BaseEvent {
  type: EventType.CONTROL_FINDING_CREATED;
  payload: {
    findingId: string;
    controlId: string;
    controlCode: string;
    organizationId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
    targetRemediationDate?: Date;
  };
}

// Evidence Link Events
export interface EvidenceLinkedToControlEvent extends BaseEvent {
  type: EventType.EVIDENCE_LINKED_TO_CONTROL;
  payload: {
    evidenceId: string;
    controlId: string;
    controlCode?: string;
    organizationId: string;
    framework?: string;
    linkedBy: string;
    mappingType?: 'primary' | 'supporting' | 'compensating';
  };
}

export interface EvidenceUnlinkedFromControlEvent extends BaseEvent {
  type: EventType.EVIDENCE_UNLINKED_FROM_CONTROL;
  payload: {
    evidenceId: string;
    controlId: string;
    organizationId: string;
    unlinkedBy: string;
    reason?: string;
  };
}

export interface EvidenceApprovedEvent extends BaseEvent {
  type: EventType.EVIDENCE_APPROVED;
  payload: {
    evidenceId: string;
    approvedBy: string;
    comments?: string;
    controlIds?: string[];
  };
}

export interface EvidenceRejectedEvent extends BaseEvent {
  type: EventType.EVIDENCE_REJECTED;
  payload: {
    evidenceId: string;
    rejectedBy: string;
    reason: string;
    controlIds?: string[];
  };
}

// Policy Events
export interface PolicyCreatedEvent extends BaseEvent {
  type: EventType.POLICY_CREATED;
  payload: {
    policyId: string;
    policyNumber: string;
    title: string;
    type: string;
    status: string;
    frameworks: string[];
  };
}

export interface PolicyUpdatedEvent extends BaseEvent {
  type: EventType.POLICY_UPDATED;
  payload: {
    policyId: string;
    policyNumber: string;
    title: string;
    changes: string[];
    version: string;
  };
}

export interface PolicyApprovedEvent extends BaseEvent {
  type: EventType.POLICY_APPROVED;
  payload: {
    policyId: string;
    policyNumber: string;
    title: string;
    approvedBy: string;
    comments?: string;
    effectiveDate: Date;
  };
}

export interface PolicyMappedToControlEvent extends BaseEvent {
  type: EventType.POLICY_MAPPED_TO_CONTROL;
  payload: {
    policyId: string;
    controlId: string;
    framework: string;
    strength: 'strong' | 'moderate' | 'weak';
    mappedBy: string;
  };
}

export interface PolicyUnmappedFromControlEvent extends BaseEvent {
  type: EventType.POLICY_UNMAPPED_FROM_CONTROL;
  payload: {
    policyId: string;
    controlId: string;
    unmappedBy: string;
  };
}

export interface PolicyPublishedEvent extends BaseEvent {
  type: EventType.POLICY_PUBLISHED;
  payload: {
    policyId: string;
    policyNumber: string;
    title: string;
    publishedBy: string;
    effectiveDate: Date;
  };
}

export interface PolicyArchivedEvent extends BaseEvent {
  type: EventType.POLICY_ARCHIVED;
  payload: {
    policyId: string;
    policyNumber: string;
    archivedBy: string;
    reason?: string;
  };
}

export interface PolicyWorkflowTransitionedEvent extends BaseEvent {
  type: EventType.POLICY_WORKFLOW_TRANSITIONED;
  payload: {
    policyId: string;
    previousState: string;
    newState: string;
    transitionedBy: string;
    comment?: string;
  };
}

export interface PolicyNeedsReviewEvent extends BaseEvent {
  type: EventType.POLICY_NEEDS_REVIEW;
  payload: {
    policyId: string;
    policyNumber: string;
    title: string;
    nextReviewDate: Date;
    daysOverdue: number;
    owner: string;
  };
}

// Workflow Events
export interface WorkflowStartedEvent extends BaseEvent {
  type: EventType.WORKFLOW_STARTED;
  payload: {
    workflowId: string;
    workflowType: string;
    organizationId: string;
    initiatedBy: string;
    context?: Record<string, any>;
  };
}

export interface WorkflowCompletedEvent extends BaseEvent {
  type: EventType.WORKFLOW_COMPLETED;
  payload: {
    workflowId: string;
    workflowType: string;
    organizationId: string;
    completedBy: string;
    duration: number;
    result?: Record<string, any>;
  };
}

export interface WorkflowFailedEvent extends BaseEvent {
  type: EventType.WORKFLOW_FAILED;
  payload: {
    workflowId: string;
    workflowType: string;
    organizationId: string;
    error: string;
    failedStep?: string;
    duration: number;
  };
}

// AI/Remediation Events
export interface RemediationGeneratedEvent extends BaseEvent {
  type: EventType.REMEDIATION_GENERATED;
  payload: {
    remediationId: string;
    findingId: string;
    controlId?: string;
    organizationId: string;
    generatedBy: string;
    priority: string;
    estimatedEffort: number;
  };
}

export interface AnalysisCompletedEvent extends BaseEvent {
  type: EventType.ANALYSIS_COMPLETED;
  payload: {
    analysisId: string;
    analysisType: string;
    organizationId: string;
    duration: number;
    resultSummary: Record<string, any>;
  };
}

// Integration Events
export interface IntegrationConnectedEvent extends BaseEvent {
  type: EventType.INTEGRATION_CONNECTED;
  payload: {
    integrationId: string;
    integrationType: string;
    organizationId: string;
    connectedBy: string;
    configuration?: Record<string, any>;
  };
}

export interface IntegrationDisconnectedEvent extends BaseEvent {
  type: EventType.INTEGRATION_DISCONNECTED;
  payload: {
    integrationId: string;
    integrationType: string;
    organizationId: string;
    disconnectedBy: string;
    reason?: string;
  };
}

export interface SyncStartedEvent extends BaseEvent {
  type: EventType.SYNC_STARTED;
  payload: {
    syncId: string;
    integrationId: string;
    organizationId: string;
    syncType: string;
    triggeredBy: string;
  };
}

export interface SyncCompletedEvent extends BaseEvent {
  type: EventType.SYNC_COMPLETED;
  payload: {
    syncId: string;
    integrationId: string;
    organizationId: string;
    entitiesSynced: number;
    duration: number;
    errors?: string[];
    syncType?: string;
  };
}

export interface SyncFailedEvent extends BaseEvent {
  type: EventType.SYNC_FAILED;
  payload: {
    syncId: string;
    integrationId: string;
    organizationId: string;
    error: string;
    duration: number;
    syncType?: string;
  };
}

// Notification Events
export interface NotificationSentEvent extends BaseEvent {
  type: EventType.NOTIFICATION_SENT;
  payload: {
    notificationId: string;
    recipientId: string;
    channel: string;
    subject?: string;
    organizationId: string;
    sentBy?: string;
    providerMessageId?: string;
  };
}

export interface NotificationDeliveredEvent extends BaseEvent {
  type: EventType.NOTIFICATION_DELIVERED;
  payload: {
    notificationId: string;
    recipientId: string;
    channel: string;
    organizationId: string;
    sentBy: string;
    providerMessageId?: string;
    deliveredAt?: Date;
  };
}

export interface NotificationFailedEvent extends BaseEvent {
  type: EventType.NOTIFICATION_FAILED;
  payload: {
    notificationId: string;
    recipientId: string;
    organizationId: string;
    channel?: string;
    error: string;
    retryCount: number;
  };
}

// Event Store Interface
export interface EventStore {
  append<T extends BaseEvent>(event: T): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<BaseEvent[]>;
  getEventsByType(type: EventType, limit?: number): Promise<BaseEvent[]>;
}
