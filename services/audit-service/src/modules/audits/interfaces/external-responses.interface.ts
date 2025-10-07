// External Service Response Interfaces for Type Safety

export interface ControlAssessment {
  id: string;
  controlId: string;
  auditId: string;
  status: 'not_tested' | 'testing' | 'tested' | 'remediation';
  effectiveness: 'effective' | 'partially_effective' | 'deficient' | 'not_applicable';
  testingMethod: string;
  testDate?: Date;
  testerName?: string;
  findings?: string;
  recommendations?: string;
  evidence?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceItem {
  id: string;
  controlId: string;
  auditId: string;
  name: string;
  description?: string;
  type: 'document' | 'screenshot' | 'log' | 'report' | 'other';
  fileUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedBy: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

export interface ClientData {
  id: string;
  name: string;
  organizationId: string;
  primaryContact?: {
    name: string;
    email: string;
    phone?: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  industry?: string;
  size?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationData {
  id: string;
  name: string;
  description?: string;
  website?: string;
  primaryContact?: {
    name: string;
    email: string;
    phone?: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  settings?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportData {
  reportId: string;
  auditId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'html' | 'json' | 'csv';
  downloadUrl?: string;
  generatedAt?: Date;
  estimatedCompletion?: Date;
  metadata?: {
    sections?: string[];
    includeEvidence?: boolean;
    includeFindings?: boolean;
    customTemplate?: string;
  };
}

export interface NotificationData {
  id: string;
  type: 'email' | 'sms' | 'in_app' | 'webhook';
  recipientId: string;
  subject: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  organizationId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

export interface WorkflowInstanceData {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  context?: Record<string, any>;
  currentStep?: string;
  error?: string;
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

export interface ControlAssessmentResponse extends ApiResponse<ControlAssessment[]> {}
export interface EvidenceResponse extends PaginatedApiResponse<EvidenceItem> {}
export interface ClientResponse extends ApiResponse<ClientData> {}
export interface OrganizationResponse extends ApiResponse<OrganizationData> {}
export interface ReportResponse extends ApiResponse<ReportData> {}
export interface NotificationResponse extends ApiResponse<NotificationData[]> {}
export interface AuditLogResponse extends PaginatedApiResponse<AuditLogEntry> {}
export interface WorkflowResponse extends ApiResponse<WorkflowInstanceData> {}