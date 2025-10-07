import { ControlCategory, ControlFrequency, ControlStatus } from '../../modules/controls/entities/control.entity';
import { ImplementationStatus } from '../../modules/implementation/entities/control-implementation.entity';
import { TestStatus } from '../../modules/control-tests/entities/control-test.entity';

/**
 * Type-safe query interface for controls
 */
export interface ControlQueryParams {
  status?: ControlStatus;
  type?: string;
  category?: ControlCategory;
  framework?: string;
  frameworks?: string[];  // Support multiple frameworks
  ownerId?: string;
  organizationId?: string;
  frequency?: ControlFrequency;
  limit?: number;
  skip?: number;
  automationImplemented?: boolean;
  regulatoryRequirement?: boolean;
  includeImplementations?: boolean;
}

/**
 * Organization controls query parameters with type safety
 */
export interface OrganizationControlsQueryParams {
  status?: ImplementationStatus;
  framework?: string;
  category?: ControlCategory;
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Control test results structure
 */
export interface ControlTestResultData {
  result: 'PASS' | 'FAIL' | 'PARTIAL';
  findings?: ControlTestFinding[];
  executedBy: string;
  evidence?: string[];
  notes?: string;
  testDate?: Date;
  duration?: number;
  testerId?: string;
  id?: string;
  testMethod?: string;
  organizationId?: string;
}

/**
 * Control test finding structure
 */
export interface ControlTestFinding {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rootCause: string;
  impact: string;
  recommendation: string;
  managementResponse?: string;
  targetRemediationDate?: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}

/**
 * Test evidence structure
 */
export interface TestEvidenceData {
  type: string;
  name: string;
  description: string;
  url: string;
  hash: string;
  collectedBy: string;
  verified?: boolean;
}

/**
 * Control test procedures
 */
export interface ControlTestProcedures {
  steps: ControlTestStep[];
  requirements?: string[];
  expectedOutcomes?: string[];
}

/**
 * Individual test step
 */
export interface ControlTestStep {
  order: number;
  description: string;
  expectedResult?: string;
  instructions?: string;
  evidence?: string[];
  notes?: string;
}

/**
 * Automation results structure
 */
export interface AutomationResultData {
  success: boolean;
  output?: string;
  evidence?: string[];
  notes?: string;
  exceptions?: TestException[];
  metrics?: Record<string, unknown>;
  overallResult?: 'PASS' | 'FAIL' | 'PARTIAL';
  result?: 'PASS' | 'FAIL' | 'PARTIAL';
  findings?: ControlTestFinding[];
  executedBy?: string;
  steps?: any[];
}

/**
 * Test exception structure
 */
export interface TestException {
  type: string;
  description: string;
  impact: string;
  approved: boolean;
  approvedBy?: string;
}

/**
 * Service query filters
 */
export interface ServiceQueryFilters {
  controlId?: string;
  status?: TestStatus;
  auditId?: string;
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
  framework?: string;
  category?: ControlCategory;
}

/**
 * Evidence validation data
 */
export interface EvidenceValidationData {
  controlId: string;
  testId?: string;
  type: string;
  name: string;
  description: string;
  url?: string;
  hash?: string;
  collectedBy: string;
}

/**
 * Approval workflow data
 */
export interface ApprovalWorkflowData {
  entityType: 'control_test' | 'control_implementation';
  entityId: string;
  workflowType: string;
  controlId: string;
  reason?: string;
  testResults?: ControlTestResultData;
  evidenceId?: string;
}