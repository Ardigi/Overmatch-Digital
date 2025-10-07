export interface ControlDetailViewProps {
  controlId: string;
  onEdit?: () => void;
  onTest?: () => void;
  onArchive?: () => void;
}

export interface ControlMetadata {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  framework: string;
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE';
  frequency: 'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'AS_NEEDED';
  status: 'NOT_IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'IMPLEMENTED' | 'NOT_APPLICABLE';
  effectiveness?: 'NOT_TESTED' | 'INEFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'EFFECTIVE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  implementationDate?: string;
  testing?: {
    lastTested?: string;
    nextTestDate?: string;
    testResult?: string;
    testCoverage?: number;
  };
  evidence?: Array<{
    id: string;
    type: string;
    description: string;
    fileName?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    url?: string;
  }>;
  gaps?: Array<{
    id: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
    identifiedDate: string;
    targetDate?: string;
    remediation?: string;
  }>;
  metadata?: {
    evidenceCount?: number;
    testCount?: number;
    gapCount?: number;
    avgEffectiveness?: number;
    dueForTesting?: boolean;
  };
  relatedControls?: Array<{
    id: string;
    code: string;
    name: string;
    relationship: 'DEPENDS_ON' | 'RELATED_TO' | 'COMPENSATES_FOR';
  }>;
  relatedPolicies?: string[];
  relatedRisks?: string[];
  tags?: string[];
  notes?: string;
  automationLevel?: 'MANUAL' | 'SEMI_AUTOMATED' | 'FULLY_AUTOMATED';
  createdAt: string;
  updatedAt: string;
}

export interface TestingHistoryRow {
  id: string;
  testDate: string;
  tester: {
    id: string;
    name: string;
    email?: string;
  };
  result: 'PASS' | 'FAIL' | 'PARTIAL';
  methodology: 'INQUIRY' | 'OBSERVATION' | 'INSPECTION' | 'REPERFORMANCE';
  findings?: string;
  recommendations?: string;
  evidenceCount?: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED' | 'APPROVED';
  reviewer?: {
    id: string;
    name: string;
  };
  reviewDate?: string;
  nextTestDate?: string;
}

export interface ControlStatistics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  partialTests: number;
  passRate: number;
  lastTestDate: string | null;
  nextTestDate: string | null;
  averageRemediationTime?: number;
  testFrequencyCompliance?: number;
}

export interface ControlGap {
  id: string;
  controlId: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACCEPTED';
  identifiedDate: string;
  identifiedBy: string;
  targetResolutionDate?: string;
  actualResolutionDate?: string;
  remediation?: {
    description: string;
    assignedTo?: string;
    progress?: number;
    blockers?: string[];
  };
  riskImpact?: string;
  businessJustification?: string;
  compensatingControls?: string[];
  notes?: string;
}

export interface ControlEvidence {
  id: string;
  controlId: string;
  type: 'SCREENSHOT' | 'DOCUMENT' | 'LOG' | 'REPORT' | 'CONFIGURATION' | 'OTHER';
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url?: string;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  testId?: string;
  expirationDate?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}