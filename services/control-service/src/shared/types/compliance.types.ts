/**
 * Supported compliance frameworks for type safety
 * Following Evidence Service gold standard pattern
 */
export enum ComplianceFramework {
  SOC2 = 'SOC2',
  SOC1 = 'SOC1',
  ISO27001 = 'ISO27001',
  HIPAA = 'HIPAA',
  PCI = 'PCI-DSS',
  NIST = 'NIST',
  GDPR = 'GDPR',
  CUSTOM = 'CUSTOM',
}

/**
 * Type-safe runtime validation for framework keys
 * Follows Evidence Service enterprise pattern
 */
export function isValidFrameworkKey(key: string): key is keyof typeof ComplianceFramework {
  const validFrameworks = new Set<string>(Object.values(ComplianceFramework));
  return validFrameworks.has(key);
}

/**
 * Get normalized framework name with type safety
 */
export function normalizeFrameworkKey(framework: string): ComplianceFramework | null {
  const normalizedFramework = framework.toUpperCase();
  return isValidFrameworkKey(normalizedFramework) ? normalizedFramework as ComplianceFramework : null;
}

/**
 * Framework configuration interface
 */
export interface FrameworkConfig {
  name: ComplianceFramework;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  categories: string[];
  totalControls: number;
}

/**
 * Control framework mapping interface
 */
export interface ControlFrameworkMapping {
  name: ComplianceFramework;
  section: string;
  reference?: string;
  requirements?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Time range interface for analytics and metrics
 */
export interface TimeRange {
  start: Date;
  end: Date;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}