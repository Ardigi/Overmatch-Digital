export interface PolicyAutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationTrigger {
  type: 'schedule' | 'event' | 'manual' | 'webhook';
  config: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface AutomationAction {
  type: 'approve' | 'reject' | 'notify' | 'escalate' | 'assign' | 'execute_policy';
  config: Record<string, any>;
}

export interface PolicyAutomationResult {
  ruleId: string;
  executedAt: Date;
  success: boolean;
  actionsExecuted: string[];
  error?: string;
}

export interface AutomationParameters {
  [key: string]: any;
}

export interface AuthenticationConfig {
  type: 'basic' | 'bearer' | 'oauth2' | 'apikey';
  credentials?: Record<string, any>;
}

export interface AuditChanges {
  field: string;
  oldValue: any;
  newValue: any;
  changedAt: Date;
  changedBy: string;
}

export interface AuditMetadata {
  action: string;
  timestamp: Date;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}