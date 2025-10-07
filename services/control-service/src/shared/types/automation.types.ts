/**
 * Control automation details structure
 */
export interface ControlAutomationDetails {
  level: 'MANUAL' | 'SEMI_AUTOMATED' | 'AUTOMATED' | 'FULLY_AUTOMATED';
  scriptId?: string;
  apiEndpoint?: string;
  integrationId?: string;
  parameters?: Record<string, unknown>;
  schedule?: AutomationSchedule;
  notifications?: NotificationConfig[];
  implemented?: boolean;
  tool?: string;
}

/**
 * Automation schedule configuration
 */
export interface AutomationSchedule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'ON_DEMAND';
  time?: string; // HH:mm format
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  enabled: boolean;
}

/**
 * Notification configuration for automation
 */
export interface NotificationConfig {
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK';
  recipients: string[];
  conditions: ('SUCCESS' | 'FAILURE' | 'ERROR' | 'PARTIAL')[];
  template?: string;
}

/**
 * Workflow approval request data
 */
export interface WorkflowApprovalRequest {
  controlId: string;
  organizationId?: string;
  requestType: 'IMPLEMENTATION' | 'EXCEPTION' | 'TEST_RESULT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description?: string;
  justification?: string;
  requiredApprovers?: string[];
  dueDate?: Date;
  attachments?: string[];
}

/**
 * Service discovery response structure for workflow
 */
export interface WorkflowServiceResponse {
  data?: {
    workflowId?: string;
    status?: 'INITIATED' | 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt?: Date;
  };
  success?: boolean;
  error?: string;
}

/**
 * Control test automation configuration
 */
export interface ControlAutomationConfig {
  isAutomated: boolean;
  automationType?: 'SCRIPT' | 'API' | 'INTEGRATION';
  scriptId?: string;
  apiEndpoint?: string;
  integrationId?: string;
  parameters?: Record<string, unknown>;
  schedule?: AutomationSchedule;
  retryConfig?: RetryConfiguration;
}

/**
 * Retry configuration for automation
 */
export interface RetryConfiguration {
  maxRetries: number;
  retryDelayMs: number;
  backoffStrategy: 'FIXED' | 'EXPONENTIAL' | 'LINEAR';
  retryConditions: ('TIMEOUT' | 'ERROR' | 'NETWORK_ERROR' | 'SERVICE_UNAVAILABLE')[];
}

/**
 * Script execution parameters
 */
export interface ScriptExecutionParams {
  scriptId: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  environment?: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
}

/**
 * API test execution parameters
 */
export interface ApiTestParams {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  parameters: Record<string, unknown>;
  expectedStatusCode?: number;
  expectedResponse?: unknown;
}

/**
 * Integration test execution parameters
 */
export interface IntegrationTestParams {
  integrationId: string;
  parameters: Record<string, unknown>;
  validationRules?: ValidationRule[];
}

/**
 * Validation rule for integration tests
 */
export interface ValidationRule {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'NOT_CONTAINS' | 'GREATER_THAN' | 'LESS_THAN';
  expectedValue: unknown;
  required: boolean;
}

/**
 * Automation run details
 */
export interface AutomationRunDetails {
  success: boolean;
  duration?: number;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}