export enum CollectorType {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JIRA = 'jira',
  OKTA = 'okta',
  DATABASE = 'database',
  API = 'api',
  FILE_SYSTEM = 'file_system',
  MANUAL = 'manual',
}

export enum CollectorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  CONFIGURED = 'configured',
  NOT_CONFIGURED = 'not_configured',
}

export interface CollectorConfig {
  type: CollectorType;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string; // Cron expression
  credentials?: Record<string, any>;
  options?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CollectionResult {
  success: boolean;
  evidenceCount: number;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
  duration?: number;
  nextRun?: Date;
}

export interface EvidenceData {
  title: string;
  description: string;
  type: string;
  category: string;
  source: string;
  sourceSystem: CollectorType;
  content: any;
  metadata?: Record<string, any>;
  tags?: string[];
  expirationDate?: Date;
}

export interface IEvidenceCollector {
  readonly type: CollectorType;
  readonly name: string;

  configure(config: CollectorConfig): Promise<void>;
  validate(): Promise<boolean>;
  collect(): Promise<CollectionResult>;
  testConnection(): Promise<boolean>;
  getStatus(): CollectorStatus;
  getLastRun(): Date | null;
  getNextRun(): Date | null;
}
