export interface ControlAutomationConfig {
  id: string;
  controlId: string;
  enabled: boolean;
  automationType: ControlAutomationType;
  schedule?: AutomationSchedule;
  triggers?: AutomationTrigger[];
  actions: AutomationAction[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum ControlAutomationType {
  EVIDENCE_COLLECTION = 'evidence_collection',
  COMPLIANCE_CHECK = 'compliance_check',
  REMEDIATION = 'remediation',
  NOTIFICATION = 'notification',
  ESCALATION = 'escalation'
}

export interface AutomationSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom';
  cronExpression?: string;
  timezone?: string;
  nextRun?: Date;
  lastRun?: Date;
}

export interface AutomationTrigger {
  type: 'event' | 'threshold' | 'dependency' | 'manual';
  eventName?: string;
  condition?: TriggerCondition;
  metadata?: Record<string, any>;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
  value: any;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
}

export interface AutomationAction {
  type: 'collect_evidence' | 'run_check' | 'send_notification' | 'create_task' | 'update_status' | 'execute_script';
  target?: string;
  parameters?: Record<string, any>;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffType: 'fixed' | 'exponential';
  delayMs: number;
  maxDelayMs?: number;
}

export interface ControlAutomationResult {
  automationId: string;
  controlId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  actionsExecuted: ActionResult[];
  error?: string;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  output?: any;
  error?: string;
}

export interface AutomationResults {
  results: ControlAutomationResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    partial: number;
  };
}

export interface EvidenceInput {
  type: string;
  source: string;
  data: any;
  metadata?: Record<string, any>;
  title?: string;
  description?: string;
  url?: string;
  filePath?: string;
  collectedAt?: Date;
  collectedBy?: string;
  validity?: { from: Date; to: Date };
  review?: {
    reviewedBy: string;
    reviewedAt: Date;
    comments?: string;
  };
}

export interface AssessmentInput {
  assessorId: string;
  rating: number;
  comments?: string;
  findings?: { description: string }[];
  recommendations?: { description: string }[];
  assessmentDate?: Date;
  score?: number;
  status?: 'compliant' | 'non-compliant' | 'partial';
}