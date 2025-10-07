import type { PolicyMetadata, PolicyActionParameters, PolicyAttributes, PolicyEnvironment } from '../../policies/types/policy.types';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string; // Expression to evaluate
  actions: PolicyAction[];
  metadata?: PolicyMetadata;
}

export interface PolicyAction {
  type: 'allow' | 'deny' | 'require' | 'notify' | 'remediate';
  target?: string;
  parameters?: PolicyActionParameters;
  message?: string;
}

export interface PolicyContext {
  subject: {
    id: string;
    type: string;
    attributes: PolicyAttributes;
  };
  resource: {
    id: string;
    type: string;
    attributes: PolicyAttributes;
  };
  action: string;
  environment: PolicyEnvironment & {
    timestamp: Date;
  };
  data?: PolicyContextData;
}

export interface PolicyContextData {
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  ruleSatisfied: boolean;
  ruleId: string;
  ruleName: string;
  actions: PolicyAction[];
  reasons: string[];
  metadata?: PolicyEvaluationMetadata;
  evaluationTime: number; // milliseconds
}

export interface PolicyEvaluationMetadata {
  condition?: string;
  contextUsed?: Partial<PolicyContext>;
  version?: string;
  timestamp?: Date;
  [key: string]: unknown;
}

export interface PolicySet {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: PolicyRule[];
  combiningAlgorithm: 'all' | 'any' | 'first-applicable';
  enabled: boolean;
  metadata?: PolicySetMetadata;
}

export interface PolicySetMetadata {
  createdAt?: Date;
  updatedAt?: Date;
  author?: string;
  tags?: string[];
  priority?: number;
  expiresAt?: Date;
  [key: string]: unknown;
}

export interface IPolicyEngine {
  evaluatePolicy(policyId: string, context: PolicyContext): Promise<PolicyEvaluationResult>;

  evaluatePolicySet(policySetId: string, context: PolicyContext): Promise<PolicyEvaluationResult[]>;

  validatePolicy(policy: string): Promise<boolean>;

  compilePolicy(policy: string): Promise<PolicyRule>;
}
