/**
 * Automation run details structure
 */
export interface AutomationRunDetails {
  runId: string;
  startTime: Date;
  endTime?: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  executionType: 'SCHEDULED' | 'MANUAL' | 'EVENT_TRIGGERED';
  results?: Record<string, unknown>;
  logs?: string[];
  metrics?: Record<string, number>;
  errorDetails?: {
    code: string;
    message: string;
    stackTrace?: string;
  };
}

/**
 * Control export filters
 */
export interface ControlExportFilters {
  organizationId?: string;
  framework?: string[];
  status?: string[];
  category?: string[];
  startDate?: Date;
  endDate?: Date;
  includeImplementations?: boolean;
  includeTestResults?: boolean;
  format?: 'CSV' | 'XLSX' | 'JSON' | 'PDF';
}

/**
 * Control export report structure
 */
export interface ControlExportReport {
  generatedAt: Date;
  filters: ControlExportFilters;
  totalControls: number;
  controls: ControlExportData[];
  metadata?: {
    exportDate: Date;
    filters: ControlExportFilters;
    totalRecords: number;
  };
  summary?: {
    byStatus: Record<string, number>;
    byFramework: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

/**
 * Individual control export data
 */
export interface ControlExportData {
  id: string;
  code: string;
  name: string;
  description: string;
  type?: string;
  category: string;
  status: string;
  frameworks: string[];
  implementationStatus?: string;
  lastTested?: Date;
  testResults?: string;
  effectiveness?: string;
  metrics?: any;
}

/**
 * ROI calculation data
 */
export interface ControlROIData {
  controlId: string;
  implementationCost: number;
  maintenanceCostAnnual: number;
  riskReductionValue: number;
  complianceBenefit: number;
  efficiencyGains: number;
  timeframe: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  totalCost?: number;
  incidentsPreventedValue?: number;
  compliancePenaltiesAvoided?: number;
}

/**
 * ROI calculation result
 */
export interface ControlROIResult {
  roi: number;
  paybackPeriod: number; // in months
  npv: number; // Net Present Value
  riskReduction: number; // percentage
  totalCost: number;
  totalBenefit: number;
  recommendations: string[];
  roiPercentage?: number; // ROI as percentage
  totalReturn?: number; // Total monetary return
  netReturn?: number; // Net return after costs
}

/**
 * Investment analysis data
 */
export interface InvestmentAnalysisData {
  investments: {
    controlId: string;
    cost: number;
    type: 'IMPLEMENTATION' | 'MAINTENANCE' | 'UPGRADE';
    timeline: string;
  }[];
  benefits: {
    type: 'RISK_REDUCTION' | 'COMPLIANCE' | 'EFFICIENCY';
    value: number;
    description: string;
  }[];
  assumptions: {
    discountRate: number;
    inflationRate: number;
    riskPremium: number;
  };
}

/**
 * Policy mapping details
 */
export interface PolicyMappingDetails {
  policySection: string;
  mappingType: 'DIRECT' | 'SUPPORTING' | 'REFERENCED';
  relevanceScore: number; // 0-100
  notes?: string;
  reviewedBy?: string;
  reviewDate?: Date;
}